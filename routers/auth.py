from fastapi import APIRouter, Depends, Request, status

from src.application.services.auth_service import AuthService, AuthenticatedUser
from src.application.services.gestao_usuario_service import GestaoUsuarioService
from src.application.services.recuperacao_senha_service import RecuperacaoSenhaService
from src.infrastructure.dependencies.auth import get_current_user
from src.schemas.auth import (
    ChangeEmailRequest,
    ChangePasswordRequest,
    FirstAccessRequest,
    LoginRequest,
    LoginResponse,
    PasswordResetConfirmRequest,
    PasswordResetLookupResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    SessionResponse,
    UserLookupResponse,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(request: Request, body: LoginRequest) -> LoginResponse:
    request.state.log_title = "Login do portal"
    request.state.nm_login = (body.username or "").upper()
    host = request.client.host if request.client else "unknown"
    return AuthService().login(body, host)


@router.get("/me", response_model=SessionResponse, status_code=status.HTTP_200_OK)
def me(request: Request, current_user: AuthenticatedUser = Depends(get_current_user)) -> SessionResponse:
    request.state.log_title = "Validacao de sessao"
    return SessionResponse(status="sucesso", usuario=current_user.to_response())


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(request: Request, _: AuthenticatedUser = Depends(get_current_user)) -> dict[str, str]:
    request.state.log_title = "Logout do portal"
    service = AuthService()
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return service.logout(token)


@router.post("/password-reset", response_model=PasswordResetResponse, status_code=status.HTTP_200_OK)
def password_reset(request: Request, body: PasswordResetRequest) -> PasswordResetResponse:
    request.state.log_title = "Recuperacao de senha"
    digits = "".join(char for char in body.cpf if char.isdigit())
    resultado = RecuperacaoSenhaService().solicitar_recuperacao_por_cpf(digits.zfill(11))
    return PasswordResetResponse(
        status="sucesso",
        mensagem=resultado.mensagem,
        email_destino=resultado.email_destino,
    )


@router.post("/password-reset/lookup", response_model=PasswordResetLookupResponse, status_code=status.HTTP_200_OK)
def password_reset_lookup(request: Request, body: PasswordResetRequest) -> PasswordResetLookupResponse:
    request.state.log_title = "Consulta de recuperacao de senha"
    digits = "".join(char for char in body.cpf if char.isdigit())
    resultado = RecuperacaoSenhaService().consultar_recuperacao_por_cpf(digits.zfill(11))
    return PasswordResetLookupResponse(
        status="sucesso",
        mensagem=resultado.mensagem,
        nm_login=resultado.nm_login,
        email=resultado.email,
    )


@router.post("/user-lookup", response_model=UserLookupResponse, status_code=status.HTTP_200_OK)
def user_lookup(request: Request, body: PasswordResetRequest) -> UserLookupResponse:
    request.state.log_title = "Consulta de usuario por CPF"
    digits = "".join(char for char in body.cpf if char.isdigit())
    resultado = RecuperacaoSenhaService().consultar_usuario_por_cpf(digits.zfill(11))
    return UserLookupResponse(
        status="sucesso",
        mensagem=resultado.mensagem,
        nm_login=resultado.nm_login,
        email=resultado.email,
    )


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
def password_reset_confirm(request: Request, body: PasswordResetConfirmRequest) -> dict[str, str]:
    request.state.log_title = "Confirmacao de recuperacao de senha"
    digits = "".join(char for char in body.cpf if char.isdigit())
    mensagem = RecuperacaoSenhaService().redefinir_senha_com_token(
        cpf_colaborador=digits.zfill(11),
        token=body.token,
        nova_senha=body.nova_senha,
        confirmacao_nova_senha=body.confirmacao_nova_senha,
    )
    return {"status": "sucesso", "mensagem": mensagem}


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, str]:
    request.state.log_title = "Alteracao de senha"
    mensagem = GestaoUsuarioService().alterar_senha(
        login=current_user.nm_login,
        nova_senha=body.nova_senha,
        confirmacao_nova_senha=body.confirmacao_nova_senha,
    )
    return {"status": "sucesso", "mensagem": mensagem}


@router.post("/change-email", status_code=status.HTTP_200_OK)
def change_email(
    request: Request,
    body: ChangeEmailRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, str]:
    request.state.log_title = "Alteracao de email"
    mensagem = GestaoUsuarioService().alterar_email_proprio(
        login=current_user.nm_login,
        email=body.email,
    )
    return {"status": "sucesso", "mensagem": mensagem, "email": body.email.strip().lower()}


@router.post("/first-access", status_code=status.HTTP_200_OK)
def first_access(
    request: Request,
    body: FirstAccessRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, str]:
    request.state.log_title = "Conclusao de primeiro acesso"
    mensagem = GestaoUsuarioService().concluir_primeiro_acesso(
        login=current_user.nm_login,
        email=body.email,
        nova_senha=body.nova_senha,
        confirmacao_nova_senha=body.confirmacao_nova_senha,
    )
    return {"status": "sucesso", "mensagem": mensagem, "email": body.email.strip().lower()}
