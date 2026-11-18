from fastapi import APIRouter, Depends, Query, status

from src.application.services.cargas_service import cargas_service
from src.infrastructure.dependencies.access_groups import CARGAS_GROUPS
from src.infrastructure.dependencies.auth import require_any_group


router = APIRouter(
    prefix="/cargas",
    tags=["cargas"],
    dependencies=[Depends(require_any_group(*CARGAS_GROUPS))],
)


@router.get("")
async def listar_cargas(
    data: str | None = Query(default=None),
    tarefa: str | None = Query(default=None),
    status_execucao: str | None = Query(default=None, alias="status"),
):
    return await cargas_service.listar_execucoes(tarefa=tarefa, status=status_execucao, data_referencia=data)


@router.post("/refresh", status_code=status.HTTP_202_ACCEPTED)
async def atualizar_cargas(data: str | None = Query(default=None)):
    await cargas_service.refresh_today(force=True, data_referencia=data)
    return {"status": "ok", "mensagem": "Atualizacao das cargas iniciada."}


@router.get("/recebimento")
async def listar_recebimento_cargas(
    data: str | None = Query(default=None),
    cedente: str | None = Query(default=None),
):
    return await cargas_service.listar_recebimentos(data_referencia=data, cedente=cedente)
