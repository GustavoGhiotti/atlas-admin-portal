from __future__ import annotations

from src.infrastructure.databases.sql_server import get_sql_server_65


class CargasConsultaRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_65("EASYCOLLECTOR")

    def listar_execucoes(self, data_referencia: str) -> list[tuple]:
        return self.db.fetch_all(
            """
            SELECT
                 ID_CARGA
                ,NM_ORIGEM
                ,NU_REMESSA
                ,CASE
                    WHEN TP_STATUS = 0 THEN 'NADA'
                    WHEN TP_STATUS = 1 THEN 'AGUARDANDO'
                    WHEN TP_STATUS = 2 THEN 'ERRO'
                    WHEN TP_STATUS = 3 THEN 'EM ANDAMENTO'
                    WHEN TP_STATUS = 4 THEN 'PROCESSADO'
                 END AS STATUS_CARGA
                ,DT_INICIO
                ,DT_FIM
                ,NM_ARQUIVO
            FROM EASYCOLLECTOR.dbo.TB_CARGA WITH(NOLOCK)
            WHERE CAST(DT_INICIO AS DATE) = CONVERT(date, ?)
            ORDER BY DT_INICIO DESC, ID_CARGA DESC
            """,
            [data_referencia],
        )
