from fastapi import APIRouter, Depends, Query, Request, status

from src.application.services.processos_service import ProcessosService
from src.infrastructure.dependencies.access_groups import CONTROL_TASKS_GROUPS
from src.infrastructure.dependencies.auth import require_any_group
from src.schemas.processos import ListaProcessosResponse


router = APIRouter(
    prefix="/processos",
    tags=["processos"],
    dependencies=[Depends(require_any_group(*CONTROL_TASKS_GROUPS))],
)


@router.get("", response_model=ListaProcessosResponse, status_code=status.HTTP_200_OK)
def listar_processos(
    request: Request,
    login: str | None = Query(default=None),
    somente_usuario: bool = Query(default=True),
) -> ListaProcessosResponse:
    request.state.log_title = "Listagem de processos ativos do banco"
    return ListaProcessosResponse(**ProcessosService().listar_processos_ativos(login=login, somente_usuario=somente_usuario))
