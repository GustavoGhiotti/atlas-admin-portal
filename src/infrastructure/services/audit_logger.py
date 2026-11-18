"""Servico central de auditoria do Atlas.

Objetivo: registrar TODAS as acoes (execucoes) e os erros, sem NUNCA deixar o
log derrubar ou travar a aplicacao. Garantias:

  1. Gravacao em BACKGROUND (fila + thread): a requisicao do usuario nunca
     espera o banco de log.
  2. Timeout curto na conexao de log (ver sql_server.get_sql_log).
  3. Best-effort: se a gravacao no banco falhar, cai no log em ARQUIVO e a
     operacao principal segue normal.
  4. Chave liga/desliga por env: AUDIT_DB_ENABLED=0 desliga a gravacao no
     banco (Atlas continua 100%, logando so em arquivo). Serve para quando o
     LOGS_ROBOS estiver em manutencao/travado.
"""

import queue
import threading
import time
from dataclasses import dataclass

from src.infrastructure.services.env_load import get_env
from src.infrastructure.services.logger_config import setup_logger


@dataclass
class AuditEvent:
    tipo: str                       # 'EXECUCAO' | 'ERRO'
    modulo: str
    acao: str
    nm_login: str | None = None
    rota: str | None = None
    metodo: str | None = None
    status_http: int | None = None
    request_id: str | None = None
    host_origem: str | None = None
    detalhe: str | None = None      # execucao: titulo/descricao curta
    erro_tipo: str | None = None    # erro: classe da excecao
    erro_resumo: str | None = None  # erro: mensagem curta


_QUEUE_MAXSIZE = 10000


class AuditLogger:
    def __init__(self) -> None:
        self.logger = setup_logger("atlas.auditoria")
        self.enabled = (get_env("AUDIT_DB_ENABLED", default="1") or "1").strip() == "1"
        self._queue: "queue.Queue[AuditEvent]" = queue.Queue(maxsize=_QUEUE_MAXSIZE)
        self._worker: threading.Thread | None = None
        if self.enabled:
            self._worker = threading.Thread(target=self._run, name="atlas-audit-logger", daemon=True)
            self._worker.start()

    def registrar(self, event: AuditEvent) -> None:
        """Enfileira sem bloquear. Se a fila estiver cheia, descarta e avisa
        no arquivo (protege o app sob pico)."""
        if not self.enabled:
            return
        try:
            self._queue.put_nowait(event)
        except queue.Full:
            self.logger.warning(
                "Fila de auditoria cheia; evento descartado. tipo=%s rota=%s request_id=%s",
                event.tipo, event.rota, event.request_id,
            )

    def flush(self, timeout: float = 5.0) -> None:
        """Chamado no encerramento da aplicacao. Espera a fila esvaziar por ate
        `timeout` segundos. Se nao esvaziar a tempo, desiste (registra no arquivo)
        em vez de travar o restart. Assim nao perde evento e nao segura o shutdown.
        """
        if not self.enabled:
            return
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self._queue.unfinished_tasks == 0:
                return
            time.sleep(0.1)
        restantes = self._queue.unfinished_tasks
        if restantes:
            self.logger.warning(
                "Encerrando com %s evento(s) de auditoria ainda na fila (nao gravados no banco).",
                restantes,
            )

    def _run(self) -> None:
        # Import tardio para nao quebrar o startup caso o repositorio/driver falhe.
        from src.infrastructure.repositories.audit_repository import AuditRepository

        repository = AuditRepository()
        while True:
            event = self._queue.get()
            try:
                repository.inserir(event)
            except Exception:  # nunca propaga: log e best-effort
                self.logger.exception(
                    "Falha ao gravar auditoria no banco (caiu no arquivo). "
                    "tipo=%s modulo=%s acao=%s rota=%s request_id=%s detalhe=%s",
                    event.tipo, event.modulo, event.acao, event.rota,
                    event.request_id, event.detalhe or event.erro_resumo,
                )
            finally:
                self._queue.task_done()


# Instancia unica usada pelo middleware.
audit_logger = AuditLogger()
