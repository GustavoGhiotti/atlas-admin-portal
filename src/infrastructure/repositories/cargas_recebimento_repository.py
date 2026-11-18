from __future__ import annotations

from src.infrastructure.databases.sql_server import get_sql_server_71


class CargasRecebimentoRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_71("DB_DESENVOLVIMENTO")

    def listar_recebimentos(self, data_referencia: str, cedente: str | None = None) -> list[tuple]:
        query = """
            SELECT
                 ID
                ,ID_CEDENTE
                ,NM_CEDENTE
                ,HORARIO
                ,QTD_ARQUIVOS
                ,NM_ARQUIVOS
                ,TAMANHO
            FROM Carga.TB_CARGAS_PROCESSADAS WITH(NOLOCK)
            WHERE CAST(HORARIO AS DATE) = CONVERT(date, ?)
        """
        params: list[object] = [data_referencia]
        if cedente:
            query += """
              AND (
                    CAST(ID_CEDENTE AS VARCHAR(50)) = ?
                 OR NM_CEDENTE = ?
              )
            """
            params.extend([cedente, cedente])
        query += " ORDER BY HORARIO DESC, ID DESC"
        return self.db.fetch_all(query, params)

    def listar_cedentes(self) -> list[tuple]:
        return self.db.fetch_all(
            """
            SELECT
                 ID_CEDENTE
                ,NM_CEDENTE
            FROM Carga.TB_CARGAS_PROCESSADAS WITH(NOLOCK)
            WHERE NM_CEDENTE IS NOT NULL
              AND LTRIM(RTRIM(NM_CEDENTE)) <> ''
            GROUP BY ID_CEDENTE, NM_CEDENTE
            ORDER BY NM_CEDENTE
            """
        )
