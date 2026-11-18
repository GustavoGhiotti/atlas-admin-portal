from __future__ import annotations

from src.infrastructure.databases.sql_server import SqlServerConnection
from src.infrastructure.services.env_load import get_env


class ReguaCarteiraRepository:
    def __init__(self) -> None:
        self.db = SqlServerConnection(
            host=get_env("DB_HOST_66", default="10.0.0.66") or "10.0.0.72",
            database=get_env("DB_BIGGER_NEW", default="DB_BIGGER_NEW") or "DB_BIGGER_NEW",
            user=get_env("DB_USER", required=True),
            password=get_env("DB_PASSWORD", required=True),
        )

    def listar(self) -> list[tuple]:
        query = """
                    SELECT 
                        * 
                    FROM regua.TB_CONTROLE_CARTEIRA WITH(NOLOCK)
                """
        
        return self.db.fetch_all(
            query
        )

    def atualizar(self, dias_abertura: int, id_carteira: int) -> None:
        query = """
                    UPDATE regua.TB_CONTROLE_CARTEIRA
                        SET DIAS_ABERTURA = ?
                    WHERE ID_CEDENTE = ?
                """

        self.db.execute(
            query,
            [dias_abertura, id_carteira]
        )

    
