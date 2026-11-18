from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.application.services.auth_service import AuthService, AuthenticatedUser
from src.shared.exception import AtlasException


security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> AuthenticatedUser:
    if not credentials:
        raise AtlasException("Autenticacao obrigatoria.", status_code=401)
    return AuthService().authenticate_token(credentials.credentials)


def require_any_group(*allowed_groups: str):
    def dependency(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if not any(group in current_user.grupos for group in allowed_groups):
            raise AtlasException("Usuario sem permissao para acessar este modulo.", status_code=403)
        return current_user

    return dependency


def require_any_group_or_login(allowed_groups: tuple[str, ...], allowed_logins: tuple[str, ...]):
    allowed_login_set = {login.upper() for login in allowed_logins}

    def dependency(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        login = (current_user.nm_login or "").strip().upper()
        has_group = any(group in current_user.grupos for group in allowed_groups)
        has_login = login in allowed_login_set
        if not (has_group or has_login):
            raise AtlasException("Usuario sem permissao para acessar este modulo.", status_code=403)
        return current_user

    return dependency
