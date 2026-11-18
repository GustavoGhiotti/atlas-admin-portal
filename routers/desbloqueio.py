from fastapi import APIRouter, Depends, Request, status

from src.application.services.auth_service import AuthenticatedUser
from src.application.services.desbloqueio_service import DesbloqueioUsuarioService
from src.infrastructure.dependencies.auth import require_any_group
from src.infrastructure.dependencies.access_groups import USERS_GROUPS
from src.schemas.desbloqueio import (
    CpfRequest,
    DesbloqueioRequest,
    DesbloqueioResponse,
    PesquisaUsuarioRequest,
    PesquisaUsuarioResponse,
)


router = APIRouter(prefix="/desbloqueio-usuario", tags=["desbloqueio-usuario"])


@router.post("/pesquisar", response_model=PesquisaUsuarioResponse, status_code=status.HTTP_200_OK)
def pesquisar_usuario(
    request: Request,
    body: CpfRequest,
    current_user: AuthenticatedUser = Depends(require_any_group(*USERS_GROUPS)),
) -> PesquisaUsuarioResponse:
    request.state.log_title = "Pesquisa de usuario para desbloqueio"
    return DesbloqueioUsuarioService().pesquisar_usuario_por_cpf(body.cpf_usuario, current_user)


@router.post("/executar", response_model=DesbloqueioResponse, status_code=status.HTTP_200_OK)
def desbloquear_usuario(
    request: Request,
    body: CpfRequest,
    current_user: AuthenticatedUser = Depends(require_any_group(*USERS_GROUPS)),
) -> DesbloqueioResponse:
    request.state.log_title = "Desbloqueio de usuario"
    return DesbloqueioUsuarioService().desbloquear_usuario_por_cpf(body.cpf_usuario, current_user)
