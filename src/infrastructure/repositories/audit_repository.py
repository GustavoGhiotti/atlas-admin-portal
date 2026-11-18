"""Gravacao das duas tabelas de log do Atlas em LOGS_ROBOS (schema ATLAS).

Usa a conexao DEDICADA de log (get_sql_log), com timeout curto e separada do
banco de login. Uma conexao por insert, no padrao do projeto: como roda numa
thread de background unica, e serializado e auto-recupera se a conexao cair.
"""

from src.infrastructure.databases.sql_server import get_sql_log
from src.infrastructure.services.audit_logger import AuditEvent


class AuditRepository:
    def __init__(self) -> None:
        self.db = get_sql_log()

    def inserir(self, event: AuditEvent) -> None:
        if event.tipo == "ERRO":
            self._inserir_erro(event)
        else:
            self._inserir_execucao(event)

    def _inserir_execucao(self, e: AuditEvent) -> None:
        self.db.execute(
            """
            INSERT INTO ATLAS.EXECUCAO
                (MODULO, ACAO, NM_LOGIN, ROTA, METODO, REQUEST_ID, HOST_ORIGEM, DETALHE)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                e.modulo,
                e.acao,
                e.nm_login,
                e.rota,
                e.metodo,
                e.request_id,
                e.host_origem,
                e.detalhe,
            ],
        )

    def _inserir_erro(self, e: AuditEvent) -> None:
        self.db.execute(
            """
            INSERT INTO ATLAS.ERRO
                (MODULO, ACAO, NM_LOGIN, ROTA, METODO, STATUS_HTTP,
                 REQUEST_ID, HOST_ORIGEM, ERRO_TIPO, ERRO_RESUMO)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                e.modulo,
                e.acao,
                e.nm_login,
                e.rota,
                e.metodo,
                e.status_http,
                e.request_id,
                e.host_origem,
                e.erro_tipo,
                e.erro_resumo,
            ],
        )
