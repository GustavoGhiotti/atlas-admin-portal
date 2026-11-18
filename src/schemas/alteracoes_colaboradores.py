from pydantic import BaseModel


class AtualizarColaboradorRequest(BaseModel):
    funcao: str
    id_centro_custo: str
    centro_custo: str
    centro_custo_2: str | None = None
    user_atualizacao: str


class AtualizarColaboradorLoteRequest(BaseModel):
    cpfs: list[str]
    funcao: str
    id_centro_custo: str
    centro_custo: str
    centro_custo_2: str | None = None
    responsavel: str


class StatusSincroniaRequest(BaseModel):
    status: int


class CriarCentroCustoTemporarioRequest(BaseModel):
    id_centro_custo: str
    centro_custo: str
    responsavel: str


class AtualizarCentroCusto2OperacionalRequest(BaseModel):
    centro_custo_2: str
    responsavel: str
