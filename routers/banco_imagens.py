from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status

from src.application.services.banco_imagens_service import BancoImagensService
from src.application.services.auth_service import AuthenticatedUser
from src.infrastructure.dependencies.auth import require_any_group
from src.infrastructure.dependencies.access_groups import IMAGES_GROUPS
from src.schemas.banco_imagens import (
    AcaoArquivoResponse,
    ListaArquivosResponse,
)


router = APIRouter(prefix="/banco-imagens", tags=["banco-imagens"])


@router.get("", response_model=ListaArquivosResponse, status_code=status.HTTP_200_OK)
def listar_arquivos(
    request: Request,
    _: AuthenticatedUser = Depends(require_any_group(*IMAGES_GROUPS)),
) -> ListaArquivosResponse:
    request.state.log_title = "Listagem de imagens"
    return BancoImagensService().listar_arquivos()


@router.post("/upload", response_model=AcaoArquivoResponse, status_code=status.HTTP_201_CREATED)
def carregar_arquivos(
    request: Request,
    arquivos: list[UploadFile] = File(...),
    pasta_destino: str = Form(""),
    _: AuthenticatedUser = Depends(require_any_group(*IMAGES_GROUPS)),
) -> AcaoArquivoResponse:
    request.state.log_title = "Upload de imagens"
    return BancoImagensService().carregar_arquivos(arquivos, pasta_destino)


@router.delete("/{caminho_arquivo:path}", response_model=AcaoArquivoResponse, status_code=status.HTTP_200_OK)
def excluir_arquivo(
    request: Request,
    caminho_arquivo: str,
    _: AuthenticatedUser = Depends(require_any_group(*IMAGES_GROUPS)),
) -> AcaoArquivoResponse:
    request.state.log_title = "Exclusao de imagem"
    return BancoImagensService().excluir_arquivo(caminho_arquivo)


@router.post("/{caminho_arquivo:path}/mover", response_model=AcaoArquivoResponse, status_code=status.HTTP_200_OK)
def mover_arquivo(
    request: Request,
    caminho_arquivo: str,
    pasta_destino: str = Form(""),
    _: AuthenticatedUser = Depends(require_any_group(*IMAGES_GROUPS)),
) -> AcaoArquivoResponse:
    request.state.log_title = "Movimentacao de imagem"
    return BancoImagensService().mover_arquivo(caminho_arquivo, pasta_destino)
