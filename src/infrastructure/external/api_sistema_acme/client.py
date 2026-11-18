import requests
from src.infrastructure.services.env_load import get_env
from src.shared.exception import AtlasException, ConfiguracaoException, IntegracaoException

class ApiSistemaAcmeClient:
    def __init__(self) -> None:
        self.base_url = (get_env("API_SISTEMA_ACME_BASE_URL", required=True) or "").rstrip("/")
        self.internal_token = (get_env("API_SISTEMA_ACME_INTERNAL_TOKEN", required=True) or "").strip()
        self.timeout_seconds = self._get_timeout_seconds()

        if not self.internal_token:
            raise ConfiguracaoException("API_SISTEMA_ACME_INTERNAL_TOKEN nao pode ficar vazio.")

    def listar_templates(self, *, filtro: str | None = None) -> dict:
        params = {}
        if filtro:
            params["filtro"] = filtro

        return self._request(
            "GET",
            "/monitoria-whatsapp/api/whatsapp/templates",
            params=params or None,
        )
    
    def detalhar_template(self, id_template: int) -> dict:
        return self._request(
            "GET",
            f"/monitoria-whatsapp/api/whatsapp/templates/{id_template}",
        )
    
    def criar_template(self, payload: dict) -> dict:
        return self._request(
            "POST",
            "/monitoria-whatsapp/api/whatsapp/templates",
            json=payload,
        )

    def atualizar_template(self, id_template: int, payload: dict) -> dict:
        return self._request(
            "PUT",
            f"/monitoria-whatsapp/api/whatsapp/templates/{id_template}",
            json=payload,
        )

    def excluir_template(self, id_template: int, usuario_responsavel: str | None = None) -> dict:
        params = {}
        if usuario_responsavel:
            params["usuario_responsavel"] = usuario_responsavel

        return self._request(
            "DELETE",
            f"/monitoria-whatsapp/api/whatsapp/templates/{id_template}",
            params=params or None,
        )
    
    def submeter_template_meta(self, id_template: int, usuario_responsavel: str | None = None) -> dict:
        payload = {}
        if usuario_responsavel:
            payload["usuario_responsavel"] = usuario_responsavel

        return self._request(
            "POST",
            f"/monitoria-whatsapp/api/whatsapp/templates/{id_template}/submeter-meta",
            json=payload,
        )
    
    def _request(self, method: str, path: str, **kwargs) -> dict:
        url = f"{self.base_url}{path}"
        headers = kwargs.pop("headers", {}) or {}
        headers["Accept"] = "application/json"

        if self.internal_token:
            headers["X-Internal-Token"] = self.internal_token

        try:
            response = requests.request(
                method,
                url,
                headers=headers,
                timeout=(3.05, self.timeout_seconds),
                **kwargs,
            )
        except requests.RequestException as exc:
            raise IntegracaoException("Falha de comunicacao com a APISistemaAcme.") from exc
        
        payload = self._parse_response(response)

        if response.status_code >= 400:
            mensagem = (
                payload.get("erro")
                or payload.get("mensagem")
                or payload.get("detail")
                or "APISistemaAcme rejeitou a solicitacao."
            )

            if response.status_code < 500:
                raise AtlasException(str(mensagem), status_code=response.status_code)

            raise IntegracaoException(str(mensagem))
        
        return payload
    
    def _parse_response(self, response: requests.Response) -> dict:
        try:
            payload = response.json()
        except ValueError as exc:
            raise IntegracaoException("APISistemaAcme retornou resposta invalida") from exc
        
        if not isinstance(payload, dict):
            raise IntegracaoException("APISistemaAcme retornou payload inesperado")
        
        return payload
    
    def _get_timeout_seconds(self) -> int:
        raw_value = get_env("API_SISTEMA_ACME_TIMEOUT_SECONDS", default="30") or "30"

        try:
            timeout = int(raw_value)
        except ValueError as exc:
            raise ConfiguracaoException("API_SISTEMA_ACME_TIMEOUT_SECONDS invalido.") from exc
        
        if timeout <= 0:
            raise ConfiguracaoException("API_SISTEMA_ACME_TIMEOUT_SECONDS deve ser maior que zero.")
        
        return timeout
    
    def atualizar_ativo_template(self, id_template: int, ativo: bool, usuario_responsavel: str | None = None) -> dict:
        payload = {"ativo": bool(ativo)}
        if usuario_responsavel:
            payload["usuario_responsavel"] = usuario_responsavel

        return self._request(
            "PATCH",
            f"/monitoria-whatsapp/api/whatsapp/templates/{id_template}/ativo",
            json=payload,
        )
