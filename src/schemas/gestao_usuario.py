from pydantic import BaseModel, Field


class GrupoPortalResponse(BaseModel):
    id_grupo: int
    nm_grupo: str


class RegistrarUsuarioRequest(BaseModel):
    nm_login: str = Field(..., min_length=1)
    nome_colaborador: str = Field(..., min_length=1)
    cpf_colaborador: str = Field(..., min_length=11, max_length=14)
    email_colaborador: str = Field(..., min_length=1)
    senha_colaborador: str = Field(..., min_length=1)
    confirmacao_senha: str = Field(..., min_length=1)
    id_grupo: str = Field(..., min_length=1)


class AtualizarPermissoesUsuarioRequest(BaseModel):
    email_usuario: str = Field(default="")
    permissoes_usuario: list[str] = Field(default_factory=list)


class UsuarioPermissaoResponse(BaseModel):
    id_usuario: int
    nm_login: str
    nm_colaborador: str
    nu_cpf_colaborador: str
    nm_funcao: str
    centro_custo: str
    email: str | None = None
    status: str
    grupos: list[str]


class SincronizacaoUsuariosResponse(BaseModel):
    em_execucao: bool
    ultimo_processamento: str | None = None
    ultimo_erro: str | None = None
    intervalo_minutos: int
    ultimo_resumo: dict[str, int] = Field(default_factory=dict)


class UsuarioPermissaoEfetivaResponse(BaseModel):
    recurso: str
    descricao: str
    permitido: bool
    origem: list[str] = Field(default_factory=list)


class UsuarioPermissoesEfetivasResponse(BaseModel):
    usuario: UsuarioPermissaoResponse
    permissoes: list[UsuarioPermissaoEfetivaResponse]