from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.application.services.numeros_infobip_service import NumerosInfobipService
from src.infrastructure.dependencies.access_groups import ANALYTICS_GROUPS
from src.infrastructure.dependencies.auth import require_any_group


router = APIRouter(
    prefix="/whatsapp/infobip/numeros",
    tags=["whatsapp-infobip-numeros"],
    dependencies=[Depends(require_any_group(*ANALYTICS_GROUPS))],
)


class AtualizarNumeroInfobipPayload(BaseModel):
    ativo: int = Field(ge=0, le=1)
    carteiras_permitidas: list[str] = Field(min_length=1)


@router.get("")
def listar_numeros():
    return NumerosInfobipService().listar_numeros()


@router.get("/carteiras")
def listar_carteiras_permitidas():
    return NumerosInfobipService().listar_carteiras_permitidas()


@router.put("/{id_registro}")
def atualizar_numero(id_registro: int, payload: AtualizarNumeroInfobipPayload):
    return NumerosInfobipService().atualizar_numero(
        id_registro=id_registro,
        ativo=payload.ativo,
        carteiras_permitidas=payload.carteiras_permitidas,
    )
