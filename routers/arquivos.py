from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from fastapi.responses import Response

from src.application.services.arquivos_service import ArquivosService
from src.application.services.auth_service import AuthenticatedUser
from src.infrastructure.dependencies.access_groups import FILES_GROUPS
from src.infrastructure.dependencies.auth import require_any_group
from src.schemas.arquivos import ListaArquivosCompartilhadosResponse, NavegacaoArquivosResponse, UploadArquivosCompartilhadosResponse


router = APIRouter(prefix="/arquivos", tags=["arquivos"])


@router.get("", response_model=ListaArquivosCompartilhadosResponse, status_code=status.HTTP_200_OK)
def listar_arquivos(
    request: Request,
    caminho: str = Query(default=""),
    _: AuthenticatedUser = Depends(require_any_group(*FILES_GROUPS)),
) -> ListaArquivosCompartilhadosResponse:
    request.state.log_title = "Consulta de arquivos"
    return ArquivosService().listar_arquivos(caminho)


@router.get("/navegar", response_model=NavegacaoArquivosResponse, status_code=status.HTTP_200_OK)
def navegar_arquivos(
    request: Request,
    caminho: str = Query(default=""),
    _: AuthenticatedUser = Depends(require_any_group(*FILES_GROUPS)),
) -> NavegacaoArquivosResponse:
    request.state.log_title = "Navegacao de arquivos"
    return ArquivosService().navegar(caminho)


@router.post("/upload", response_model=UploadArquivosCompartilhadosResponse, status_code=status.HTTP_201_CREATED)
def carregar_arquivos(
    request: Request,
    arquivos: list[UploadFile] = File(...),
    pasta_destino: str = Form(""),
    current_user: AuthenticatedUser = Depends(require_any_group(*FILES_GROUPS)),
) -> UploadArquivosCompartilhadosResponse:
    request.state.log_title = "Upload de arquivos"
    host_origem = request.client.host if request.client else current_user.host
    return ArquivosService().carregar_arquivos(
        arquivos,
        pasta_destino,
        current_user=current_user,
        host_origem=host_origem,
    )


@router.get("/download", status_code=status.HTTP_200_OK)
def baixar_arquivo(
    request: Request,
    caminho_arquivo: str = Query(...),
    current_user: AuthenticatedUser = Depends(require_any_group(*FILES_GROUPS)),
) -> Response:
    request.state.log_title = "Download de arquivo"
    host_origem = request.client.host if request.client else current_user.host
    media_type, content_disposition, content = ArquivosService().baixar_arquivo(
        caminho_arquivo,
        current_user=current_user,
        host_origem=host_origem,
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )
