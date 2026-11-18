from dataclasses import dataclass
from secrets import token_urlsafe

from src.infrastructure.repositories import AuthRepository
from src.infrastructure.security.token_service import TokenService
from src.infrastructure.services.env_load import get_env
from src.schemas.auth import (
    LoginRequest,
    LoginResponse,
    SessionResponse,
    UsuarioAutenticadoResponse,
)
from src.shared.exception import AtlasException


@dataclass
class AuthenticatedUser:
    nm_login: str
    nm_colaborador: str
    nu_cpf_colaborador: str
    nm_funcao: str
    desc_funcao: str
    centro_custo: str
    email: str | None
    status: int
    grupos: list[str]
    host: str
    session_key: str

    def to_response(self) -> UsuarioAutenticadoResponse:
        return UsuarioAutenticadoResponse(
            nm_login=self.nm_login,
            nm_colaborador=self.nm_colaborador,
            nu_cpf_colaborador=self.nu_cpf_colaborador,
            nm_funcao=self.nm_funcao,
            desc_funcao=self.desc_funcao,
            centro_custo=self.centro_custo,
            email=self.email,
            status=self.status,
            grupos=self.grupos,
        )


class AuthService:
    # Throttle da sessao: so atualiza o DT_ACESSO no TB_CONEXOES a cada N segundos.
    # Antes o UPDATE ocorria a cada requisicao (escrita a toa no banco de login).
    SESSION_TOUCH_THROTTLE_SECONDS = 60

    def __init__(self) -> None:
        self.repository = AuthRepository()
        self.token_service = TokenService()
        self.session_idle_timeout_minutes = self._get_session_idle_timeout_minutes()

    def login(self, body: LoginRequest, host: str) -> LoginResponse:
        login = body.username.upper()
        session_key = self._build_session_key(host)
        user_row = self._validate_credentials(login, body.password, session_key)
        groups = self._get_groups(login)

        user = AuthenticatedUser(
            nm_login=user_row[0],
            nm_colaborador=user_row[1],
            nu_cpf_colaborador=user_row[2],
            nm_funcao=user_row[3],
            desc_funcao=user_row[4],
            centro_custo=user_row[5],
            email=user_row[6],
            status=user_row[8],
            grupos=groups,
            host=host,
            session_key=session_key,
        )

        token = self.token_service.create(
            {
                "nm_login": user.nm_login,
                "host": user.host,
                "session_key": user.session_key,
                "grupos": user.grupos,
                "nu_cpf_colaborador": user.nu_cpf_colaborador,
                "nm_colaborador": user.nm_colaborador,
                "nm_funcao": user.nm_funcao,
                "desc_funcao": user.desc_funcao,
                "centro_custo": user.centro_custo,
                "email": user.email,
                "status": user.status,
            }
        )

        mensagem = "Login realizado com sucesso."
        if not (user.email or "").strip():
            mensagem = "Login realizado. Usuario em primeiro acesso."

        return LoginResponse(
            status="sucesso",
            mensagem=mensagem,
            token=token,
            usuario=user.to_response(),
        )

    def me(self, token: str) -> SessionResponse:
        payload = self.token_service.decode(token)
        session_key = self._get_session_key(payload)
        client_host = str(payload.get("host") or "unknown")
        self._assert_authenticated(payload["nm_login"], session_key)
        user = self._build_authenticated_user(payload["nm_login"], client_host, session_key)
        return SessionResponse(status="sucesso", usuario=user.to_response())

    def logout(self, token: str) -> dict[str, str]:
        payload = self.token_service.decode(token)
        self.repository.deletar_conexao_por_login_host(payload["nm_login"], self._get_session_key(payload))
        return {"status": "sucesso", "mensagem": "Logout realizado com sucesso."}

    def authenticate_token(self, token: str) -> AuthenticatedUser:
        payload = self.token_service.decode(token)
        session_key = self._get_session_key(payload)
        client_host = str(payload.get("host") or "unknown")
        self._assert_authenticated(payload["nm_login"], session_key)
        return self._build_authenticated_user(payload["nm_login"], client_host, session_key)

    def _validate_credentials(self, login: str, password: str, session_key: str):
        result = self.repository.buscar_usuario_por_login_senha(login)
        if not result:
            raise AtlasException("Usuario ou senha invalidos.", status_code=401)

        user_row = result[0]
        senha_banco = self._normalize_password_value(user_row[9])
        if senha_banco != password:
            raise AtlasException("Usuario ou senha invalidos.", status_code=401)

        self._register_connection(login, session_key)
        return user_row

    def _normalize_password_value(self, value: object) -> str:
        if value is None:
            return ""
        if isinstance(value, bytes):
            try:
                return value.decode("utf-8").rstrip("\x00")
            except UnicodeDecodeError:
                return value.decode("latin-1", errors="ignore").rstrip("\x00")
        return str(value).rstrip("\x00")

    def _register_connection(self, login: str, session_key: str) -> None:
        self.repository.deletar_conexoes_expiradas_por_login(login, self.session_idle_timeout_minutes)
        self.repository.deletar_conexao_por_login(login)
        self.repository.inserir_conexao(login, session_key)

    def _get_groups(self, login: str) -> list[str]:
        result = self.repository.listar_grupos(login)
        return [row[0] for row in result]

    def _build_authenticated_user(self, login: str, host: str, session_key: str) -> AuthenticatedUser:
        result = self.repository.buscar_usuario_por_login(login)
        if not result:
            raise AtlasException("Sessao invalida. Usuario nao encontrado.", status_code=401)

        user_row = result[0]
        groups = self._get_groups(login)
        return AuthenticatedUser(
            nm_login=user_row[0],
            nm_colaborador=user_row[1],
            nu_cpf_colaborador=user_row[2],
            nm_funcao=user_row[3],
            desc_funcao=user_row[4],
            centro_custo=user_row[5],
            email=user_row[6],
            status=user_row[8],
            grupos=groups,
            host=host,
            session_key=session_key,
        )

    def _assert_authenticated(self, login: str, host: str) -> None:
        result = self.repository.buscar_conexao_ativa(login, host)
        if not result:
            raise AtlasException("Sessao invalida. Faca login novamente.", status_code=401)

        dt_acesso = result[0][2]
        if dt_acesso is None or self._is_session_expired(dt_acesso):
            self.repository.deletar_conexao_expirada(login, host, self.session_idle_timeout_minutes)
            raise AtlasException("Sessao expirada por inatividade. Faca login novamente.", status_code=401)

        segundos_desde_acesso = (self.token_service.now() - dt_acesso).total_seconds()
        if segundos_desde_acesso >= self.SESSION_TOUCH_THROTTLE_SECONDS:
            self.repository.atualizar_dt_acesso(login, host)

    def _is_session_expired(self, dt_acesso) -> bool:
        return (self.token_service.now() - dt_acesso).total_seconds() > self.session_idle_timeout_minutes * 60

    def _get_session_idle_timeout_minutes(self) -> int:
        raw_value = (get_env("SESSION_IDLE_TIMEOUT_MINUTES", default="30") or "30").strip()
        try:
            timeout_minutes = int(raw_value)
        except ValueError as exc:
            raise AtlasException("Variavel SESSION_IDLE_TIMEOUT_MINUTES invalida.", status_code=500) from exc

        if timeout_minutes <= 0:
            raise AtlasException("Variavel SESSION_IDLE_TIMEOUT_MINUTES deve ser maior que zero.", status_code=500)

        return timeout_minutes

    def _build_session_key(self, host: str) -> str:
        return f"{host}|{token_urlsafe(16)}"

    def _get_session_key(self, payload: dict) -> str:
        return str(payload.get("session_key") or payload.get("host") or "").strip()
