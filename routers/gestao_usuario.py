from fastapi import APIRouter, Depends, Request, status

from src.application.services.auth_service import AuthenticatedUser
from src.application.services.gestao_usuario_service import GestaoUsuarioService
from src.application.services.gestao_usuario_sync_service import gestao_usuario_sync_service
from src.infrastructure.dependencies.auth import require_any_group
from src.infrastructure.dependencies.access_groups import ADMIN_GROUPS
from src.schemas.gestao_usuario import (
    AtualizarPermissoesUsuarioRequest,
    GrupoPortalResponse,
    RegistrarUsuarioRequest,
    SincronizacaoUsuariosResponse,
    UsuarioPermissaoResponse,
    UsuarioPermissoesEfetivasResponse,
)


router = APIRouter(prefix="/gestao-usuarios", tags=["gestao-usuarios"])

admin_user = require_any_group(*ADMIN_GROUPS)


def _normalize_cpf(value: str) -> str:
    digits = "".join(char for char in value if char.isdigit())
    return digits.zfill(11) if digits else ""


@router.get("/grupos", response_model=list[GrupoPortalResponse], status_code=status.HTTP_200_OK)
def listar_grupos(
    request: Request,
    _: AuthenticatedUser = Depends(admin_user),
) -> list[GrupoPortalResponse]:
    request.state.log_title = "Listagem de grupos do portal"
    grupos = GestaoUsuarioService().listar_grupos()
    return [GrupoPortalResponse(id_grupo=grupo.id_grupo, nm_grupo=grupo.nm_grupo) for grupo in grupos]


@router.get("/sincronizacao/status", response_model=SincronizacaoUsuariosResponse, status_code=status.HTTP_200_OK)
def obter_status_sincronizacao_usuarios(
    request: Request,
    _: AuthenticatedUser = Depends(admin_user),
) -> SincronizacaoUsuariosResponse:
    request.state.log_title = "Status da sincronizacao automatica de usuarios"
    return SincronizacaoUsuariosResponse(**gestao_usuario_sync_service.status())


@router.post("/sincronizacao/executar", response_model=SincronizacaoUsuariosResponse, status_code=status.HTTP_200_OK)
async def executar_sincronizacao_usuarios(
    request: Request,
    _: AuthenticatedUser = Depends(admin_user),
) -> SincronizacaoUsuariosResponse:
    request.state.log_title = "Execucao manual da sincronizacao automatica de usuarios"
    await gestao_usuario_sync_service.sincronizar_agora()
    return SincronizacaoUsuariosResponse(**gestao_usuario_sync_service.status())


@router.post("/usuarios", status_code=status.HTTP_200_OK)
def registrar_usuario(
    request: Request,
    body: RegistrarUsuarioRequest,
    _: AuthenticatedUser = Depends(admin_user),
) -> dict[str, str]:
    request.state.log_title = "Registro de usuario do portal"
    mensagem = GestaoUsuarioService().registrar_usuario(
        login=body.nm_login.strip(),
        nome_colaborador=body.nome_colaborador.strip(),
        cpf_colaborador=_normalize_cpf(body.cpf_colaborador),
        email_colaborador=body.email_colaborador.strip(),
        senha_colaborador=body.senha_colaborador,
        confirmacao_senha=body.confirmacao_senha,
        id_grupo=body.id_grupo.strip(),
    )
    return {"status": "sucesso", "mensagem": mensagem}


@router.get("/usuarios/permissoes", response_model=list[UsuarioPermissaoResponse], status_code=status.HTTP_200_OK)
def listar_usuarios_permissoes(
    request: Request,
    _: AuthenticatedUser = Depends(admin_user),
) -> list[UsuarioPermissaoResponse]:
    request.state.log_title = "Listagem de usuarios e permissoes"
    usuarios = GestaoUsuarioService().listar_usuarios_permissoes()
    return [
        UsuarioPermissaoResponse(
            id_usuario=usuario.id_usuario,
            nm_login=usuario.nm_login,
            nm_colaborador=usuario.nm_colaborador,
            nu_cpf_colaborador=usuario.nu_cpf_colaborador,
            nm_funcao=usuario.nm_funcao,
            centro_custo=usuario.centro_custo,
            email=usuario.email,
            status=usuario.status,
            grupos=sorted(usuario.grupos.values()),
        )
        for usuario in usuarios
    ]


@router.put("/usuarios/{id_usuario}/permissoes", status_code=status.HTTP_200_OK)
def atualizar_permissoes_usuario(
    id_usuario: str,
    body: AtualizarPermissoesUsuarioRequest,
    request: Request,
    current_user: AuthenticatedUser = Depends(admin_user),
) -> dict[str, str]:
    request.state.log_title = "Atualizacao de permissoes de usuario"
    mensagem = GestaoUsuarioService().atualizar_acessos_colaborador(
        usuario_autenticado=current_user,
        id_usuario=id_usuario,
        email_usuario=body.email_usuario.strip(),
        permissoes_usuario=sorted(body.permissoes_usuario),
    )
    return {"status": "sucesso", "mensagem": mensagem}


@router.delete("/usuarios/{id_usuario}", status_code=status.HTTP_200_OK)
def excluir_usuario_manual(
    id_usuario: str,
    request: Request,
    _: AuthenticatedUser = Depends(admin_user),
) -> dict[str, str]:
    request.state.log_title = "Exclusão de usuário manual do portal"
    mensagem = GestaoUsuarioService().excluir_usuario_manual(id_usuario)
    return {"status": "sucesso", "mensagem": mensagem}


@router.get(
    "/usuarios/{id_usuario}/permissoes-efetivas",
    response_model=UsuarioPermissoesEfetivasResponse,
    status_code=status.HTTP_200_OK,
)
def obter_permissoes_efetivas_usuario(
    id_usuario: str,
    request: Request,
    _: AuthenticatedUser = Depends(admin_user),
) -> UsuarioPermissoesEfetivasResponse:
    request.state.log_title = "Consulta de permissoes efetivas de usuario"
    return GestaoUsuarioService().obter_permissoes_efetivas(id_usuario)