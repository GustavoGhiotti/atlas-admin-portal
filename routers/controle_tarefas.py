from fastapi import APIRouter, BackgroundTasks, Depends, Request, status

from src.application.services.auth_service import AuthenticatedUser
from src.application.services.controle_tarefas_service import ControleTarefasService
from src.infrastructure.dependencies.access_groups import CONTROL_TASKS_GROUPS
from src.infrastructure.dependencies.auth import get_current_user, require_any_group
from src.schemas.controle_tarefas import AcaoTaskRequest, AcaoTaskResponse, ListaHistoricoTaskResponse, ListaTasksResponse
from src.shared.exception import AtlasException


router = APIRouter(
    prefix="/controle-tarefas",
    tags=["controle-tarefas"],
    dependencies=[Depends(require_any_group(*CONTROL_TASKS_GROUPS))],
)


@router.get("", response_model=ListaTasksResponse, status_code=status.HTTP_200_OK)
def listar_tarefas(request: Request) -> ListaTasksResponse:
    request.state.log_title = "Listagem de tarefas monitoradas"
    return ListaTasksResponse(**ControleTarefasService().listar_tarefas())


@router.post("/acao/{acao}", response_model=AcaoTaskResponse, status_code=status.HTTP_202_ACCEPTED)
def executar_acao(
    request: Request,
    background_tasks: BackgroundTasks,
    acao: str,
    body: AcaoTaskRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AcaoTaskResponse:
    request.state.log_title = f"Acao em tarefa monitorada: {acao}"
    if acao not in {"executar", "finalizar", "habilitar", "desabilitar"}:
        raise AtlasException("Acao de tarefa invalida.", status_code=400)

    service = ControleTarefasService()
    resolved_task_id = body.task_id or service.buscar_task_id(body.task_path, body.task_name)
    background_tasks.add_task(
        service.executar_acao_em_segundo_plano,
        resolved_task_id,
        acao,
        current_user.nm_colaborador,
        body.task_path,
        body.task_name,
    )
    return AcaoTaskResponse(status="accepted", mensagem="Solicitacao enviada para processamento.")


@router.get("/historico", response_model=ListaHistoricoTaskResponse, status_code=status.HTTP_200_OK)
def listar_historico(request: Request, task_path: str, task_name: str) -> ListaHistoricoTaskResponse:
    request.state.log_title = "Historico de tarefa monitorada"
    return ListaHistoricoTaskResponse(**ControleTarefasService().listar_historico(task_path, task_name))
