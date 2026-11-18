from time import perf_counter
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from src.infrastructure.security.token_service import TokenService
from src.infrastructure.services.audit_logger import AuditEvent, audit_logger
from src.infrastructure.services.request_context import reset_request_id, set_request_id


# ---------------------------------------------------------------------------
# Regras de auditoria (edite aqui, sem mexer em endpoint nenhum).
#
#   - Metodos que MUDAM estado -> gravam EXECUCAO (upload, import, automacao...).
#   - GET so grava EXECUCAO se a rota "faz algo" (download/export), pelas
#     palavras em GET_ACAO_KEYWORDS.
#   - Consulta pura (GET normal) NAO grava execucao; so entra em ERRO se falhar.
#   - ROTAS_SEM_AUDITORIA: rotas mutantes que na verdade sao consulta
#     (ex.: busca via POST) e que voce NAO quer em EXECUCAO. Casa por "contem".
#   - ERRO: grava sempre que a resposta for >= STATUS_ERRO_MINIMO (default 500)
#     ou quando estourar excecao nao tratada.
# ---------------------------------------------------------------------------
METODOS_MUTANTES = {"POST", "PUT", "PATCH", "DELETE"}
GET_ACAO_KEYWORDS = ("download", "baixar", "export", "exportar", "gerar")
ROTAS_SEM_AUDITORIA: tuple[str, ...] = (
    "/api/auth/login",   # login e muito frequente; nao registra em EXECUCAO (erro 500 ainda e logado)
    # exemplos: "/api/sms/consultar", "/api/relatorio/",
)
STATUS_ERRO_MINIMO = 500


def _limitar(texto: str | None, tamanho: int) -> str | None:
    if texto is None:
        return None
    texto = str(texto)
    return texto if len(texto) <= tamanho else texto[:tamanho]


def _modulo_acao(path: str, metodo: str) -> tuple[str, str]:
    partes = [p for p in path.split("/") if p and p.lower() != "api"]
    modulo = (partes[0] if partes else "ROOT").upper()
    acao = "/".join(partes[1:]) if len(partes) > 1 else metodo.lower()
    return _limitar(modulo, 40), _limitar(acao, 40)


def _eh_acao(metodo: str, path: str) -> bool:
    path_lower = path.lower()
    if any(rota.lower() in path_lower for rota in ROTAS_SEM_AUDITORIA):
        return False
    if metodo in METODOS_MUTANTES:
        return True
    if metodo == "GET" and any(kw in path_lower for kw in GET_ACAO_KEYWORDS):
        return True
    return False


class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, logger):
        super().__init__(app)
        self.logger = logger
        self.token_service = TokenService()

    def _extrair_login(self, request: Request) -> str | None:
        # 1) preferir o que o app ja colocou no state (enriquecimento futuro)
        login = getattr(request.state, "nm_login", None)
        if login:
            return login
        # 2) best-effort: decodificar o Bearer token, sem quebrar nada
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            try:
                payload = self.token_service.decode(auth[7:].strip())
                return payload.get("nm_login")
            except Exception:
                return None
        return None

    async def dispatch(self, request: Request, call_next):
        request_id = uuid4().hex[:12]
        token = set_request_id(request_id)
        request.state.request_id = request_id
        started_at = perf_counter()
        path = request.url.path
        metodo = request.method
        ip = request.client.host if request.client else "-"

        self.logger.info(
            "request_id=%s fase=inicio rota=%s metodo=%s ip=%s query_string=%s",
            request_id, path, metodo, ip, request.url.query or "-",
        )

        try:
            response = await call_next(request)
        except Exception as exc:
            elapsed_ms = (perf_counter() - started_at) * 1000
            self.logger.exception(
                "request_id=%s fase=erro rota=%s metodo=%s duracao_ms=%.2f",
                request_id, path, metodo, elapsed_ms,
            )
            # auditoria de erro (best-effort, nao bloqueia o raise)
            self._auditar_erro(request, path, metodo, ip, request_id, 500, exc)
            raise
        finally:
            reset_request_id(token)

        elapsed_ms = (perf_counter() - started_at) * 1000
        self.logger.info(
            "request_id=%s fase=fim titulo=%s rota=%s metodo=%s ip=%s status=%s duracao_ms=%.2f",
            request_id, getattr(request.state, "log_title", "Requisicao recebida"),
            path, metodo, ip, response.status_code, elapsed_ms,
        )

        # Só auditamos chamadas de API
        if path.startswith("/api") and metodo != "OPTIONS":
            if response.status_code >= STATUS_ERRO_MINIMO:
                self._auditar_erro(request, path, metodo, ip, request_id, response.status_code, None)
            elif _eh_acao(metodo, path):
                self._auditar_execucao(request, path, metodo, ip, request_id)

        return response

    def _auditar_execucao(self, request, path, metodo, ip, request_id) -> None:
        modulo, acao = _modulo_acao(path, metodo)
        audit_logger.registrar(AuditEvent(
            tipo="EXECUCAO",
            modulo=modulo,
            acao=acao,
            nm_login=self._extrair_login(request),
            rota=_limitar(path, 200),
            metodo=metodo,
            request_id=request_id,
            host_origem=_limitar(ip, 45),
            detalhe=_limitar(getattr(request.state, "log_title", None), 2000),
        ))

    def _auditar_erro(self, request, path, metodo, ip, request_id, status_http, exc) -> None:
        modulo, acao = _modulo_acao(path, metodo)
        erro_tipo = type(exc).__name__ if exc else getattr(request.state, "erro_tipo", None)
        erro_resumo = str(exc) if exc else getattr(request.state, "erro_resumo", None)
        audit_logger.registrar(AuditEvent(
            tipo="ERRO",
            modulo=modulo,
            acao=acao,
            nm_login=self._extrair_login(request),
            rota=_limitar(path, 200),
            metodo=metodo,
            status_http=status_http,
            request_id=request_id,
            host_origem=_limitar(ip, 45),
            erro_tipo=_limitar(erro_tipo, 100),
            erro_resumo=_limitar(erro_resumo, 2000),
        ))
