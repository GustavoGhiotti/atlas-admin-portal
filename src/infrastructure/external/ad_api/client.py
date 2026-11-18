import base64
import json
from urllib import error, request

from src.infrastructure.services.env_load import get_env
from src.shared.exception import ConfiguracaoException, IntegracaoException


class ActiveDirectoryApiClient:
    def __init__(self) -> None:
        self.base_url = (get_env("AD_API_BASE_URL", required=True) or "").rstrip("/")
        self.username = get_env("AD_API_USER", required=True)
        self.password = get_env("AD_API_PASSWORD", required=True)
        self.token_path = get_env("AD_API_TOKEN_PATH", "/auth/token") or "/auth/token"
        self.unlock_path = get_env("AD_API_UNLOCK_PATH", "/ad/desbloqueiaUsuario") or "/ad/desbloqueiaUsuario"
        timeout = get_env("AD_API_TIMEOUT_SECONDS", "30") or "30"
        try:
            self.timeout = max(1, int(timeout))
        except ValueError as exc:
            raise ConfiguracaoException("Variavel AD_API_TIMEOUT_SECONDS invalida.") from exc

    def desbloquear_usuario(
        self,
        user_dn: str,
        nm_login: str,
        nm_colaborador: str,
        senha: str,
        login_solicitante: str,
        host: str | None,
        cpf: str | None = None,
    ) -> dict[str, object]:
        token = self.obterToken()
        payload = {
            "userDn": user_dn,
            "nmLogin": nm_login,
            "nmColaborador": nm_colaborador,
            "senha": senha,
            "loginSolicitante": login_solicitante,
            "host": host or "",
        }
        
        if cpf:
            payload["cpf"] = "".join(ch for ch in str(cpf) if ch.isdigit())
        return self.postJson(self.unlock_path, payload, token)

    def obterToken(self) -> str:
        auth_header = self.buildBasicAuth(self.username or "", self.password or "")
        url = f"{self.base_url}{self.token_path}"
        req = request.Request(url, method="GET", headers={"Authorization": auth_header})

        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = self.decodeError(exc)
            raise IntegracaoException(f"Falha ao autenticar na API de Active Directory. Detalhe: {detail}") from exc
        except error.URLError as exc:
            raise IntegracaoException(f"Falha ao conectar na API de Active Directory. Detalhe: {exc.reason}") from exc

        token = str(data.get("token") or "").strip()
        if not token:
            raise IntegracaoException("API de Active Directory nao retornou token de autenticacao.")
        return token

    def postJson(self, path: str, payload: dict[str, object], token: str) -> dict[str, object]:
        url = f"{self.base_url}{path}"
        req = request.Request(
            url,
            method="POST",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )

        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = self.decodeError(exc)
            raise IntegracaoException(f"Falha na API de desbloqueio do Active Directory. Detalhe: {detail}") from exc
        except error.URLError as exc:
            raise IntegracaoException(f"Falha ao conectar na API de desbloqueio do Active Directory. Detalhe: {exc.reason}") from exc

    def buildBasicAuth(self, username: str, password: str) -> str:
        raw = f"{username}:{password}".encode("utf-8")
        return f"Basic {base64.b64encode(raw).decode('ascii')}"

    def decodeError(self, exc: error.HTTPError) -> str:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except Exception:
            payload = {}
        return str(payload.get("erro") or payload.get("error") or payload.get("message") or exc.reason)
