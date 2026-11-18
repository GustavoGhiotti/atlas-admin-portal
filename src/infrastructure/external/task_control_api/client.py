import json
from dataclasses import dataclass
from urllib import error, parse, request

from src.infrastructure.services.env_load import get_env
from src.shared.exception import ConfiguracaoException, IntegracaoException


@dataclass
class TaskControlApiResponse:
    success: bool
    message: str
    data: object | None


class TaskControlApiClient:
    def __init__(self) -> None:
        self.base_url = (get_env("TASK_CONTROL_API_BASE_URL", default="") or "").rstrip("/")
        self.api_token = get_env("TASK_CONTROL_API_TOKEN", required=True)
        self.timeout = float(get_env("TASK_CONTROL_API_TIMEOUT_SECONDS", default="20") or "20")

        if not self.base_url:
            raise ConfiguracaoException("Variavel de ambiente obrigatoria nao definida: TASK_CONTROL_API_BASE_URL")

    def get(self, path: str, params: dict[str, object] | None = None) -> TaskControlApiResponse:
        url = self._build_url(path, params)
        req = request.Request(url, headers=self._headers(), method="GET")
        return self._send(req)

    def post(self, path: str, params: dict[str, object] | None = None) -> TaskControlApiResponse:
        url = self._build_url(path, params)
        req = request.Request(url, headers=self._headers(), data=b"", method="POST")
        return self._send(req)

    def _build_url(self, path: str, params: dict[str, object] | None = None) -> str:
        normalized_path = path if path.startswith("/") else f"/{path}"
        query_params = {
            key: value
            for key, value in (params or {}).items()
            if value is not None and str(value).strip() != ""
        }
        query = parse.urlencode(query_params, doseq=True)
        return f"{self.base_url}{normalized_path}{f'?{query}' if query else ''}"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": self.api_token or "",
            "Accept": "application/json",
        }

    def _send(self, req: request.Request) -> TaskControlApiResponse:
        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                payload = response.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore").strip()
            raise IntegracaoException(detail or f"Falha na API de controle de tarefas: HTTP {exc.code}") from exc
        except error.URLError as exc:
            raise IntegracaoException(f"Falha ao conectar na API de controle de tarefas: {exc.reason}") from exc
        except TimeoutError as exc:
            raise IntegracaoException("Tempo limite excedido ao consultar a API de controle de tarefas.") from exc

        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError as exc:
            raise IntegracaoException("A API de controle de tarefas retornou um payload invalido.") from exc

        return TaskControlApiResponse(
            success=bool(data.get("success")),
            message=str(data.get("message") or ""),
            data=data.get("data"),
        )
