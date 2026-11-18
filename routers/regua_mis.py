from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status

from src.application.services.regua_mis_service import ReguaMISService
from src.infrastructure.dependencies.access_groups import FILES_GROUPS
from src.infrastructure.dependencies.auth import require_any_group
from src.schemas.regua_mis import (
    AtualizarReguaCarteiraRequest,
    AtualizarReguaCarteiraResponse,
    ListaReguaCarteirasResponse,
)


router = APIRouter(
    prefix="/regua-mis",
    tags=["regua-mis"],
    dependencies=[Depends(require_any_group(*FILES_GROUPS))],
)


@router.get(
    "/carteiras",
    response_model=ListaReguaCarteirasResponse,
    status_code=status.HTTP_200_OK,
)
def listar_carteiras_regua_mis(
    request: Request,
) -> ListaReguaCarteirasResponse:
    request.state.log_title = "Listagem de carteiras da Regua MIS"

    resultado = ReguaMISService().listar()

    return ListaReguaCarteirasResponse.model_validate(resultado)


@router.put(
    "/carteiras/{id_carteira}",
    response_model=AtualizarReguaCarteiraResponse,
    status_code=status.HTTP_200_OK,
)
def atualizar_carteira_regua_mis(
    id_carteira: int,
    payload: AtualizarReguaCarteiraRequest,
    request: Request,
) -> AtualizarReguaCarteiraResponse:
    request.state.log_title = "Atualizacao de carteira da Regua MIS"

    resultado = ReguaMISService().atualizar(
        id_carteira=id_carteira,
        dias_abertura=payload.dias_abertura,
    )

    return AtualizarReguaCarteiraResponse.model_validate(resultado)
