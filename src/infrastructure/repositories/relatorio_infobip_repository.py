import random
from datetime import date, timedelta

from src.infrastructure.databases.sql_server import get_sql_server_66
from src.infrastructure.services.env_load import get_env
from src.shared.exception import AtlasException


def _timeout_relatorio() -> int:
    # Relatorios pesados (queries de ~2 min) usam timeout maior. 0 = sem timeout.
    try:
        return int((get_env("DB_QUERY_TIMEOUT_RELATORIOS", default="300") or "300").strip())
    except ValueError:
        return 300


class RelatorioInfobipRepository:
    LIMITE_TABLE_SEMANAL = "TB_CEDENTE_LIMITE_SEMANAL"
    LIMITE_TABLE_MENSAL = "TB_CEDENTE_LIMITE_MENSAL"
    LIMITE_TOTAL_TABLE_SEMANAL = "TB_LIMITE_TOTAL_SEMANAL"
    LIMITE_TOTAL_TABLE_MENSAL = "TB_LIMITE_TOTAL_MENSAL"
    READ_SOURCE = "infobip.VW_ENVIO_MENSAGEM_LEITURA"
    WRITE_SOURCE = "infobip.TB_ENVIO_MENSAGEM"
    MESSAGE_COLUMN = "MENSAGEM_TEMPLATE"
    VOLUME_EXPRESSION = "ISNULL(SMS_COUNT, 0)"
    QUERY_PREFIX = "sms_infobip"

    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_SMS", query_timeout=_timeout_relatorio())
        self.date_filter_expr = "COALESCE(DT_ENVIO, DT_INCLUSAO)"
        self.read_source = self.READ_SOURCE
        self.write_source = self.WRITE_SOURCE
        self._limite_columns_cache: dict[str, dict[str, str | None]] = {}

    def listar_cedentes(self):
        return self.db.fetch_all(
            f"""
            SELECT ID_CEDENTE, CEDENTE
            FROM infobip.{self.LIMITE_TABLE_SEMANAL} WITH (NOLOCK)
            WHERE CEDENTE IS NOT NULL
              AND LTRIM(RTRIM(CEDENTE)) <> ''
              AND ATIVO = 1
            GROUP BY ID_CEDENTE, CEDENTE
            ORDER BY CEDENTE
            """,
            query_name=f"{self.QUERY_PREFIX}.listar_cedentes",
        )

    def listar_canais(self):
        return self.db.fetch_all(
            f"""
            SELECT CANAL
            FROM {self.read_source} WITH (NOLOCK)
            WHERE CANAL IS NOT NULL AND LTRIM(RTRIM(CANAL)) <> ''
            GROUP BY CANAL
            ORDER BY CANAL
            """,
            query_name="sms_infobip.listar_canais",
        )

    def listar_usuarios(self):
        # NM_USUARIO_ENVIO fica quase sempre NULL (envio via linked server, sem
        # distincao de usuario). A consulta original varria a view inteira (~88s)
        # para retornar praticamente nada. Retorna vazio sem tocar o banco.
        return []

    def listar_status(self):
        return self.db.fetch_all(
            f"""
            SELECT STATUS
            FROM {self.read_source} WITH (NOLOCK)
            WHERE STATUS IS NOT NULL AND LTRIM(RTRIM(STATUS)) <> ''
            GROUP BY STATUS
            ORDER BY STATUS
            """,
            query_name="sms_infobip.listar_status",
        )

    def buscar_cedente_ativo(self, id_cedente: int):
        return self.db.fetch_one(
            f"""
            SELECT TOP (1) ID_CEDENTE, CEDENTE
            FROM infobip.{self.LIMITE_TABLE_SEMANAL} WITH (NOLOCK)
            WHERE ID_CEDENTE = ? AND ATIVO = 1
            ORDER BY CEDENTE
            """,
            [id_cedente],
            query_name=f"{self.QUERY_PREFIX}.buscar_cedente_ativo",
        )

    def listar_limites_semanais(self):
        return self._listar_limites_cedente(self.LIMITE_TABLE_SEMANAL, query_name="sms_infobip.listar_limites_semanais")

    def listar_limites_mensais(self):
        return self._listar_limites_cedente(self.LIMITE_TABLE_MENSAL, query_name="sms_infobip.listar_limites_mensais")

    def buscar_limite_total_semanal(self):
        return self._buscar_limite_total(self.LIMITE_TOTAL_TABLE_SEMANAL, query_name="sms_infobip.buscar_limite_total_semanal")

    def buscar_limite_total_mensal(self):
        return self._buscar_limite_total(self.LIMITE_TOTAL_TABLE_MENSAL, query_name="sms_infobip.buscar_limite_total_mensal")

    def listar_resumo_limites_envio(self):
        return self.db.fetch_all(
            f"""
            DECLARE @hoje DATE = CAST(GETDATE() AS DATE);
            DECLARE @inicio_semana DATE = DATEADD(DAY, -(DATEDIFF(DAY, '19000101', @hoje) % 7), @hoje);
            DECLARE @fim_semana DATE = DATEADD(DAY, 7, @inicio_semana);
            DECLARE @inicio_mes DATE = DATEFROMPARTS(YEAR(@hoje), MONTH(@hoje), 1);
            DECLARE @fim_mes DATE = DATEADD(MONTH, 1, @inicio_mes);
            DECLARE @inicio_semana_mes DATE = DATEADD(DAY, -(DATEDIFF(DAY, '19000101', @inicio_mes) % 7), @inicio_mes);
            DECLARE @inicio_acumulo_mes DATE =
                CASE
                    WHEN @inicio_semana_mes < @inicio_mes THEN DATEADD(DAY, 7, @inicio_semana_mes)
                    ELSE @inicio_semana_mes
                END;
            DECLARE @semanas_anteriores INT =
                CASE
                    WHEN @inicio_semana <= @inicio_acumulo_mes THEN 0
                    ELSE DATEDIFF(DAY, @inicio_acumulo_mes, @inicio_semana) / 7
                END;

            WITH limites_semana AS (
                SELECT
                    CEDENTE,
                    MAX(ID_CEDENTE) AS ID_CEDENTE,
                    MAX(LIMITE_MENSAL) AS LIMITE_SEMANAL
                FROM infobip.{self.LIMITE_TABLE_SEMANAL} WITH (NOLOCK)
                WHERE ATIVO = 1
                GROUP BY CEDENTE
            ),
            enviados_semana_atual AS (
                SELECT
                    CEDENTE,
                    COUNT(*) AS TOTAL_ENVIADO_SEMANA
                FROM {self.read_source} WITH (NOLOCK)
                WHERE DT_ENVIO >= @inicio_semana
                  AND DT_ENVIO < @fim_semana
                GROUP BY CEDENTE
            ),
            enviados_anteriores_mes AS (
                SELECT
                    CEDENTE,
                    COUNT(*) AS TOTAL_ENVIADO_ANTERIOR_MES
                FROM {self.read_source} WITH (NOLOCK)
                WHERE DT_ENVIO >= @inicio_acumulo_mes
                  AND DT_ENVIO < @inicio_semana
                GROUP BY CEDENTE
            ),
            limites_mes AS (
                SELECT
                    CEDENTE,
                    MAX(LIMITE_MENSAL) AS LIMITE_MENSAL
                FROM infobip.{self.LIMITE_TABLE_MENSAL} WITH (NOLOCK)
                WHERE ATIVO = 1
                GROUP BY CEDENTE
            ),
            enviados_mes AS (
                SELECT
                    CEDENTE,
                    COUNT(*) AS TOTAL_ENVIADO_MES
                FROM {self.read_source} WITH (NOLOCK)
                WHERE DT_ENVIO >= @inicio_mes
                  AND DT_ENVIO < @fim_mes
                GROUP BY CEDENTE
            )
            SELECT
                ls.ID_CEDENTE,
                ls.CEDENTE,
                ls.LIMITE_SEMANAL,
                ISNULL(es.TOTAL_ENVIADO_SEMANA, 0) AS TOTAL_ENVIADO_SEMANA,
                CASE
                    WHEN (@semanas_anteriores * ls.LIMITE_SEMANAL) - ISNULL(eam.TOTAL_ENVIADO_ANTERIOR_MES, 0) > 0
                        THEN (@semanas_anteriores * ls.LIMITE_SEMANAL) - ISNULL(eam.TOTAL_ENVIADO_ANTERIOR_MES, 0)
                    ELSE 0
                END AS NAO_UTILIZADO,
                (
                    ls.LIMITE_SEMANAL
                    + CASE
                        WHEN (@semanas_anteriores * ls.LIMITE_SEMANAL) - ISNULL(eam.TOTAL_ENVIADO_ANTERIOR_MES, 0) > 0
                            THEN (@semanas_anteriores * ls.LIMITE_SEMANAL) - ISNULL(eam.TOTAL_ENVIADO_ANTERIOR_MES, 0)
                        ELSE 0
                    END
                ) AS LIMITE_EFETIVO,
                (
                    (
                        ls.LIMITE_SEMANAL
                        + CASE
                            WHEN (@semanas_anteriores * ls.LIMITE_SEMANAL) - ISNULL(eam.TOTAL_ENVIADO_ANTERIOR_MES, 0) > 0
                                THEN (@semanas_anteriores * ls.LIMITE_SEMANAL) - ISNULL(eam.TOTAL_ENVIADO_ANTERIOR_MES, 0)
                            ELSE 0
                        END
                    ) - ISNULL(es.TOTAL_ENVIADO_SEMANA, 0)
                ) AS RESTANTE_SEMANA,
                ISNULL(lm.LIMITE_MENSAL, 0) AS LIMITE_MENSAL,
                ISNULL(em.TOTAL_ENVIADO_MES, 0) AS TOTAL_ENVIADO_MES,
                ISNULL(lm.LIMITE_MENSAL, 0) - ISNULL(em.TOTAL_ENVIADO_MES, 0) AS RESTANTE_MES
            FROM limites_semana ls
            LEFT JOIN enviados_semana_atual es ON es.CEDENTE = ls.CEDENTE
            LEFT JOIN enviados_anteriores_mes eam ON eam.CEDENTE = ls.CEDENTE
            LEFT JOIN limites_mes lm ON lm.CEDENTE = ls.CEDENTE
            LEFT JOIN enviados_mes em ON em.CEDENTE = ls.CEDENTE
            ORDER BY ls.CEDENTE
            """,
            query_name="sms_infobip.listar_resumo_limites_envio",
        )

    def atualizar_limite_semanal(self, id_registro: int, volume_envio: int):
        return self._atualizar_limite_cedente(
            self.LIMITE_TABLE_SEMANAL,
            id_registro=id_registro,
            volume_envio=volume_envio,
            query_name="sms_infobip.atualizar_limite_semanal",
        )

    def atualizar_limite_mensal(self, id_registro: int, volume_envio: int):
        return self._atualizar_limite_cedente(
            self.LIMITE_TABLE_MENSAL,
            id_registro=id_registro,
            volume_envio=volume_envio,
            query_name="sms_infobip.atualizar_limite_mensal",
        )

    def atualizar_limite_total_semanal(self, id_registro: int, limite_total: int):
        return self._atualizar_limite_total(
            self.LIMITE_TOTAL_TABLE_SEMANAL,
            id_registro=id_registro,
            limite_total=limite_total,
            query_name="sms_infobip.atualizar_limite_total_semanal",
        )

    def atualizar_limite_total_mensal(self, id_registro: int, limite_total: int):
        return self._atualizar_limite_total(
            self.LIMITE_TOTAL_TABLE_MENSAL,
            id_registro=id_registro,
            limite_total=limite_total,
            query_name="sms_infobip.atualizar_limite_total_mensal",
        )

    def inserir_envio_teste(self, cedente_nome: str, canal: str, id_cedente: int, id_cliente: int, numero: str, mensagem: str, variaveis_json: str):
        return self.db.fetch_one(
            f"""
            INSERT INTO {self.write_source} (
                CEDENTE, CANAL, ID_CEDENTE, ID_CLIENTE, NUM_CLIENTE, {self.MESSAGE_COLUMN}, VARIAVEIS_JSON, STATUS
            )
            OUTPUT INSERTED.ID, INSERTED.CEDENTE, INSERTED.ID_CEDENTE, INSERTED.NUM_CLIENTE, INSERTED.STATUS
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [cedente_nome, canal, id_cedente, id_cliente, numero, mensagem, variaveis_json, "PENDENTE"],
            query_name="sms_infobip.inserir_envio_teste",
        )

    def buscar_envio_teste_por_id_cliente(self, id_cliente: int):
        return self.db.fetch_one(
            f"""
            SELECT TOP (1)
                ID,
                CEDENTE,
                ID_CEDENTE,
                CANAL,
                ID_CLIENTE,
                NUM_CLIENTE,
                {self.MESSAGE_COLUMN} AS MENSAGEM_TEMPLATE,
                VARIAVEIS_JSON,
                STATUS,
                STATUS_DESC,
                DT_INCLUSAO,
                DT_ENVIO,
                DT_ENTREGA,
                DT_ATUALIZACAO
            FROM {self.write_source} WITH (NOLOCK)
            WHERE ID_CLIENTE = ? 
            """,
            [id_cliente],
            query_name="sms_infobip.buscar_envio_teste_por_id_cliente",
        )

    def id_cliente_existe(self, candidato: int):
        return self.db.fetch_one(
            f"""
            SELECT TOP (1) 1
            FROM {self.write_source} WITH (NOLOCK)
            WHERE ID_CLIENTE = ?
            """,
            [candidato],
            query_name="sms_infobip.id_cliente_existe",
        )

    def gerar_id_cliente_teste(self) -> int:
        for _ in range(30):
            candidato = random.randint(10_000_000, 999_999_999)
            if not self.id_cliente_existe(candidato):
                return candidato
        raise AtlasException("Nao foi possivel gerar um controle interno unico para o teste.")

    def buscar_resumo_dashboard(
        self,
        inicio: date,
        fim: date,
        cedente: str | None,
        status: str | None,
        canal: str | None,
        usuario: str | None,
    ):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT
                SUM({self.VOLUME_EXPRESSION}) AS total_envios,
                SUM({self.VOLUME_EXPRESSION}) AS total_partes_sms,
                SUM(ISNULL(CUSTO_TOTAL, 0)) AS custo_total,
                AVG(CAST(ISNULL(CUSTO_TOTAL, 0) AS DECIMAL(18,6))) AS custo_medio_envio,
                SUM(CASE WHEN STATUS = 'ENTREGUE' THEN 1 ELSE 0 END) AS entregues,
                SUM(CASE WHEN STATUS = 'ERRO' THEN 1 ELSE 0 END) AS erros,
                CAST(100.0 * SUM(CASE WHEN STATUS = 'ENTREGUE' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(10,2)) AS taxa_entrega_pct,
                CAST(100.0 * SUM(CASE WHEN STATUS = 'ERRO' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(10,2)) AS taxa_erro_pct,
                AVG(
                    CAST(
                        CASE
                            WHEN DT_ENTREGA IS NOT NULL
                            THEN DATEDIFF(SECOND, DT_ENVIO, DATEADD(HOUR, -3, DT_ENTREGA))
                            ELSE NULL
                        END AS DECIMAL(18,2)
                    )
                ) AS tempo_medio_entrega
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            """,
            query_name="sms_infobip.buscar_resumo_dashboard",
        )[0]

    def listar_envios_por_dia(
        self,
        inicio: date,
        fim: date,
        cedente: str | None,
        status: str | None,
        canal: str | None,
        usuario: str | None,
    ):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT CAST({self.date_filter_expr} AS DATE) AS dia, SUM({self.VOLUME_EXPRESSION}) AS total_envios
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY CAST({self.date_filter_expr} AS DATE)
            ORDER BY dia
            """,
            query_name="sms_infobip.listar_envios_por_dia",
        )

    def listar_envios_por_semana(
        self,
        inicio: date,
        fim: date,
        cedente: str | None,
        status: str | None,
        canal: str | None,
        usuario: str | None,
    ):
        inicio_semana = inicio - timedelta(days=inicio.weekday())
        fim_semana = fim + timedelta(days=(6 - fim.weekday()))
        where = self._build_where(inicio_semana, fim_semana, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT
                CAST({self.date_filter_expr} AS DATE) AS dia,
                SUM({self.VOLUME_EXPRESSION}) AS total_envios
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY CAST({self.date_filter_expr} AS DATE)
            ORDER BY dia
            """,
            query_name="sms_infobip.listar_envios_por_semana",
        )

    def listar_envios_por_mes(
        self,
        inicio: date,
        fim: date,
        cedente: str | None,
        status: str | None,
        canal: str | None,
        usuario: str | None,
    ):
        inicio_mes = inicio.replace(day=1)
        if fim.month == 12:
            proximo_mes = fim.replace(year=fim.year + 1, month=1, day=1)
        else:
            proximo_mes = fim.replace(month=fim.month + 1, day=1)
        fim_mes = proximo_mes - timedelta(days=1)
        where = self._build_where(inicio_mes, fim_mes, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT
                CAST({self.date_filter_expr} AS DATE) AS dia,
                SUM({self.VOLUME_EXPRESSION}) AS total_envios
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY CAST({self.date_filter_expr} AS DATE)
            ORDER BY dia
            """,
            query_name="sms_infobip.listar_envios_por_mes",
        )

    def listar_custo_por_carteira(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT CEDENTE, SUM(ISNULL(CUSTO_TOTAL, 0)) AS custo_total
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY CEDENTE
            ORDER BY custo_total DESC
            """,
            query_name="sms_infobip.listar_custo_por_carteira",
        )

    def listar_custo_por_canal(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT CANAL, SUM(ISNULL(CUSTO_TOTAL, 0)) AS custo_total
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY CANAL
            ORDER BY custo_total DESC
            """,
            query_name="sms_infobip.listar_custo_por_canal",
        )

    def listar_custo_por_dia(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT CAST({self.date_filter_expr} AS DATE) AS dia, SUM(ISNULL(CUSTO_TOTAL, 0)) AS custo_total
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY CAST({self.date_filter_expr} AS DATE)
            ORDER BY dia
            """,
            query_name="sms_infobip.listar_custo_por_dia",
        )

    def listar_taxa_entrega_por_carteira(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT
                CEDENTE,
                CAST(100.0 * SUM(CASE WHEN STATUS = 'ENTREGUE' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(10,2)) AS taxa_entrega_pct
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY CEDENTE
            ORDER BY taxa_entrega_pct ASC
            """,
            query_name="sms_infobip.listar_taxa_entrega_por_carteira",
        )

    def listar_desempenho_por_canal(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT
                CANAL,
                COUNT(*) AS total_envios,
                CAST(100.0 * SUM(CASE WHEN STATUS = 'ENTREGUE' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(10,2)) AS taxa_entrega_pct
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY CANAL
            ORDER BY total_envios DESC
            """,
            query_name="sms_infobip.listar_desempenho_por_canal",
        )

    def listar_status_dashboard(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT STATUS, COUNT(*) AS total
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            GROUP BY STATUS
            ORDER BY total DESC
            """,
            query_name="sms_infobip.listar_status_dashboard",
        )

    def listar_erros_dashboard(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT TOP (10)
                ISNULL(ERROR_NAME_INFOBIP, 'SEM_ERRO_TECNICO') AS erro_infobip,
                ISNULL(STATUS_DESC, 'SEM_DESCRICAO') AS status_desc,
                COUNT(*) AS total
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            AND STATUS = 'ERRO'
            GROUP BY ERROR_NAME_INFOBIP, STATUS_DESC
            ORDER BY total DESC
            """,
            query_name="sms_infobip.listar_erros_dashboard",
        )

    def listar_usuarios_dashboard(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        # NM_USUARIO_ENVIO fica quase sempre NULL (envio via linked server).
        # Painel "por usuario" nao tem utilidade; retorna vazio sem tocar o banco.
        return []

    def listar_detalhes_dashboard(self, inicio: date, fim: date, cedente: str | None, status: str | None, canal: str | None, usuario: str | None):
        where = self._build_where(inicio, fim, cedente, status, canal, usuario)
        return self.db.fetch_all(
            f"""
            SELECT
                ID,
                CEDENTE,
                ID_CEDENTE,
                CANAL,
                ID_CLIENTE,
                NUM_CLIENTE,
                {self.MESSAGE_COLUMN} AS MENSAGEM_TEMPLATE,
                VARIAVEIS_JSON,
                STATUS,
                STATUS_DESC,
                ISNULL(ERROR_NAME_INFOBIP, '') AS erro_infobip,
                DT_INCLUSAO,
                DT_ENVIO,
                DT_ENTREGA,
                DT_ATUALIZACAO,
                {self.VOLUME_EXPRESSION} AS sms_count,
                ISNULL(CUSTO_TOTAL, 0) AS custo_total,
                NM_USUARIO_ENVIO
            FROM {self.read_source} WITH (NOLOCK)
            {where}
            ORDER BY {self.date_filter_expr} DESC, ID DESC
            """,
            query_name="sms_infobip.listar_detalhes_dashboard",
        )

    def _build_where(
        self,
        inicio: date,
        fim: date,
        cedente: str | None,
        status: str | None,
        canal: str | None,
        usuario: str | None,
    ) -> str:
        inicio_sql = inicio.strftime("%Y%m%d")
        fim_sql = (fim + timedelta(days=1)).strftime("%Y%m%d")

        def esc(value: str) -> str:
            return value.replace("'", "''")

        clauses = [
            (
                f"((DT_ENVIO >= CONVERT(datetime, '{inicio_sql}', 112) "
                f"AND DT_ENVIO < CONVERT(datetime, '{fim_sql}', 112)) "
                f"OR (DT_ENVIO IS NULL "
                f"AND DT_INCLUSAO >= CONVERT(datetime, '{inicio_sql}', 112) "
                f"AND DT_INCLUSAO < CONVERT(datetime, '{fim_sql}', 112)))"
            ),
        ]
        if cedente:
            if not cedente.isdigit():
                raise AtlasException("Cedente invalido.")
            clauses.append(f"ID_CEDENTE = {cedente}")
        if status:
            clauses.append(f"STATUS = '{esc(status)}'")
        if canal:
            clauses.append(f"CANAL = '{esc(canal)}'")
        if usuario:
            clauses.append(f"NM_USUARIO_ENVIO = '{esc(usuario)}'")
        return "WHERE " + " AND ".join(clauses)

    def _listar_limites_cedente(self, table_name: str, query_name: str):
        columns = self._resolve_limite_columns(table_name)
        ativo_clause = f" AND {columns['ativo']} = 1" if columns["ativo"] else ""
        return self.db.fetch_all(
            f"""
            SELECT
                {columns['id_registro']} AS ID,
                {columns['id']} AS ID_CEDENTE,
                {columns['nome']} AS CEDENTE,
                ISNULL({columns['volume']}, 0) AS VOLUME_ENVIO
            FROM infobip.{table_name} WITH (NOLOCK)
            WHERE {columns['nome']} IS NOT NULL
              AND LTRIM(RTRIM({columns['nome']})) <> ''
              {ativo_clause}
            ORDER BY {columns['nome']}
            """,
            query_name=query_name,
        )

    def _atualizar_limite_cedente(self, table_name: str, id_registro: int, volume_envio: int, query_name: str):
        columns = self._resolve_limite_columns(table_name)
        self.db.execute(
            f"""
            UPDATE infobip.{table_name}
            SET {columns['volume']} = ?
            WHERE {columns['id_registro']} = ?
            """,
            [volume_envio, id_registro],
            query_name=f"{query_name}.update",
        )
        return self.db.fetch_one(
            f"""
            SELECT TOP (1)
                {columns['id_registro']} AS ID,
                {columns['id']} AS ID_CEDENTE,
                {columns['nome']} AS CEDENTE,
                ISNULL({columns['volume']}, 0) AS VOLUME_ENVIO
            FROM infobip.{table_name} WITH (NOLOCK)
            WHERE {columns['id_registro']} = ?
            """,
            [id_registro],
            query_name=f"{query_name}.select",
        )

    def _buscar_limite_total(self, table_name: str, query_name: str):
        return self.db.fetch_one(
            f"""
            SELECT TOP (1)
                ID,
                ISNULL(LIMITE_TOTAL, 0) AS LIMITE_TOTAL,
                ISNULL(ATIVO, 1) AS ATIVO
            FROM infobip.{table_name} WITH (NOLOCK)
            WHERE ATIVO = 1
            ORDER BY ID DESC
            """,
            query_name=query_name,
        )

    def _atualizar_limite_total(self, table_name: str, id_registro: int, limite_total: int, query_name: str):
        self.db.execute(
            f"""
            UPDATE infobip.{table_name}
            SET LIMITE_TOTAL = ?,
                DT_ATUALIZACAO = GETDATE()
            WHERE ID = ?
            """,
            [limite_total, id_registro],
            query_name=f"{query_name}.update",
        )
        return self.db.fetch_one(
            f"""
            SELECT TOP (1)
                ID,
                ISNULL(LIMITE_TOTAL, 0) AS LIMITE_TOTAL,
                ISNULL(ATIVO, 1) AS ATIVO
            FROM infobip.{table_name} WITH (NOLOCK)
            WHERE ID = ?
            """,
            [id_registro],
            query_name=f"{query_name}.select",
        )

    def _resolve_limite_columns(self, table_name: str) -> dict[str, str | None]:
        cached = self._limite_columns_cache.get(table_name)
        if cached:
            return cached

        rows = self.db.fetch_all(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'infobip'
              AND TABLE_NAME = ?
            """,
            [table_name],
            query_name="sms_infobip.resolve_limite_columns",
        )
        available = {str(row[0]).upper(): str(row[0]) for row in rows}

        resolved = {
            "id_registro": self._pick_column(
                table_name,
                available,
                candidates=["ID", "ID_REGISTRO", "ID_LINHA"],
                field_label="id",
            ),
            "id": self._pick_column(
                table_name,
                available,
                candidates=["ID_CEDENTE", "ID_CARTEIRA", "IDCARTEIRA"],
                field_label="id_cedente",
            ),
            "nome": self._pick_column(
                table_name,
                available,
                candidates=["CEDENTE", "NM_CEDENTE", "NOME", "CARTEIRA"],
                field_label="nome",
            ),
            "volume": self._pick_column(
                table_name,
                available,
                candidates=self._build_volume_candidates(table_name, available),
                field_label="volume_envio",
            ),
            "ativo": self._pick_optional_column(
                available,
                candidates=["ATIVO", "TP_ATIVO", "FL_ATIVO"],
            ),
        }
        self._limite_columns_cache[table_name] = resolved
        return resolved

    def _pick_column(
        self,
        table_name: str,
        available: dict[str, str],
        candidates: list[str],
        field_label: str,
    ) -> str:
        column = self._pick_optional_column(available, candidates)
        if column:
            return column
        raise AtlasException(
            (
                f"Nao foi possivel identificar a coluna de {field_label} em infobip.{table_name}. "
                f"Colunas disponiveis: {', '.join(sorted(available.keys()))}"
            ),
        )

    def _pick_optional_column(self, available: dict[str, str], candidates: list[str]) -> str | None:
        for candidate in candidates:
            if candidate in available:
                return available[candidate]
        return None

    def _build_volume_candidates(self, table_name: str, available: dict[str, str]) -> list[str]:
        base_candidates = [
            "LIMITE_MENSAL",
            "VOLUME_ENVIO",
            "VOLUME",
            "LIMITE_ENVIO",
            "LIMITE",
            "QTD_ENVIO",
            "QTDE_ENVIO",
            "QTD_LIMITE",
            "QTDE_LIMITE",
            "VL_VOLUME",
        ]
        table_candidates: list[str] = []
        if table_name == self.LIMITE_TABLE_SEMANAL:
            table_candidates.extend(["LIMITE_MENSAL", "LIMITE_SEMANAL", "VOLUME_SEMANAL"])
        if table_name == self.LIMITE_TABLE_MENSAL:
            table_candidates.extend(["LIMITE_MENSAL", "VOLUME_MENSAL"])

        dynamic_candidates: list[str] = []
        for column_upper in sorted(available.keys()):
            if "LIMITE" not in column_upper and "VOLUME" not in column_upper:
                continue
            if column_upper in {"ID", "ID_CEDENTE", "ATIVO", "DT_INCLUSAO", "DT_ATUALIZACAO"}:
                continue
            if table_name == self.LIMITE_TABLE_SEMANAL and "MENSAL" in column_upper:
                continue
            if table_name == self.LIMITE_TABLE_MENSAL and "SEMANAL" in column_upper:
                continue
            dynamic_candidates.append(column_upper)

        ordered: list[str] = []
        for candidate in [*table_candidates, *base_candidates, *dynamic_candidates]:
            if candidate not in ordered:
                ordered.append(candidate)
        return ordered
