from __future__ import annotations

from pydantic import BaseModel, Field


class ReguaCarteiraItem(BaseModel):
    ID_CARTEIRA: int
    NOME_CARTEIRA: str
    DIAS_ABERTURA: int


class ListaReguaCarteirasResponse(BaseModel):
    status: str
    quantidade: int
    carteiras: list[ReguaCarteiraItem]


class AtualizarReguaCarteiraRequest(BaseModel):
    dias_abertura: int = Field(..., ge=0)


class AtualizarReguaCarteiraResponse(BaseModel):
    status: str
    mensagem: str
    id_carteira: int | None = None
    dias_abertura: int | None = None
