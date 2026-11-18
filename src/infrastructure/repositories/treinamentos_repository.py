from __future__ import annotations

from datetime import date

from src.infrastructure.databases.sql_server import SqlServerConnection, get_sql_server_71
from src.infrastructure.services.env_load import get_env
from src.schemas.treinamentos import AdmissaoPayload, AgendaTreinamentoPayload, TreinamentoPayload


class TreinamentosRepository:
    _schema_pronto = False

    def __init__(self) -> None:
        self.db = SqlServerConnection(
            host=get_env("DB_HOST_66", default="10.0.0.66") or "10.0.0.66",
            database=get_env("DB_BIGGER_NEW", default="DB_BIGGER_NEW") or "DB_BIGGER_NEW",
            user=get_env("DB_USER", required=True),
            password=get_env("DB_PASSWORD", required=True),
        )
        self.report_db = get_sql_server_71("DB_REPORT")
        self._garantir_schema()

    def _garantir_schema(self) -> None:
        if TreinamentosRepository._schema_pronto:
            return
        self.db.execute("""
            IF COL_LENGTH('treinamento.admissoes', 'id_agenda_dia2') IS NULL
                ALTER TABLE treinamento.admissoes ADD id_agenda_dia2 INT NULL;
        """, [])
        TreinamentosRepository._schema_pronto = True

    def dashboard(
        self,
        inicio: date | None,
        fim: date | None,
        agenda_id: int | None = None,
        carteira: str | None = None,
        turno: str | None = None,
        registro_cargo: str | None = None,
        status_primeiro_dia: str | None = None,
        status_segundo_dia: str | None = None,
    ) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT a.registro_cargo, a.carteira, a.admissao, a.turno,
                   a.status_primeiro_dia, a.status_segundo_dia,
                   a.id_agenda, g.titulo, COUNT(*) AS quantidade
              FROM treinamento.admissoes a WITH(NOLOCK)
              JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = a.id_agenda
             WHERE (? IS NULL OR a.admissao >= ?)
               AND (? IS NULL OR a.admissao <= ?)
               AND (? IS NULL OR a.id_agenda = ?)
               AND (? IS NULL OR a.carteira = ?)
               AND (? IS NULL OR a.turno = ?)
               AND (? IS NULL OR a.registro_cargo = ?)
               AND (? IS NULL OR a.status_primeiro_dia = ?)
               AND (? IS NULL OR a.status_segundo_dia = ?)
             GROUP BY a.registro_cargo, a.carteira, a.admissao, a.turno,
                      a.status_primeiro_dia, a.status_segundo_dia, a.id_agenda, g.titulo
             ORDER BY a.admissao DESC, a.carteira, a.registro_cargo
        """, [
            inicio, inicio, fim, fim, agenda_id, agenda_id,
            carteira, carteira, turno, turno, registro_cargo, registro_cargo,
            status_primeiro_dia, status_primeiro_dia,
            status_segundo_dia, status_segundo_dia,
        ])

    def detalhar_dashboard(
        self, inicio, fim, agenda_id=None, carteira=None, turno=None,
        registro_cargo=None, status_primeiro_dia=None, status_segundo_dia=None,
    ) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT g.titulo, g.data_treinamento, a.colaborador, a.cpf, a.carteira,
                   a.registro_cargo, a.turno, a.admissao,
                   a.status_primeiro_dia, a.status_segundo_dia, a.observacoes
              FROM treinamento.admissoes a WITH(NOLOCK)
              JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = a.id_agenda
             WHERE (? IS NULL OR a.admissao >= ?)
               AND (? IS NULL OR a.admissao <= ?)
               AND (? IS NULL OR a.id_agenda = ?)
               AND (? IS NULL OR a.carteira = ?)
               AND (? IS NULL OR a.turno = ?)
               AND (? IS NULL OR a.registro_cargo = ?)
               AND (? IS NULL OR a.status_primeiro_dia = ?)
               AND (? IS NULL OR a.status_segundo_dia = ?)
             ORDER BY g.data_treinamento DESC, g.titulo, a.carteira, a.colaborador
        """, [
            inicio, inicio, fim, fim, agenda_id, agenda_id,
            carteira, carteira, turno, turno, registro_cargo, registro_cargo,
            status_primeiro_dia, status_primeiro_dia,
            status_segundo_dia, status_segundo_dia,
        ])

    def listar_admissoes(self, busca: str | None, inicio: date | None, fim: date | None, agenda_id: int | None = None) -> list[tuple]:
        termo = f"%{busca.strip()}%" if busca else None
        return self.db.fetch_all("""
            SELECT a.id_admissao, a.colaborador, a.cpf, a.admissao, a.turno, a.registro_cargo, a.carteira,
                   a.status_primeiro_dia, a.status_segundo_dia, a.observacoes,
                   a.id_agenda, g.titulo, g.data_treinamento,
                   a.id_agenda_dia2, g2.titulo, g2.data_treinamento
              FROM treinamento.admissoes a WITH(NOLOCK)
              LEFT JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = a.id_agenda
              LEFT JOIN treinamento.agenda g2 WITH(NOLOCK) ON g2.id_agenda = a.id_agenda_dia2
             WHERE (admissao IS NULL OR ((? IS NULL OR admissao >= ?) AND (? IS NULL OR admissao <= ?)))
               AND (? IS NULL OR a.id_agenda = ?)
               AND (? IS NULL OR a.colaborador LIKE ? OR a.cpf LIKE ? OR a.carteira LIKE ? OR g.titulo LIKE ?)
             ORDER BY a.admissao DESC, a.colaborador
        """, [inicio, inicio, fim, fim, agenda_id, agenda_id, termo, termo, termo, termo, termo])

    def criar_admissao(self, payload: AdmissaoPayload) -> int:
        row = self.db.fetch_one("""
            INSERT INTO treinamento.admissoes
                (id_agenda, id_agenda_dia2, colaborador, cpf, admissao, turno, registro_cargo, carteira,
                 status_primeiro_dia, status_segundo_dia, observacoes)
            OUTPUT INSERTED.id_admissao
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [payload.agenda_id, payload.agenda_dia2_id, payload.colaborador.strip().upper(), payload.cpf, payload.admissao, payload.turno,
                payload.registro_cargo.strip().upper() if payload.registro_cargo else None,
                payload.carteira.strip().upper() if payload.carteira else None,
                payload.status_primeiro_dia, payload.status_segundo_dia, payload.observacoes])
        return int(row[0])

    def atualizar_admissao(self, item_id: int, payload: AdmissaoPayload) -> None:
        self.db.execute("""
            UPDATE treinamento.admissoes SET id_agenda=?, id_agenda_dia2=?, colaborador=?, cpf=?, admissao=?, turno=?,
                   registro_cargo=?, carteira=?, status_primeiro_dia=?, status_segundo_dia=?,
                   observacoes=?, atualizado_em=SYSDATETIME()
             WHERE id_admissao=?
        """, [payload.agenda_id, payload.agenda_dia2_id, payload.colaborador.strip().upper(), payload.cpf, payload.admissao, payload.turno,
                payload.registro_cargo.strip().upper() if payload.registro_cargo else None,
                payload.carteira.strip().upper() if payload.carteira else None,
                payload.status_primeiro_dia, payload.status_segundo_dia, payload.observacoes, item_id])

    def criar_admissoes_lote(self, payloads: list[AdmissaoPayload]) -> int:
        query = """
            INSERT INTO treinamento.admissoes
                (id_agenda, id_agenda_dia2, colaborador, cpf, admissao, turno, registro_cargo, carteira,
                 status_primeiro_dia, status_segundo_dia, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        valores = [[item.agenda_id, item.agenda_dia2_id, item.colaborador.strip().upper(), item.cpf, item.admissao, item.turno,
                    item.registro_cargo.strip().upper() if item.registro_cargo else None,
                    item.carteira.strip().upper() if item.carteira else None,
                    item.status_primeiro_dia, item.status_segundo_dia, item.observacoes]
                   for item in payloads]
        self.db.executemany(query, valores)
        return len(valores)

    def excluir_admissao(self, item_id: int) -> None:
        self.db.execute("DELETE FROM treinamento.admissoes WHERE id_admissao = ?", [item_id])

    def listar_treinamentos(self, busca: str | None, inicio: date | None, fim: date | None, agenda_id: int | None = None) -> list[tuple]:
        termo = f"%{busca.strip()}%" if busca else None
        return self.db.fetch_all("""
            SELECT t.id_treinamento, t.colaborador, t.produto_carteira, t.data_treinamento,
                   t.tipo_treinamento, t.responsavel, t.id_agenda, g.titulo, g.data_treinamento
              FROM treinamento.treinamentos t WITH(NOLOCK)
              JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = t.id_agenda
             WHERE (? IS NULL OR t.data_treinamento >= ?) AND (? IS NULL OR t.data_treinamento <= ?)
               AND (? IS NULL OR t.id_agenda = ?)
               AND (? IS NULL OR t.colaborador LIKE ? OR t.produto_carteira LIKE ? OR t.responsavel LIKE ? OR g.titulo LIKE ?)
             ORDER BY t.data_treinamento DESC, t.colaborador
        """, [inicio, inicio, fim, fim, agenda_id, agenda_id, termo, termo, termo, termo, termo])

    def criar_treinamento(self, payload: TreinamentoPayload) -> int:
        row = self.db.fetch_one("""
            INSERT INTO treinamento.treinamentos
                (id_agenda, colaborador, produto_carteira, data_treinamento, tipo_treinamento, responsavel)
            OUTPUT INSERTED.id_treinamento VALUES (?, ?, ?, ?, ?, ?)
        """, [payload.agenda_id, payload.colaborador.strip().upper(), payload.produto_carteira.strip().upper(),
                payload.data_treinamento, payload.tipo_treinamento, payload.responsavel.strip().upper()])
        return int(row[0])

    def atualizar_treinamento(self, item_id: int, payload: TreinamentoPayload) -> None:
        self.db.execute("""
            UPDATE treinamento.treinamentos SET id_agenda=?, colaborador=?, produto_carteira=?,
                   data_treinamento=?, tipo_treinamento=?, responsavel=?, atualizado_em=SYSDATETIME()
             WHERE id_treinamento=?
        """, [payload.agenda_id, payload.colaborador.strip().upper(), payload.produto_carteira.strip().upper(),
                payload.data_treinamento, payload.tipo_treinamento, payload.responsavel.strip().upper(), item_id])

    def criar_treinamentos_lote(self, payloads: list[TreinamentoPayload]) -> int:
        self.db.executemany("""
            INSERT INTO treinamento.treinamentos
                (id_agenda, colaborador, produto_carteira, data_treinamento, tipo_treinamento, responsavel)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [[item.agenda_id, item.colaborador.strip().upper(), item.produto_carteira.strip().upper(),
                 item.data_treinamento, item.tipo_treinamento, item.responsavel.strip().upper()]
                for item in payloads])
        return len(payloads)

    def excluir_treinamento(self, item_id: int) -> None:
        self.db.execute("DELETE FROM treinamento.treinamentos WHERE id_treinamento = ?", [item_id])

    def listar_treinados_consolidado(self, busca: str | None, inicio: date | None, fim: date | None, agenda_id: int | None = None) -> list[tuple]:
        termo = f"%{busca.strip()}%" if busca else None
        return self.db.fetch_all("""
            SELECT x.origem, x.id, x.colaborador, x.cpf, x.produto_carteira, x.data_treinamento,
                   x.tipo_treinamento, x.responsavel, x.id_agenda, x.titulo, x.agenda_data
              FROM (
                    SELECT 'TREINAMENTO' AS origem, t.id_treinamento AS id, t.colaborador,
                           CAST(NULL AS VARCHAR(14)) AS cpf, t.produto_carteira, t.data_treinamento,
                           t.tipo_treinamento, t.responsavel, t.id_agenda, g.titulo,
                           g.data_treinamento AS agenda_data
                      FROM treinamento.treinamentos t WITH(NOLOCK)
                      JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = t.id_agenda
                    UNION ALL
                    SELECT 'ADMISSAO' AS origem, a.id_admissao AS id, a.colaborador, a.cpf,
                           a.carteira AS produto_carteira, g.data_treinamento AS data_treinamento,
                           'INICIAL' AS tipo_treinamento, g.responsavel, a.id_agenda, g.titulo,
                           g.data_treinamento AS agenda_data
                      FROM treinamento.admissoes a WITH(NOLOCK)
                      JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = a.id_agenda
                     WHERE a.status_primeiro_dia = 'PRESENTE' OR a.status_segundo_dia = 'PRESENTE'
              ) x
             WHERE (? IS NULL OR x.data_treinamento >= ?) AND (? IS NULL OR x.data_treinamento <= ?)
               AND (? IS NULL OR x.id_agenda = ?)
               AND (? IS NULL OR x.colaborador LIKE ? OR x.produto_carteira LIKE ? OR x.responsavel LIKE ? OR x.titulo LIKE ? OR x.cpf LIKE ?)
             ORDER BY x.data_treinamento DESC, x.colaborador
        """, [inicio, inicio, fim, fim, agenda_id, agenda_id, termo, termo, termo, termo, termo, termo])

    def contar_admissoes_presentes(self) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT a.cpf, a.colaborador,
                   SUM(CASE WHEN a.status_primeiro_dia = 'PRESENTE' THEN 1 ELSE 0 END
                     + CASE WHEN a.status_segundo_dia = 'PRESENTE' THEN 1 ELSE 0 END) AS quantidade
              FROM treinamento.admissoes a WITH(NOLOCK)
             WHERE a.status_primeiro_dia = 'PRESENTE' OR a.status_segundo_dia = 'PRESENTE'
             GROUP BY a.cpf, a.colaborador
        """)

    def contar_treinamentos_por_colaborador(self) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT t.colaborador, COUNT(*) AS quantidade
              FROM treinamento.treinamentos t WITH(NOLOCK)
             GROUP BY t.colaborador
        """)

    def mapa_nome_cpf(self) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT DISTINCT a.colaborador, a.cpf
              FROM treinamento.admissoes a WITH(NOLOCK)
             WHERE a.cpf IS NOT NULL AND LTRIM(RTRIM(a.cpf)) <> ''
        """)

    def nomes_do_operador(self, cpf: str | None) -> set[str]:
        if not cpf:
            return set()
        rows = self.db.fetch_all(
            "SELECT DISTINCT colaborador FROM treinamento.admissoes WITH(NOLOCK) WHERE cpf = ?", [cpf]
        )
        return {r[0] for r in rows if r[0]}

    def historico_admissoes(self, cpf: str | None, nomes: list[str]) -> list[tuple]:
        placeholders = ",".join("?" for _ in nomes) if nomes else "NULL"
        return self.db.fetch_all(f"""
            SELECT a.id_admissao, a.colaborador, a.cpf, a.admissao, a.turno, a.registro_cargo, a.carteira,
                   a.status_primeiro_dia, a.status_segundo_dia, a.observacoes,
                   a.id_agenda, g.titulo, g.data_treinamento,
                   COALESCE(g2.titulo, d2.titulo), COALESCE(g2.data_treinamento, d2.data_treinamento),
                   a.id_agenda_dia2
              FROM treinamento.admissoes a WITH(NOLOCK)
              LEFT JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = a.id_agenda
              LEFT JOIN treinamento.agenda g2 WITH(NOLOCK) ON g2.id_agenda = a.id_agenda_dia2
              OUTER APPLY (
                  SELECT TOP 1 dd.titulo, dd.data_treinamento
                    FROM treinamento.agenda dd WITH(NOLOCK)
                   WHERE dd.codigo_ciclo = g.codigo_ciclo AND dd.dia_encontro = 2
                   ORDER BY dd.data_treinamento
              ) d2
             WHERE (? IS NOT NULL AND a.cpf = ?) OR a.colaborador IN ({placeholders})
             ORDER BY g.data_treinamento DESC, a.colaborador
        """, [cpf, cpf, *nomes])

    def obter_agenda_dia2(self, codigo_ciclo: str) -> int | None:
        row = self.db.fetch_one("""
            SELECT TOP 1 id_agenda FROM treinamento.agenda WITH(NOLOCK)
             WHERE codigo_ciclo = ? AND dia_encontro = 2 ORDER BY data_treinamento
        """, [codigo_ciclo])
        return int(row[0]) if row else None

    def listar_agenda_opcoes_dia2(self, inicio: date | None = None, fim: date | None = None) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT g.id_agenda, g.titulo, g.data_treinamento, g.horario_inicio, g.produto_carteira,
                   g.tipo_treinamento, g.responsavel, g.status_agenda, g.codigo_ciclo, g.dia_encontro, g.observacoes
              FROM treinamento.agenda g WITH(NOLOCK)
             WHERE g.dia_encontro = 2
               AND (? IS NULL OR g.data_treinamento >= ?)
               AND (? IS NULL OR g.data_treinamento <= ?)
             ORDER BY g.data_treinamento DESC, g.horario_inicio, g.titulo
        """, [inicio, inicio, fim, fim])

    def historico_treinamentos(self, nomes: list[str]) -> list[tuple]:
        if not nomes:
            return []
        placeholders = ",".join("?" for _ in nomes)
        return self.db.fetch_all(f"""
            SELECT t.id_treinamento, t.colaborador, t.produto_carteira, t.data_treinamento,
                   t.tipo_treinamento, t.responsavel, t.id_agenda, g.titulo, g.data_treinamento
              FROM treinamento.treinamentos t WITH(NOLOCK)
              JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = t.id_agenda
             WHERE t.colaborador IN ({placeholders})
             ORDER BY t.data_treinamento DESC
        """, list(nomes))

    def listar_agenda(self, inicio: date, fim: date) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT g.id_agenda, g.titulo, g.data_treinamento, g.horario_inicio, g.horario_fim,
                   g.produto_carteira, g.tipo_treinamento, g.responsavel,
                   COALESCE(p.participantes, ''), g.observacoes, g.status_agenda,
                   COALESCE(a.quantidade, 0), COALESCE(t.quantidade, 0),
                   g.codigo_ciclo, g.dia_encontro
              FROM treinamento.agenda g WITH(NOLOCK)
              OUTER APPLY (
                  SELECT STUFF((
                      SELECT '; ' + v.colaborador
                        FROM (
                            SELECT colaborador FROM treinamento.admissoes WITH(NOLOCK) WHERE id_agenda = g.id_agenda
                            UNION
                            SELECT colaborador FROM treinamento.treinamentos WITH(NOLOCK) WHERE id_agenda = g.id_agenda
                        ) v
                       ORDER BY v.colaborador
                         FOR XML PATH(''), TYPE
                  ).value('.', 'nvarchar(max)'), 1, 2, '') AS participantes
              ) p
              OUTER APPLY (
                  SELECT COUNT(*) quantidade
                    FROM treinamento.admissoes adm WITH(NOLOCK)
                    JOIN treinamento.agenda ga WITH(NOLOCK) ON ga.id_agenda = adm.id_agenda
                   WHERE ga.codigo_ciclo = g.codigo_ciclo
              ) a
              OUTER APPLY (SELECT COUNT(*) quantidade FROM treinamento.treinamentos WITH(NOLOCK) WHERE id_agenda = g.id_agenda) t
             WHERE g.data_treinamento BETWEEN ? AND ?
             ORDER BY g.data_treinamento, g.horario_inicio
        """, [inicio, fim])

    def listar_participantes_agenda(self, inicio: date, fim: date) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT x.id_agenda, x.carteira, x.colaborador
              FROM (
                    SELECT destino.id_agenda, COALESCE(NULLIF(LTRIM(RTRIM(a.carteira)), ''), 'NÃO INFORMADA') carteira,
                           a.colaborador
                      FROM treinamento.admissoes a WITH(NOLOCK)
                      JOIN treinamento.agenda origem WITH(NOLOCK) ON origem.id_agenda = a.id_agenda
                      JOIN treinamento.agenda destino WITH(NOLOCK) ON destino.codigo_ciclo = origem.codigo_ciclo
                     WHERE destino.data_treinamento BETWEEN ? AND ?
                    UNION
                    SELECT t.id_agenda, COALESCE(NULLIF(LTRIM(RTRIM(t.produto_carteira)), ''), 'NÃO INFORMADA'),
                           t.colaborador
                      FROM treinamento.treinamentos t WITH(NOLOCK)
                      JOIN treinamento.agenda g WITH(NOLOCK) ON g.id_agenda = t.id_agenda
                     WHERE g.data_treinamento BETWEEN ? AND ?
              ) x
             ORDER BY x.id_agenda, x.carteira, x.colaborador
        """, [inicio, fim, inicio, fim])

    def listar_agenda_opcoes(self, inicio: date | None = None, fim: date | None = None) -> list[tuple]:
        return self.db.fetch_all("""
            SELECT g.id_agenda, g.titulo, g.data_treinamento, g.horario_inicio, g.produto_carteira,
                   g.tipo_treinamento, g.responsavel, g.status_agenda, g.codigo_ciclo, g.dia_encontro,
                   CASE WHEN EXISTS (SELECT 1 FROM treinamento.agenda d2 WITH(NOLOCK)
                                      WHERE d2.codigo_ciclo=g.codigo_ciclo AND d2.dia_encontro=2) THEN 1 ELSE 0 END,
                   g.observacoes
              FROM treinamento.agenda g WITH(NOLOCK)
             WHERE g.dia_encontro = 1
               AND (? IS NULL OR g.data_treinamento >= ?)
               AND (? IS NULL OR g.data_treinamento <= ?)
             ORDER BY g.data_treinamento DESC, g.horario_inicio, g.titulo
        """, [inicio, inicio, fim, fim])

    def listar_carteiras(self) -> list[tuple]:
        return self.report_db.fetch_all("""
            SELECT DISTINCT ID_CEDENTE, LTRIM(RTRIM(CARTEIRA)) AS CARTEIRA
              FROM DB_REPORT.DM.TB_CARTEIRA WITH(NOLOCK)
             WHERE CARTEIRA IS NOT NULL AND LTRIM(RTRIM(CARTEIRA)) <> ''
             ORDER BY ID_CEDENTE DESC
        """)

    def criar_agenda(self, payload: AgendaTreinamentoPayload, codigo_ciclo: str, dia_encontro: int) -> int:
        row = self.db.fetch_one("""
            INSERT INTO treinamento.agenda
              (titulo, data_treinamento, horario_inicio, horario_fim, produto_carteira,
               tipo_treinamento, responsavel, participantes, observacoes, status_agenda,
               codigo_ciclo, dia_encontro)
            OUTPUT INSERTED.id_agenda VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [payload.titulo.strip(), payload.data_treinamento, payload.horario_inicio,
                payload.horario_fim, payload.produto_carteira.strip().upper(),
                payload.tipo_treinamento, payload.responsavel.strip().upper(),
                payload.participantes, payload.observacoes, payload.status_agenda, codigo_ciclo, dia_encontro])
        return int(row[0])

    def obter_ciclo_agenda(self, item_id: int):
        return self.db.fetch_one("SELECT codigo_ciclo, dia_encontro FROM treinamento.agenda WHERE id_agenda=?", [item_id])

    def obter_agenda_principal(self, item_id: int) -> int:
        row = self.db.fetch_one("""
            SELECT TOP 1 principal.id_agenda
              FROM treinamento.agenda selecionada
              JOIN treinamento.agenda principal ON principal.codigo_ciclo = selecionada.codigo_ciclo
             WHERE selecionada.id_agenda = ?
             ORDER BY principal.dia_encontro, principal.data_treinamento, principal.id_agenda
        """, [item_id])
        return int(row[0]) if row else item_id

    def ciclo_possui_dia(self, codigo_ciclo: str, dia_encontro: int) -> bool:
        row = self.db.fetch_one("SELECT COUNT(*) FROM treinamento.agenda WHERE codigo_ciclo=? AND dia_encontro=?", [codigo_ciclo, dia_encontro])
        return bool(row and int(row[0]))

    def atualizar_agenda(self, item_id: int, payload: AgendaTreinamentoPayload) -> None:
        self.db.execute("""
            UPDATE treinamento.agenda
               SET titulo=?, data_treinamento=?, horario_inicio=?, horario_fim=?, produto_carteira=?,
                   tipo_treinamento=?, responsavel=?, participantes=?, observacoes=?, status_agenda=?
             WHERE id_agenda=?
        """, [payload.titulo.strip(), payload.data_treinamento, payload.horario_inicio,
                payload.horario_fim, payload.produto_carteira.strip().upper(),
                payload.tipo_treinamento, payload.responsavel.strip().upper(),
                payload.participantes, payload.observacoes, payload.status_agenda, item_id])

    def excluir_agenda(self, item_id: int) -> tuple[int, int]:
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(cursor, "SELECT codigo_ciclo FROM treinamento.agenda WHERE id_agenda = ?", [item_id])
            row = cursor.fetchone()
            if not row:
                raise ValueError("Agendamento não encontrado.")
            codigo_ciclo = row[0]
            self.db._execute(cursor, """
                DELETE a FROM treinamento.admissoes a
                 JOIN treinamento.agenda g ON g.id_agenda = a.id_agenda
                WHERE g.codigo_ciclo = ?
            """, [codigo_ciclo])
            admissoes = cursor.rowcount
            self.db._execute(cursor, """
                DELETE t FROM treinamento.treinamentos t
                 JOIN treinamento.agenda g ON g.id_agenda = t.id_agenda
                WHERE g.codigo_ciclo = ?
            """, [codigo_ciclo])
            treinamentos = cursor.rowcount
            self.db._execute(cursor, "DELETE FROM treinamento.agenda WHERE codigo_ciclo = ?", [codigo_ciclo])
            connection.commit()
            return admissoes, treinamentos
