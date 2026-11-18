from pydantic import BaseModel, Field


class SolicitanteSchema(BaseModel):
    nm_colaborador: str = Field(..., description="Nome do colaborador solicitante")
    nm_login: str = Field(..., description="Login do colaborador solicitante")
    desc_funcao: str = Field(..., description="Funcao do solicitante")
    centro_custo: str = Field(..., description="Centro de custo do solicitante")


class PesquisaUsuarioRequest(BaseModel):
    cpf_usuario: str = Field(..., min_length=11, max_length=14)
    solicitante: SolicitanteSchema


class CpfRequest(BaseModel):
    cpf_usuario: str = Field(..., min_length=11, max_length=14)


class UsuarioPesquisaSchema(BaseModel):
    nm_colaborador: str
    nm_login_colaborador: str
    nu_cpf_colaborador: str
    funcao_colaborador: str
    centro_custo_colaborador: str
    status_usuario: str


class PesquisaUsuarioResponse(BaseModel):
    status: str
    mensagem: str
    usuario: UsuarioPesquisaSchema


class DesbloqueioRequest(BaseModel):
    cpf_usuario: str = Field(..., min_length=11, max_length=14)
    solicitante: SolicitanteSchema
    host: str | None = Field(default=None, description="Host/IP que realizou a acao")


class DesbloqueioResponse(BaseModel):
    status: str
    mensagem: str
    usuario: dict | None = None
