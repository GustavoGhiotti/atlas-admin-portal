from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class UsuarioAutenticadoResponse(BaseModel):
    nm_login: str
    nm_colaborador: str
    nu_cpf_colaborador: str
    nm_funcao: str
    desc_funcao: str
    centro_custo: str
    email: str | None = None
    status: int
    grupos: list[str]


class LoginResponse(BaseModel):
    status: str
    mensagem: str
    token: str
    usuario: UsuarioAutenticadoResponse


class SessionResponse(BaseModel):
    status: str
    usuario: UsuarioAutenticadoResponse


class PasswordResetRequest(BaseModel):
    cpf: str = Field(..., min_length=11, max_length=14)


class PasswordResetResponse(BaseModel):
    status: str
    mensagem: str
    email_destino: str


class PasswordResetLookupResponse(BaseModel):
    status: str
    mensagem: str
    nm_login: str
    email: str


class UserLookupResponse(BaseModel):
    status: str
    mensagem: str
    nm_login: str
    email: str | None = None


class PasswordResetConfirmRequest(BaseModel):
    cpf: str = Field(..., min_length=11, max_length=14)
    token: str = Field(..., min_length=1)
    nova_senha: str = Field(..., min_length=1)
    confirmacao_nova_senha: str = Field(..., min_length=1)


class ChangePasswordRequest(BaseModel):
    nova_senha: str = Field(..., min_length=1)
    confirmacao_nova_senha: str = Field(..., min_length=1)


class ChangeEmailRequest(BaseModel):
    email: str = Field(..., min_length=1)


class FirstAccessRequest(BaseModel):
    email: str = Field(..., min_length=1)
    nova_senha: str = Field(..., min_length=1)
    confirmacao_nova_senha: str = Field(..., min_length=1)
