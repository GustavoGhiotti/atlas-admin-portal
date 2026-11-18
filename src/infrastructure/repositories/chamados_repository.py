from src.infrastructure.databases.sql_server import get_sql_server_66


class ChamadosRepository:
    AREAS_TABLE_NAME = "ChamaDev.TB_DEMANDAS_AREAS"
    PLATAFORMAS_TABLE_NAME = "ChamaDev.TB_DEMANDAS_PLATAFORMAS"
    TIPOS_SOLICITACAO_TABLE_NAME = "ChamaDev.TB_DEMANDAS_TIPO_SOLICITACAO"

    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_BIGGER")

    def listar_areas(self) -> list[dict[str, object]]:
        query = f"""
        SELECT
            ID_AREA AS id_area,
            TP_AREA AS tp_area,
            NM_AREA AS nm_area
        FROM {self.AREAS_TABLE_NAME} WITH (NOLOCK)
        ORDER BY NM_AREA
        """
        return self._fetch_all_dicts(query)

    def buscar_area(self, area_id: int) -> dict[str, object] | None:
        query = f"""
        SELECT
            ID_AREA AS id_area,
            TP_AREA AS tp_area,
            NM_AREA AS nm_area
        FROM {self.AREAS_TABLE_NAME} WITH (NOLOCK)
        WHERE ID_AREA = ?
        """
        return self._fetch_one_dict(query, [area_id])

    def criar_area(self, tp_area: str, nm_area: str) -> int | None:
        query = f"""
        INSERT INTO {self.AREAS_TABLE_NAME} (TP_AREA, NM_AREA)
        OUTPUT INSERTED.ID_AREA
        VALUES (?, ?)
        """
        row = self.db.fetch_one(query, [tp_area, nm_area])
        return int(row[0]) if row else None

    def atualizar_area(
        self,
        area_id: int,
        *,
        tp_area: str | None = None,
        nm_area: str | None = None,
    ) -> bool:
        sets: list[str] = []
        params: list[object] = []
        if tp_area is not None:
            sets.append("TP_AREA = ?")
            params.append(tp_area)
        if nm_area is not None:
            sets.append("NM_AREA = ?")
            params.append(nm_area)
        if not sets:
            return False

        query = f"""
        UPDATE {self.AREAS_TABLE_NAME}
        SET {", ".join(sets)}
        WHERE ID_AREA = ?
        """
        params.append(area_id)
        return self._execute_rowcount(query, params) > 0

    def excluir_area(self, area_id: int) -> bool:
        query = f"""
        DELETE FROM {self.AREAS_TABLE_NAME}
        WHERE ID_AREA = ?
        """
        return self._execute_rowcount(query, [area_id]) > 0

    def listar_plataformas(self) -> list[dict[str, object]]:
        query = f"""
        SELECT
            ID_PLATAFORMA AS id_plataforma,
            NM_PLATAFORMA AS nm_plataforma
        FROM {self.PLATAFORMAS_TABLE_NAME} WITH (NOLOCK)
        ORDER BY NM_PLATAFORMA
        """
        return self._fetch_all_dicts(query)

    def buscar_plataforma(self, plataforma_id: int) -> dict[str, object] | None:
        query = f"""
        SELECT
            ID_PLATAFORMA AS id_plataforma,
            NM_PLATAFORMA AS nm_plataforma
        FROM {self.PLATAFORMAS_TABLE_NAME} WITH (NOLOCK)
        WHERE ID_PLATAFORMA = ?
        """
        return self._fetch_one_dict(query, [plataforma_id])

    def criar_plataforma(self, nm_plataforma: str) -> int | None:
        query = f"""
        INSERT INTO {self.PLATAFORMAS_TABLE_NAME} (NM_PLATAFORMA)
        OUTPUT INSERTED.ID_PLATAFORMA
        VALUES (?)
        """
        row = self.db.fetch_one(query, [nm_plataforma])
        return int(row[0]) if row else None

    def atualizar_plataforma(self, plataforma_id: int, *, nm_plataforma: str | None = None) -> bool:
        if nm_plataforma is None:
            return False

        query = f"""
        UPDATE {self.PLATAFORMAS_TABLE_NAME}
        SET NM_PLATAFORMA = ?
        WHERE ID_PLATAFORMA = ?
        """
        return self._execute_rowcount(query, [nm_plataforma, plataforma_id]) > 0

    def excluir_plataforma(self, plataforma_id: int) -> bool:
        query = f"""
        DELETE FROM {self.PLATAFORMAS_TABLE_NAME}
        WHERE ID_PLATAFORMA = ?
        """
        return self._execute_rowcount(query, [plataforma_id]) > 0

    def listar_tipos_solicitacao(self) -> list[dict[str, object]]:
        query = f"""
        SELECT
            ID_TIPO_SOLICITACAO AS id_tipo_solicitacao,
            NM_TIPO_SOLICITACAO AS nm_tipo_solicitacao
        FROM {self.TIPOS_SOLICITACAO_TABLE_NAME} WITH (NOLOCK)
        ORDER BY NM_TIPO_SOLICITACAO
        """
        return self._fetch_all_dicts(query)

    def buscar_tipo_solicitacao(self, tipo_solicitacao_id: int) -> dict[str, object] | None:
        query = f"""
        SELECT
            ID_TIPO_SOLICITACAO AS id_tipo_solicitacao,
            NM_TIPO_SOLICITACAO AS nm_tipo_solicitacao
        FROM {self.TIPOS_SOLICITACAO_TABLE_NAME} WITH (NOLOCK)
        WHERE ID_TIPO_SOLICITACAO = ?
        """
        return self._fetch_one_dict(query, [tipo_solicitacao_id])

    def criar_tipo_solicitacao(self, nm_tipo_solicitacao: str) -> int | None:
        query = f"""
        INSERT INTO {self.TIPOS_SOLICITACAO_TABLE_NAME} (NM_TIPO_SOLICITACAO)
        OUTPUT INSERTED.ID_TIPO_SOLICITACAO
        VALUES (?)
        """
        row = self.db.fetch_one(query, [nm_tipo_solicitacao])
        return int(row[0]) if row else None

    def atualizar_tipo_solicitacao(self, tipo_solicitacao_id: int, *, nm_tipo_solicitacao: str | None = None) -> bool:
        if nm_tipo_solicitacao is None:
            return False

        query = f"""
        UPDATE {self.TIPOS_SOLICITACAO_TABLE_NAME}
        SET NM_TIPO_SOLICITACAO = ?
        WHERE ID_TIPO_SOLICITACAO = ?
        """
        return self._execute_rowcount(query, [nm_tipo_solicitacao, tipo_solicitacao_id]) > 0

    def excluir_tipo_solicitacao(self, tipo_solicitacao_id: int) -> bool:
        query = f"""
        DELETE FROM {self.TIPOS_SOLICITACAO_TABLE_NAME}
        WHERE ID_TIPO_SOLICITACAO = ?
        """
        return self._execute_rowcount(query, [tipo_solicitacao_id]) > 0

    def listar_chamados(self, cpf_usuario: str | None = None):
        where = ""
        params: list[object] = []
        if cpf_usuario:
            where = "WHERE REPLACE(REPLACE(REPLACE(CAST(d.SOLICITANTE_CPF AS VARCHAR(50)), '.', ''), '-', ''), ' ', '') = ?"
            params.append(self._normalize_cpf(cpf_usuario))

        query = f"""
        SELECT
            d.ID AS id,
            d.TITULO AS titulo,
            d.DESCRICAO AS descricao,
            d.STATUS AS status,
            ISNULL(d.PRIORIDADE, 'medium') AS prioridade,
            CONVERT(VARCHAR(19), d.DT_ABERTURA, 120) AS criado_em,
            CONVERT(VARCHAR(19), ISNULL(d.DT_ATUALIZACAO, d.DT_ABERTURA), 120) AS atualizado_em,
            CAST(d.SOLICITANTE_CPF AS VARCHAR(50)) AS cpf_solicitante,
            d.SOLICITANTE_NOME AS solicitante,
            d.SOLICITANTE_SETOR AS setor_solicitante,
            CASE WHEN d.EVIDENCIA IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS possui_evidencia,
            d.EVIDENCIA_NOME AS evidencia_nome,
            d.EVIDENCIA_MIME AS evidencia_mime,
            d.EVIDENCIA_TAMANHO AS evidencia_tamanho
        FROM ChamaDev.TB_DEMANDAS d WITH (NOLOCK)
        {where}
        ORDER BY d.DT_ABERTURA DESC
        """
        return self._fetch_all_dicts(query, params)

    def buscar_chamado(self, chamado_id: int):
        query = """
        SELECT
            d.ID AS id,
            d.TITULO AS titulo,
            d.DESCRICAO AS descricao,
            d.STATUS AS status,
            ISNULL(d.PRIORIDADE, 'medium') AS prioridade,
            CONVERT(VARCHAR(19), d.DT_ABERTURA, 120) AS criado_em,
            CONVERT(VARCHAR(19), ISNULL(d.DT_ATUALIZACAO, d.DT_ABERTURA), 120) AS atualizado_em,
            CAST(d.SOLICITANTE_CPF AS VARCHAR(50)) AS cpf_solicitante,
            d.SOLICITANTE_NOME AS solicitante,
            d.SOLICITANTE_SETOR AS setor_solicitante,
            CASE WHEN d.EVIDENCIA IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS possui_evidencia,
            d.EVIDENCIA_NOME AS evidencia_nome,
            d.EVIDENCIA_MIME AS evidencia_mime,
            d.EVIDENCIA_TAMANHO AS evidencia_tamanho
        FROM ChamaDev.TB_DEMANDAS d WITH (NOLOCK)
        WHERE d.ID = ?
        """
        return self._fetch_one_dict(query, [chamado_id])

    def criar_chamado(
        self,
        titulo: str,
        setor_solicitante: str,
        descricao: str,
        tipo_solicitacao: str,
        prioridade: str,
        cpf_solicitante: str,
        solicitante: str,
        evidencia: dict[str, object],
    ):
        query = """
        INSERT INTO ChamaDev.TB_DEMANDAS
            (TITULO, DESCRICAO, TIPO_SOLICITACAO, STATUS, PRIORIDADE, DT_ABERTURA, DT_ATUALIZACAO,
             SOLICITANTE_CPF, SOLICITANTE_NOME, SOLICITANTE_SETOR,
             EVIDENCIA, EVIDENCIA_MIME, EVIDENCIA_NOME, EVIDENCIA_TAMANHO)
        OUTPUT INSERTED.ID
        VALUES
            (?, ?, ?, 'open', ?, GETDATE(), GETDATE(), ?, ?, ?, ?, ?, ?, ?)
        """
        row = self.db.fetch_one(
            query,
            [
                titulo,
                descricao,
                tipo_solicitacao,
                prioridade,
                self._normalize_cpf(cpf_solicitante),
                solicitante,
                setor_solicitante,
                evidencia.get("data"),
                evidencia.get("mime"),
                evidencia.get("name"),
                evidencia.get("size"),
            ],
        )
        return int(row[0]) if row else None

    def atualizar_chamado(
        self,
        chamado_id: int,
        *,
        status: str | None = None,
        prioridade: str | None = None,
        descricao: str | None = None,
    ) -> bool:
        sets: list[str] = []
        params: list[object] = []

        if status is not None:
            sets.append("STATUS = ?")
            params.append(status)
        if prioridade is not None:
            sets.append("PRIORIDADE = ?")
            params.append(prioridade)
        if descricao is not None:
            sets.append("DESCRICAO = ?")
            params.append(descricao)

        if not sets:
            return False

        if status is not None:
            sets.append("DT_FECHAMENTO = CASE WHEN ? = 'closed' THEN GETDATE() ELSE NULL END")
            params.append(status)
        sets.append("DT_ATUALIZACAO = GETDATE()")
        query = f"""
        UPDATE ChamaDev.TB_DEMANDAS
        SET {", ".join(sets)}
        WHERE ID = ?
        """
        params.append(chamado_id)
        self.db.execute(query, params)
        return True

    def buscar_evidencia(self, chamado_id: int):
        query = """
        SELECT EVIDENCIA AS evidencia, EVIDENCIA_MIME AS evidencia_mime, EVIDENCIA_NOME AS evidencia_nome
        FROM ChamaDev.TB_DEMANDAS WITH (NOLOCK)
        WHERE ID = ?
        """
        return self._fetch_one_dict(query, [chamado_id])

    def excluir_chamado(self, chamado_id: int) -> bool:
        query = """
        DELETE FROM ChamaDev.TB_DEMANDAS
        WHERE ID = ?
        """
        self.db.execute(query, [chamado_id])
        return True

    def _fetch_all_dicts(self, query: str, params: list[object] | None = None) -> list[dict[str, object]]:
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(cursor, query, params)
            columns = [column[0] for column in cursor.description]
            return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]

    def _fetch_one_dict(self, query: str, params: list[object] | None = None) -> dict[str, object] | None:
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(cursor, query, params)
            row = cursor.fetchone()
            if not row:
                return None
            columns = [column[0] for column in cursor.description]
            return dict(zip(columns, row, strict=True))

    def _execute_rowcount(self, query: str, params: list[object] | None = None) -> int:
        with self.db._connect() as connection:
            cursor = connection.cursor()
            self.db._execute(cursor, query, params)
            rowcount = cursor.rowcount
            connection.commit()
            return rowcount

    def _normalize_cpf(self, value: str) -> str:
        return "".join(char for char in str(value or "") if char.isdigit())
