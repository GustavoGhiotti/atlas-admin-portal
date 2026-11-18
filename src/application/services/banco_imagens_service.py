from urllib.parse import quote

from fastapi import UploadFile

from src.infrastructure.external.fileshare.image_bank_client import ImageBankClient
from src.infrastructure.services.env_load import get_env
from src.schemas.banco_imagens import (
    AcaoArquivoResponse,
    ArquivoImagemResponse,
    ListaArquivosResponse,
)
from src.shared.exception import AtlasException


class BancoImagensService:
    def __init__(self) -> None:
        self.client = ImageBankClient()
        self.public_base_url = get_env("IMAGE_PUBLIC_BASE_URL", default=None)

    def listar_arquivos(self) -> ListaArquivosResponse:
        arquivos = self.client.list_files()
        payload = [self._to_response(arquivo) for arquivo in arquivos]
        return ListaArquivosResponse(status="sucesso", quantidade=len(payload), arquivos=payload)

    def carregar_arquivos(self, arquivos: list[UploadFile], pasta_destino: str = "") -> AcaoArquivoResponse:
        if not arquivos:
            raise AtlasException("Nenhum arquivo foi enviado.")

        resultado = self.client.save_files(arquivos, pasta_destino)
        payload = [self._to_response(arquivo) for arquivo in resultado]
        return AcaoArquivoResponse(
            status="sucesso",
            mensagem="Arquivo(s) carregado(s) com sucesso.",
            arquivos=payload,
        )

    def excluir_arquivo(self, caminho_arquivo: str) -> AcaoArquivoResponse:
        resultado = self.client.delete_file(caminho_arquivo)
        payload = [self._to_response(arquivo) for arquivo in resultado]
        return AcaoArquivoResponse(
            status="sucesso",
            mensagem="Arquivo deletado com sucesso.",
            arquivos=payload,
        )

    def mover_arquivo(self, caminho_arquivo: str, pasta_destino: str = "") -> AcaoArquivoResponse:
        resultado = self.client.move_file(caminho_arquivo, pasta_destino)
        payload = [self._to_response(arquivo) for arquivo in resultado]
        return AcaoArquivoResponse(
            status="sucesso",
            mensagem="Pasta do arquivo atualizada com sucesso.",
            arquivos=payload,
        )

    def _to_response(self, arquivo) -> ArquivoImagemResponse:
        public_url = None
        if self.public_base_url:
            caminho_publico = quote(arquivo.caminho_arquivo, safe="/")
            public_url = f"{self.public_base_url.rstrip('/')}/{caminho_publico}"
        return ArquivoImagemResponse(**arquivo.__dict__, url_publica=public_url)
