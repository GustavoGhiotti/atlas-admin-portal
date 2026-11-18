from pydantic import BaseModel, Field


AGENDA_LONG_TEXT_MAX_LENGTH = 60000


class AgendaPendenciaRequest(BaseModel):
    id: int | None = None
    descricao: str = Field(..., min_length=1, max_length=4000)
    responsavel: str | None = Field(default=None, max_length=150)
    observacao: str | None = Field(default=None, max_length=4000)
    status_pendencia: str | None = Field(default=None, max_length=20)
    login_resolucao: str | None = Field(default=None, max_length=100)
    data_resolucao: str | None = None


class AgendaPendenciaResponse(BaseModel):
    id: int | None = None
    descricao: str
    responsavel: str | None = None
    observacao: str | None = None
    status_pendencia: str = "PENDENTE"
    login_resolucao: str | None = None
    data_resolucao: str | None = None


class AgendaParticipanteRequest(BaseModel):
    tipo: str = Field(..., min_length=1, max_length=20)
    nome: str = Field(..., min_length=1, max_length=150)
    area_cargo: str | None = Field(default=None, max_length=150)
    observacao: str | None = Field(default=None, max_length=4000)


class AgendaParticipanteResponse(BaseModel):
    id: int | None = None
    tipo: str
    nome: str
    area_cargo: str | None = None
    observacao: str | None = None


class AgendaRequest(BaseModel):
    date: str = Field(..., min_length=10, max_length=10)
    horario_entrada: str = Field(..., min_length=5, max_length=8)
    horario_saida: str = Field(..., min_length=5, max_length=8)
    carteira: str = Field(..., min_length=1, max_length=150)
    local_visita: str | None = Field(default=None, max_length=150)
    motivo_visita: str = Field(..., min_length=1, max_length=AGENDA_LONG_TEXT_MAX_LENGTH)
    status_visita: str | None = Field(default=None, max_length=30)
    resumo_visita: str | None = Field(default=None, max_length=AGENDA_LONG_TEXT_MAX_LENGTH)
    o_que_foi_feito: str | None = Field(default=None, max_length=AGENDA_LONG_TEXT_MAX_LENGTH)
    pendencias: list[AgendaPendenciaRequest] = Field(default_factory=list)
    observacoes: str | None = Field(default=None, max_length=AGENDA_LONG_TEXT_MAX_LENGTH)
    participantes: list[AgendaParticipanteRequest] = Field(default_factory=list)


class AgendaResponse(BaseModel):
    id: int
    date: str
    horario_entrada: str
    horario_saida: str
    carteira: str
    local_visita: str | None = None
    motivo_visita: str
    status_visita: str
    resumo_visita: str | None = None
    o_que_foi_feito: str | None = None
    pendencias: list[AgendaPendenciaResponse] = Field(default_factory=list)
    observacoes: str | None = None
    participantes: list[AgendaParticipanteResponse] = Field(default_factory=list)
    login_criacao: str | None = None
    nome_criacao: str | None = None
    login_atualizacao: str | None = None
    login_exclusao: str | None = None
    login_envio_ata: str | None = None
    created_at: str
    updated_at: str | None = None
    data_envio_ata: str | None = None


class AgendaCarteiraResponse(BaseModel):
    id_cedente: int
    nome_cedente: str


class AgendaAtaEmailRequest(BaseModel):
    html: str = Field(..., min_length=1)


class AgendaPendenciaAbertaResponse(BaseModel):
    id: int
    agenda_id: int
    date: str
    horario_entrada: str
    horario_saida: str
    carteira: str
    motivo_visita: str
    descricao: str
    responsavel: str | None = None
    observacao: str | None = None
    status_pendencia: str = "PENDENTE"
    created_at: str | None = None
