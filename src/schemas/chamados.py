from pydantic import BaseModel, Field


class ChamadoResponse(BaseModel):
    id: int
    titulo: str
    descricao: str
    status: str
    prioridade: str
    criado_em: str
    atualizado_em: str
    cpf_solicitante: str
    solicitante: str
    setor_solicitante: str
    possui_evidencia: bool
    evidencia_nome: str
    evidencia_mime: str
    evidencia_tamanho: int


class ResumoChamadosResponse(BaseModel):
    total: int
    abertos: int
    em_andamento: int
    fechados: int


class ListaChamadosResponse(BaseModel):
    itens: list[ChamadoResponse]
    resumo: ResumoChamadosResponse
    modo_gestao: bool


class AtualizarChamadoRequest(BaseModel):
    status: str | None = None
    prioridade: str | None = None
    descricao: str | None = None


class DemandaAreaRequest(BaseModel):
    tp_area: str = Field(..., min_length=1, max_length=255)
    nm_area: str = Field(..., min_length=1, max_length=255)


class AtualizarDemandaAreaRequest(BaseModel):
    tp_area: str | None = Field(default=None, max_length=255)
    nm_area: str | None = Field(default=None, max_length=255)


class DemandaAreaResponse(BaseModel):
    id_area: int
    tp_area: str
    nm_area: str


class ListaDemandasAreasResponse(BaseModel):
    itens: list[DemandaAreaResponse]
    total: int


class DemandaPlataformaRequest(BaseModel):
    nm_plataforma: str = Field(..., min_length=1, max_length=255)


class AtualizarDemandaPlataformaRequest(BaseModel):
    nm_plataforma: str | None = Field(default=None, max_length=255)


class DemandaPlataformaResponse(BaseModel):
    id_plataforma: int
    nm_plataforma: str


class ListaDemandasPlataformasResponse(BaseModel):
    itens: list[DemandaPlataformaResponse]
    total: int


class DemandaTipoSolicitacaoRequest(BaseModel):
    nm_tipo_solicitacao: str = Field(..., min_length=1, max_length=255)


class AtualizarDemandaTipoSolicitacaoRequest(BaseModel):
    nm_tipo_solicitacao: str | None = Field(default=None, max_length=255)


class DemandaTipoSolicitacaoResponse(BaseModel):
    id_tipo_solicitacao: int
    nm_tipo_solicitacao: str


class ListaDemandasTipoSolicitacaoResponse(BaseModel):
    itens: list[DemandaTipoSolicitacaoResponse]
    total: int
