from __future__ import annotations

import mimetypes
from pathlib import PureWindowsPath
from urllib.parse import quote

from fastapi import UploadFile

from src.application.services.auth_service import AuthenticatedUser
from src.domain.entities.evento_auditoria_arquivo import EventoAuditoriaArquivo
from src.infrastructure.repositories.arquivos_auditoria_repository import ArquivosAuditoriaRepository
from src.infrastructure.external.fileshare.shared_files_client import SharedFilesClient
from src.infrastructure.services.logger_config import setup_logger
from src.schemas.arquivos import (
    ArquivoCompartilhadoResponse,
    ListaArquivosCompartilhadosResponse,
    ItemCompartilhadoResponse,
    NavegacaoArquivosResponse,
    UploadArquivosCompartilhadosResponse,
)
from src.shared.exception import AtlasException


class ArquivosService:
    def __init__(self) -> None:
        self.client = SharedFilesClient()
        self.auditoria_repository = ArquivosAuditoriaRepository()
        self.logger = setup_logger("atlas.arquivos.auditoria")

    def _validar_caminho_minimo(self, caminho: str, mensagem: str) -> str:
        caminho_normalizado = (caminho or "").strip().replace("\\", "/")
        partes = [parte for parte in caminho_normalizado[2:].split("/") if parte] if caminho_normalizado.startswith("//") else []
        if not partes:
            raise AtlasException(mensagem)
        return caminho_normalizado

    def _formatar_caminho_resposta(self, caminho: str = "") -> str:
        caminho_normalizado = (caminho or "").strip().replace("\\", "/")
        if not caminho_normalizado:
            return ""
        if caminho_normalizado.startswith("//"):
            caminho_sem_barras_finais = caminho_normalizado.rstrip("/")
            return f"//{caminho_sem_barras_finais.lstrip('/')}"
        return caminho_normalizado.strip("/")

    def _extrair_componentes_caminho(self, caminho_completo: str) -> tuple[str, str, str]:
        caminho_normalizado = self._formatar_caminho_resposta(caminho_completo)
        if not caminho_normalizado.startswith("//"):
            return "", "", ""

        partes = [parte for parte in caminho_normalizado[2:].split("/") if parte]
        servidor = partes[0] if len(partes) > 0 else ""
        compartilhamento = partes[1] if len(partes) > 1 else ""
        caminho_relativo = "/".join(partes[2:]) if len(partes) > 2 else ""
        return servidor, compartilhamento, caminho_relativo

    def _montar_evento_auditoria(
        self,
        tp_operacao: str,
        current_user: AuthenticatedUser,
        host_origem: str,
        caminho_informado: str,
        caminho_completo: str,
        nm_arquivo_original: str | None,
        tamanho_bytes: int | None,
    ) -> EventoAuditoriaArquivo:
        caminho_normalizado = self._formatar_caminho_resposta(caminho_completo)
        servidor, compartilhamento, caminho_relativo = self._extrair_componentes_caminho(caminho_normalizado)
        nome_arquivo = PureWindowsPath(caminho_normalizado.replace("/", "\\")).name
        extensao = PureWindowsPath(nome_arquivo).suffix
        return EventoAuditoriaArquivo(
            tp_operacao=tp_operacao,
            nm_login=current_user.nm_login,
            nm_colaborador=current_user.nm_colaborador,
            nu_cpf_colaborador=current_user.nu_cpf_colaborador,
            nm_funcao=current_user.nm_funcao,
            centro_custo=current_user.centro_custo,
            email=current_user.email,
            host_origem=host_origem or current_user.host,
            nm_servidor=servidor,
            nm_compartilhamento=compartilhamento,
            caminho_informado=self._formatar_caminho_resposta(caminho_informado),
            caminho_completo=caminho_normalizado,
            caminho_relativo=caminho_relativo,
            nm_arquivo=nome_arquivo,
            nm_arquivo_original=nm_arquivo_original,
            extensao=extensao,
            tamanho_bytes=tamanho_bytes,
        )

    def _registrar_eventos_auditoria(self, eventos: list[EventoAuditoriaArquivo]) -> None:
        if not eventos:
            return
        try:
            self.auditoria_repository.registrar_eventos(eventos)
        except Exception:  # pragma: no cover - falha de infraestrutura nao deve interromper operacao principal
            self.logger.exception("Falha ao registrar auditoria de arquivos. quantidade_eventos=%s", len(eventos))

    def listar_arquivos(self, caminho: str = "") -> ListaArquivosCompartilhadosResponse:
        caminho_validado = self._validar_caminho_minimo(
            caminho,
            "Informe ao menos o caminho base no formato //servidor para consultar arquivos.",
        )
        arquivos = self.client.list_files(caminho_validado)
        payload = [ArquivoCompartilhadoResponse(**arquivo.__dict__) for arquivo in arquivos]
        return ListaArquivosCompartilhadosResponse(
            status="sucesso",
            quantidade=len(payload),
            caminho_consultado=self._formatar_caminho_resposta(caminho_validado),
            arquivos=payload,
        )

    def navegar(self, caminho: str = "") -> NavegacaoArquivosResponse:
        caminho_validado = self._validar_caminho_minimo(
            caminho,
            "Informe ao menos o caminho base no formato //servidor para buscar pastas.",
        )
        caminho_atual, itens = self.client.browse(caminho_validado)
        payload = [ItemCompartilhadoResponse(**item.__dict__) for item in itens]
        return NavegacaoArquivosResponse(
            status="sucesso",
            caminho_atual=caminho_atual.replace("\\", "/"),
            itens=payload,
        )

    def carregar_arquivos(
        self,
        arquivos: list[UploadFile],
        pasta_destino: str = "",
        current_user: AuthenticatedUser | None = None,
        host_origem: str = "",
    ) -> UploadArquivosCompartilhadosResponse:
        if not arquivos:
            raise AtlasException("Nenhum arquivo foi enviado.")

        pasta_destino_validada = self._validar_caminho_minimo(
            pasta_destino,
            "Informe ao menos o caminho base no formato //servidor para importar arquivos.",
        )
        uploads_validos = [upload for upload in arquivos if upload.filename]
        destinos_auditoria = self.client.resolve_upload_destinations(uploads_validos, pasta_destino_validada)
        resultado = self.client.save_files(arquivos, pasta_destino_validada)
        payload = [ArquivoCompartilhadoResponse(**arquivo.__dict__) for arquivo in resultado]
        if current_user:
            eventos = [
                self._montar_evento_auditoria(
                    tp_operacao="UPLOAD",
                    current_user=current_user,
                    host_origem=host_origem,
                    caminho_informado=pasta_destino_validada,
                    caminho_completo=destino,
                    nm_arquivo_original=PureWindowsPath(upload.filename or "").name,
                    tamanho_bytes=arquivo_salvo.tamanho_bytes,
                )
                for upload, destino, arquivo_salvo in zip(uploads_validos, destinos_auditoria, resultado)
            ]
            self._registrar_eventos_auditoria(eventos)
        return UploadArquivosCompartilhadosResponse(
            status="sucesso",
            mensagem="Arquivo(s) carregado(s) com sucesso.",
            caminho_destino=self._formatar_caminho_resposta(pasta_destino_validada),
            arquivos=payload,
        )

    def baixar_arquivo(
        self,
        caminho_arquivo: str,
        current_user: AuthenticatedUser | None = None,
        host_origem: str = "",
    ) -> tuple[str, str, bytes]:
        caminho_arquivo_validado = self._validar_caminho_minimo(
            caminho_arquivo,
            "Informe ao menos o caminho base no formato //servidor para baixar arquivos.",
        )
        caminho_completo = self.client.resolve_file_destination(caminho_arquivo_validado)
        file_name, content = self.client.read_file(caminho_arquivo_validado)
        media_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
        quoted_file_name = quote(file_name)
        content_disposition = f"attachment; filename*=UTF-8''{quoted_file_name}"
        if current_user:
            evento = self._montar_evento_auditoria(
                tp_operacao="DOWNLOAD",
                current_user=current_user,
                host_origem=host_origem,
                caminho_informado=caminho_arquivo_validado,
                caminho_completo=caminho_completo,
                nm_arquivo_original=file_name,
                tamanho_bytes=len(content),
            )
            self._registrar_eventos_auditoria([evento])
        return media_type, content_disposition, content
