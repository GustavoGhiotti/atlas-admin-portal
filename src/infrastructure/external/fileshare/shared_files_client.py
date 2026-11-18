from __future__ import annotations

import ctypes
import os
from datetime import datetime
from pathlib import PureWindowsPath
from ctypes import wintypes

from fastapi import UploadFile

from src.domain.entities.arquivo_compartilhado import ArquivoCompartilhado, ItemCompartilhado
from src.infrastructure.external.fileshare.image_bank_client import ImageShareSession, normalize_smb_path, smbclient
from src.infrastructure.services.env_load import get_env
from src.infrastructure.services.logger_config import setup_logger
from src.shared.exception import AtlasException, IntegracaoException, NaoEncontradoException


if os.name == "nt":
    MAX_PREFERRED_LENGTH = 0xFFFFFFFF
    NERR_SUCCESS = 0
    ERROR_MORE_DATA = 234
    STYPE_DISKTREE = 0
    STYPE_SPECIAL = 0x80000000
    STYPE_TEMPORARY = 0x40000000

    class SHARE_INFO_1(ctypes.Structure):
        _fields_ = [
            ("shi1_netname", wintypes.LPWSTR),
            ("shi1_type", wintypes.DWORD),
            ("shi1_remark", wintypes.LPWSTR),
        ]

    _NETAPI32 = ctypes.WinDLL("Netapi32", use_last_error=True)
    _NETAPI32.NetShareEnum.argtypes = [
        wintypes.LPWSTR,
        wintypes.DWORD,
        ctypes.POINTER(ctypes.c_void_p),
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
        ctypes.POINTER(wintypes.DWORD),
        ctypes.POINTER(wintypes.DWORD),
    ]
    _NETAPI32.NetShareEnum.restype = wintypes.DWORD
    _NETAPI32.NetApiBufferFree.argtypes = [ctypes.c_void_p]
    _NETAPI32.NetApiBufferFree.restype = wintypes.DWORD
else:  # pragma: no cover - ambiente Windows esperado
    MAX_PREFERRED_LENGTH = 0
    NERR_SUCCESS = 0
    ERROR_MORE_DATA = 0
    STYPE_DISKTREE = 0
    STYPE_SPECIAL = 0
    STYPE_TEMPORARY = 0
    SHARE_INFO_1 = None
    _NETAPI32 = None


HIDDEN_FILE_ATTRIBUTE = 0x2
SYSTEM_FILE_ATTRIBUTE = 0x4
SYSTEM_ROOT_ENTRY_NAMES = {
    "$RECYCLE.BIN",
    "SYSTEM VOLUME INFORMATION",
    "PROGRAM FILES",
    "PROGRAM FILES (X86)",
    "PROGRAMDATA",
    "WINDOWS",
    "PERFLOGS",
    "POLARIS",
    "BOOT",
    "EFI",
    "MSOCACHE",
    "DOCUME~1",
    "DOCUMENTS AND SETTINGS",
    "PAGEFILE.SYS",
    "HIBERFIL.SYS",
    "SWAPFILE.SYS",
    "DUMPSTACK.LOG.TMP",
    "BOOTMGR",
}


class SharedFilesClient:
    def __init__(self) -> None:
        self.logger = setup_logger("atlas.arquivos")
        self.allowed_roots = self._resolver_share_paths()
        self.share_path = self.allowed_roots[0]
        self.base_path = str(PureWindowsPath(self.share_path))
        self.logger.info("Modulo de arquivos inicializado. allowed_roots=%s", self.allowed_roots)

    def list_files(self, caminho_busca: str = "") -> list[ArquivoCompartilhado]:
        share_path, caminho_relativo = self._resolver_destino(caminho_busca, permitir_arquivo=True)
        self.share_path = share_path
        self.base_path = str(PureWindowsPath(share_path))
        target = self._montar_caminho_absoluto(caminho_relativo)
        self.logger.info(
            "Listagem solicitada. caminho_recebido=%s share_path=%s caminho_relativo=%s target=%s",
            caminho_busca,
            share_path,
            caminho_relativo,
            target,
        )
        with ImageShareSession(self.share_path):
            try:
                if smbclient.path.isfile(target):
                    self.logger.info("Caminho resolvido como arquivo. target=%s", target)
                    return [self._montar_arquivo(entry_path=target)]

                arquivos: list[ArquivoCompartilhado] = []
                self._coletar_arquivos_recursivo(target, arquivos)
            except FileNotFoundError as exc:
                self.logger.warning("Caminho nao encontrado no compartilhamento. target=%s erro=%s", target, exc)
                raise NaoEncontradoException("Caminho nao encontrado no compartilhamento.") from exc
            except Exception as exc:  # pragma: no cover - depende do ambiente
                self.logger.exception("Falha ao listar arquivos no compartilhamento. target=%s", target)
                raise IntegracaoException("Falha ao listar os arquivos do compartilhamento.") from exc

        return sorted(arquivos, key=lambda item: (item.pasta.lower(), item.nome.lower()))

    def browse(self, caminho_busca: str = "") -> tuple[str, list[ItemCompartilhado]]:
        servidor_raiz = self._resolver_raiz_servidor(caminho_busca)
        if servidor_raiz:
            itens = self._listar_itens_raiz_servidor(servidor_raiz)
            if itens:
                self.logger.info("Navegacao concluida na raiz do servidor. caminho_atual=%s quantidade_itens=%s", servidor_raiz, len(itens))
                return servidor_raiz, itens

        share_path, caminho_relativo = self._resolver_destino(caminho_busca, permitir_arquivo=True)
        self.share_path = share_path
        self.base_path = str(PureWindowsPath(share_path))
        target = self._montar_caminho_absoluto(caminho_relativo)
        self.logger.info(
            "Navegacao solicitada. caminho_recebido=%s share_path=%s caminho_relativo=%s target=%s",
            caminho_busca,
            share_path,
            caminho_relativo,
            target,
        )
        with ImageShareSession(self.share_path):
            try:
                if caminho_relativo and smbclient.path.isfile(target):
                    self.logger.info("Caminho de navegacao resolvido como arquivo. target=%s", target)
                    caminho_atual = self._formatar_caminho_exibicao(share_path, caminho_relativo)
                    return caminho_atual, [self._montar_item(entry_path=target, is_dir=False)]

                itens: list[ItemCompartilhado] = []
                for entry in smbclient.scandir(target):
                    entry_path = PureWindowsPath(entry.path)
                    relative_path = entry_path.relative_to(PureWindowsPath(self.base_path))
                    try:
                        is_dir = entry.is_dir()
                    except Exception as exc:
                        self.logger.warning("Falha ao identificar tipo do item. caminho=%s erro=%s", entry.path, exc)
                        continue
                    if self._deve_ocultar_item(
                        entry_name=entry.name,
                        share_path=self.share_path,
                        relative_path=str(relative_path),
                        is_dir=is_dir,
                        stat_result=None,
                    ):
                        continue
                    try:
                        stat_value = entry.stat()
                    except Exception as exc:
                        self.logger.warning("Falha ao obter metadados do item. caminho=%s erro=%s", entry.path, exc)
                        continue
                    if self._deve_ocultar_item(
                        entry_name=entry.name,
                        share_path=self.share_path,
                        relative_path=str(relative_path),
                        is_dir=is_dir,
                        stat_result=stat_value,
                    ):
                        continue
                    itens.append(
                        self._montar_item(
                            entry_path=entry.path,
                            entry_name=entry.name,
                            is_dir=is_dir,
                            stat_result=stat_value,
                        )
                    )
            except FileNotFoundError as exc:
                self.logger.warning("Caminho de navegacao nao encontrado. target=%s erro=%s", target, exc)
                raise NaoEncontradoException("Caminho nao encontrado no compartilhamento.") from exc
            except Exception as exc:  # pragma: no cover - depende do ambiente
                self.logger.exception("Falha ao navegar no compartilhamento. target=%s", target)
                raise IntegracaoException("Falha ao navegar no compartilhamento.") from exc

        itens.sort(key=lambda item: (0 if item.tipo == "pasta" else 1, item.nome.lower()))
        caminho_atual = self._formatar_caminho_exibicao(share_path, caminho_relativo)
        self.logger.info("Navegacao concluida. caminho_atual=%s quantidade_itens=%s", caminho_atual, len(itens))
        return caminho_atual, itens

    def resolve_upload_destinations(self, uploads: list[UploadFile], pasta_destino: str = "") -> list[str]:
        share_path, caminho_path, destino_eh_arquivo, pasta_relativa, _ = self._resolver_contexto_upload(uploads, pasta_destino)
        destinos: list[str] = []
        for upload in uploads:
            if not upload.filename:
                continue
            file_name = caminho_path.name if destino_eh_arquivo else PureWindowsPath(upload.filename).name
            caminho_relativo_arquivo = str(PureWindowsPath(pasta_relativa) / file_name) if pasta_relativa else file_name
            destinos.append(self._formatar_caminho_exibicao(share_path, caminho_relativo_arquivo).replace("\\", "/"))
        return destinos

    def save_files(self, uploads: list[UploadFile], pasta_destino: str = "") -> list[ArquivoCompartilhado]:
        share_path, caminho_path, destino_eh_arquivo, pasta_relativa, destination_dir = self._resolver_contexto_upload(uploads, pasta_destino)
        self.share_path = share_path
        self.base_path = str(PureWindowsPath(share_path))
        self.logger.info(
            "Upload solicitado. pasta_destino=%s share_path=%s caminho_relativo=%s destination_dir=%s destino_eh_arquivo=%s",
            pasta_destino,
            share_path,
            str(caminho_path),
            destination_dir,
            destino_eh_arquivo,
        )
        arquivos_salvos: list[ArquivoCompartilhado] = []
        with ImageShareSession(self.share_path):
            self._garantir_pasta(destination_dir)
            try:
                for upload in uploads:
                    if not upload.filename:
                        continue
                    file_name = caminho_path.name if destino_eh_arquivo else PureWindowsPath(upload.filename).name
                    destination = str(PureWindowsPath(destination_dir) / file_name)
                    self.logger.info("Gravando arquivo no compartilhamento. origem=%s destino=%s", upload.filename, destination)
                    with smbclient.open_file(destination, mode="wb") as output_file:
                        output_file.write(upload.file.read())
                    arquivos_salvos.append(self._montar_arquivo(entry_path=destination))
            except Exception as exc:  # pragma: no cover - depende do ambiente
                self.logger.exception("Falha ao salvar arquivos no compartilhamento. destination_dir=%s", destination_dir)
                raise IntegracaoException("Falha ao salvar os arquivos no compartilhamento.") from exc

        return arquivos_salvos

    def resolve_file_destination(self, caminho_arquivo: str) -> str:
        share_path, caminho_relativo = self._resolver_destino(caminho_arquivo, permitir_arquivo=True)
        return self._formatar_caminho_exibicao(share_path, caminho_relativo).replace("\\", "/")

    def read_file(self, caminho_arquivo: str) -> tuple[str, bytes]:
        share_path, caminho_relativo = self._resolver_destino(caminho_arquivo, permitir_arquivo=True)
        self.share_path = share_path
        self.base_path = str(PureWindowsPath(share_path))
        target = self._montar_caminho_absoluto(caminho_relativo)
        self.logger.info(
            "Download solicitado. caminho_arquivo=%s share_path=%s caminho_relativo=%s target=%s",
            caminho_arquivo,
            share_path,
            caminho_relativo,
            target,
        )
        with ImageShareSession(self.share_path):
            try:
                with smbclient.open_file(target, mode="rb") as input_file:
                    return PureWindowsPath(target).name, input_file.read()
            except FileNotFoundError as exc:
                self.logger.warning("Arquivo para download nao encontrado. target=%s erro=%s", target, exc)
                raise NaoEncontradoException("Arquivo nao encontrado no compartilhamento.") from exc
            except Exception as exc:  # pragma: no cover - depende do ambiente
                self.logger.exception("Falha ao ler arquivo do compartilhamento. target=%s", target)
                raise IntegracaoException("Falha ao ler o arquivo do compartilhamento.") from exc

    def _resolver_share_paths(self) -> list[str]:
        raw_paths = (get_env("FILES_SHARE_PATHS", default=None) or "").strip()
        if raw_paths:
            paths = [normalize_smb_path(item) for item in raw_paths.split(";") if item.strip()]
        else:
            fallback = normalize_smb_path(get_env("FILES_SHARE_PATH", default=None) or get_env("IMAGE_SHARE_PATH", required=True))
            paths = [fallback] if fallback else []

        if not paths:
            raise IntegracaoException("Caminho do compartilhamento de arquivos nao configurado.")
        return paths

    def _garantir_pasta(self, target_path: str) -> None:
        try:
            smbclient.makedirs(target_path, exist_ok=True)
        except Exception as exc:  # pragma: no cover - depende do ambiente
            raise IntegracaoException("Falha ao garantir a pasta no compartilhamento.") from exc

    def _resolver_contexto_upload(
        self,
        uploads: list[UploadFile],
        pasta_destino: str = "",
    ) -> tuple[str, PureWindowsPath, bool, str, str]:
        share_path, caminho_relativo = self._resolver_destino(pasta_destino, permitir_arquivo=True)
        caminho_path = PureWindowsPath(caminho_relativo) if caminho_relativo else PureWindowsPath()
        uploads_validos = [upload for upload in uploads if upload.filename]
        destino_eh_arquivo = bool(caminho_relativo and caminho_path.suffix)
        if destino_eh_arquivo and len(uploads_validos) != 1:
            self.logger.warning(
                "Upload recusado por caminho de arquivo com multiplos uploads. pasta_destino=%s quantidade=%s",
                pasta_destino,
                len(uploads_validos),
            )
            raise AtlasException("Ao informar o caminho completo de um arquivo, envie apenas um arquivo por vez.")

        pasta_relativa = "" if not caminho_relativo else str(caminho_path.parent if destino_eh_arquivo else caminho_path)
        pasta_relativa = "" if pasta_relativa == "." else pasta_relativa
        base_path = str(PureWindowsPath(share_path))
        destination_dir = base_path if not pasta_relativa else str(PureWindowsPath(base_path) / PureWindowsPath(pasta_relativa))
        return share_path, caminho_path, destino_eh_arquivo, pasta_relativa, destination_dir

    def _coletar_arquivos_recursivo(self, diretorio: str, arquivos: list[ArquivoCompartilhado]) -> None:
        for entry in smbclient.scandir(diretorio):
            entry_path = PureWindowsPath(entry.path)
            relative_path = entry_path.relative_to(PureWindowsPath(self.base_path))
            try:
                is_dir = entry.is_dir()
            except Exception as exc:
                self.logger.warning("Falha ao identificar tipo do item. caminho=%s erro=%s", entry.path, exc)
                continue
            if self._deve_ocultar_item(
                entry_name=entry.name,
                share_path=self.share_path,
                relative_path=str(relative_path),
                is_dir=is_dir,
                stat_result=None,
            ):
                continue
            try:
                stat_result = entry.stat()
            except Exception as exc:
                self.logger.warning("Falha ao obter metadados do item. caminho=%s erro=%s", entry.path, exc)
                continue
            if self._deve_ocultar_item(
                entry_name=entry.name,
                share_path=self.share_path,
                relative_path=str(relative_path),
                is_dir=is_dir,
                stat_result=stat_result,
            ):
                continue

            if is_dir:
                self._coletar_arquivos_recursivo(entry.path, arquivos)
                continue

            arquivos.append(self._montar_arquivo(entry_path=entry.path, stat_result=stat_result))

    def _montar_arquivo(self, entry_path: str, stat_result=None) -> ArquivoCompartilhado:
        stat_value = stat_result or smbclient.stat(entry_path)
        modified_at = datetime.fromtimestamp(stat_value.st_mtime)
        size = int(stat_value.st_size or 0)
        path = PureWindowsPath(entry_path)
        relative_path = path.relative_to(PureWindowsPath(self.base_path))
        pasta = "" if str(relative_path.parent) == "." else str(relative_path.parent).replace("\\", "/")
        return ArquivoCompartilhado(
            nome=path.stem,
            extensao=path.suffix,
            pasta=pasta,
            caminho_arquivo=str(relative_path).replace("\\", "/"),
            data_modificacao=modified_at.strftime("%d/%m/%Y %H:%M"),
            tamanho_bytes=size,
        )

    def _montar_item(
        self,
        entry_path: str,
        entry_name: str | None = None,
        is_dir: bool | None = None,
        stat_result=None,
    ) -> ItemCompartilhado:
        stat_value = stat_result or smbclient.stat(entry_path)
        modified_at = datetime.fromtimestamp(stat_value.st_mtime).strftime("%d/%m/%Y %H:%M")
        path = PureWindowsPath(entry_path)
        relative_path = path.relative_to(PureWindowsPath(self.base_path))
        caminho = self._formatar_caminho_exibicao(self.share_path, str(relative_path)).replace("\\", "/")
        resolved_is_dir = smbclient.path.isdir(entry_path) if is_dir is None else is_dir
        return ItemCompartilhado(
            nome=entry_name or path.name,
            caminho=caminho,
            tipo="pasta" if resolved_is_dir else "arquivo",
            data_modificacao=modified_at,
            tamanho_bytes=None if resolved_is_dir else int(stat_value.st_size or 0),
        )

    def _resolver_raiz_servidor(self, caminho: str) -> str | None:
        caminho_limpo = (caminho or "").strip().replace("/", "\\")
        if not caminho_limpo:
            return None

        path = PureWindowsPath(caminho_limpo)
        drive = (path.drive or path.anchor or "").rstrip("\\")
        if not drive.startswith("\\\\"):
            return None

        partes = [parte for parte in drive.lstrip("\\").split("\\") if parte]
        if len(partes) != 1:
            return None

        servidor = partes[0]
        if not any(self._extrair_servidor(share_path).lower() == servidor.lower() for share_path in self.allowed_roots):
            return None

        return f"\\\\{servidor}"

    def _listar_itens_raiz_servidor(self, servidor_raiz: str) -> list[ItemCompartilhado]:
        servidor = self._extrair_servidor(servidor_raiz)
        shares = self._listar_shares_servidor(servidor)
        if shares:
            return [
                ItemCompartilhado(
                    nome=share,
                    caminho=str(PureWindowsPath(f"\\\\{servidor}\\{share}")).replace("\\", "/"),
                    tipo="pasta",
                    data_modificacao=None,
                    tamanho_bytes=None,
                )
                for share in shares
            ]

        itens: list[ItemCompartilhado] = []
        vistos: set[str] = set()

        for share_path in self.allowed_roots:
            if self._extrair_servidor(share_path).lower() != servidor.lower():
                continue

            partes = self._partes_unc(share_path)
            if len(partes) < 2:
                continue

            caminho = str(PureWindowsPath(share_path)).replace("\\", "/")
            if caminho.lower() in vistos:
                continue

            vistos.add(caminho.lower())
            itens.append(
                ItemCompartilhado(
                    nome="\\".join(partes[1:]),
                    caminho=caminho,
                    tipo="pasta",
                    data_modificacao=None,
                    tamanho_bytes=None,
                )
            )

        itens.sort(key=lambda item: item.nome.lower())
        return itens

    def _listar_shares_servidor(self, servidor: str) -> list[str]:
        if os.name != "nt" or not servidor or _NETAPI32 is None or SHARE_INFO_1 is None:
            return []

        shares: list[str] = []
        resume_handle = wintypes.DWORD(0)

        while True:
            buffer = ctypes.c_void_p()
            entries_read = wintypes.DWORD()
            total_entries = wintypes.DWORD()
            status = _NETAPI32.NetShareEnum(
                wintypes.LPWSTR(f"\\\\{servidor}"),
                1,
                ctypes.byref(buffer),
                MAX_PREFERRED_LENGTH,
                ctypes.byref(entries_read),
                ctypes.byref(total_entries),
                ctypes.byref(resume_handle),
            )
            try:
                if status not in {NERR_SUCCESS, ERROR_MORE_DATA}:
                    self.logger.warning("Falha ao enumerar shares do servidor. servidor=%s status=%s", servidor, status)
                    return []

                if entries_read.value:
                    items = ctypes.cast(buffer, ctypes.POINTER(SHARE_INFO_1))
                    for index in range(entries_read.value):
                        item = items[index]
                        share_type = int(item.shi1_type or 0)
                        if share_type & STYPE_SPECIAL or share_type & STYPE_TEMPORARY:
                            continue
                        if share_type & 0xFFFF != STYPE_DISKTREE:
                            continue
                        nome = (item.shi1_netname or "").strip()
                        if nome:
                            shares.append(nome)
            finally:
                if buffer:
                    _NETAPI32.NetApiBufferFree(buffer)

            if status != ERROR_MORE_DATA:
                break

        return sorted(set(shares), key=str.lower)

    def _extrair_servidor(self, caminho: str) -> str:
        partes = self._partes_unc(caminho)
        return partes[0] if partes else ""

    def _partes_unc(self, caminho: str) -> list[str]:
        return [parte for parte in str(caminho).strip().replace("/", "\\").lstrip("\\").split("\\") if parte]

    def _normalizar_caminho_informado(self, caminho: str, base_path: str, permitir_arquivo: bool = False) -> str:
        caminho_limpo = (caminho or "").strip().replace("/", "\\")
        if not caminho_limpo:
            return ""

        path = PureWindowsPath(caminho_limpo)
        base_windows_path = PureWindowsPath(base_path)
        if path.is_absolute() or path.drive:
            try:
                path = path.relative_to(base_windows_path)
            except ValueError as exc:
                raise AtlasException("Informe um caminho dentro de uma das raizes configuradas do compartilhamento.") from exc

        partes = [parte.strip() for parte in path.parts if parte and parte.strip()]
        if not partes:
            return ""
        if any(parte in {".", ".."} for parte in partes):
            raise AtlasException("Nao e permitido navegar para fora da raiz do compartilhamento.")
        if not permitir_arquivo and path.suffix:
            raise AtlasException("Informe apenas o caminho da pasta de destino.")

        return "\\".join(partes)

    def _resolver_destino(self, caminho: str, permitir_arquivo: bool = False) -> tuple[str, str]:
        caminho_limpo = (caminho or "").strip().replace("/", "\\")
        if not caminho_limpo:
            self.logger.info("Destino vazio recebido. Usando raiz padrao=%s", self.allowed_roots[0])
            return self.allowed_roots[0], ""

        path = PureWindowsPath(caminho_limpo)
        if path.is_absolute() or path.drive:
            if len(path.parts) == 1:
                servidor = path.parts[0].rstrip("\\")
                for share_path in self.allowed_roots:
                    share_parts = PureWindowsPath(share_path).parts
                    if share_parts and share_parts[0].rstrip("\\").lower() == servidor.lower():
                        self.logger.info("Servidor raiz resolvido. caminho=%s share_path=%s", caminho, share_path)
                        return share_path, ""

            for share_path in self.allowed_roots:
                base_path = PureWindowsPath(share_path)
                try:
                    relative_path = path.relative_to(base_path)
                    self.logger.info("Destino absoluto resolvido. caminho=%s share_path=%s relative_path=%s", caminho, share_path, relative_path)
                    return share_path, self._normalizar_caminho_informado(str(relative_path), share_path, permitir_arquivo=permitir_arquivo)
                except ValueError:
                    continue

            dynamic_share = self._resolver_share_dinamico(path)
            if dynamic_share:
                share_path, relative_path = dynamic_share
                self.logger.info("Destino absoluto resolvido em share dinamico. caminho=%s share_path=%s relative_path=%s", caminho, share_path, relative_path)
                return share_path, self._normalizar_caminho_informado(relative_path, share_path, permitir_arquivo=permitir_arquivo)
            self.logger.warning("Caminho fora das raizes configuradas. caminho=%s allowed_roots=%s", caminho, self.allowed_roots)
            raise AtlasException("Informe um caminho dentro de uma das raizes configuradas do compartilhamento.")

        resolved = self._normalizar_caminho_informado(caminho_limpo, self.allowed_roots[0], permitir_arquivo=permitir_arquivo)
        self.logger.info("Destino relativo resolvido. caminho=%s share_path=%s relative_path=%s", caminho, self.allowed_roots[0], resolved)
        return self.allowed_roots[0], resolved

    def _resolver_share_dinamico(self, path: PureWindowsPath) -> tuple[str, str] | None:
        partes = [parte for parte in path.parts if parte]
        if not partes:
            return None

        share_root = normalize_smb_path(partes[0])
        share_parts = self._partes_unc(share_root)
        if len(share_parts) < 2:
            return None

        servidor = share_parts[0]
        servidores_permitidos = {self._extrair_servidor(share_path).lower() for share_path in self.allowed_roots}
        if servidor.lower() not in servidores_permitidos:
            return None

        relative_parts = [parte.strip() for parte in partes[1:] if parte and parte.strip()]
        relative_path = "\\".join(relative_parts)
        return share_root, relative_path

    def _deve_ocultar_item(
        self,
        entry_name: str,
        share_path: str,
        relative_path: str,
        is_dir: bool,
        stat_result=None,
    ) -> bool:
        if not self._is_drive_share(share_path):
            return False

        path = PureWindowsPath(relative_path)
        if len(path.parts) != 1:
            return False

        nome = (entry_name or "").strip().upper()
        if nome in SYSTEM_ROOT_ENTRY_NAMES:
            return True

        atributos = int(getattr(stat_result, "st_file_attributes", 0) or 0)
        if atributos & (HIDDEN_FILE_ATTRIBUTE | SYSTEM_FILE_ATTRIBUTE):
            return True

        if is_dir and nome.startswith("$"):
            return True

        return False

    def _is_drive_share(self, share_path: str) -> bool:
        partes = self._partes_unc(share_path)
        if len(partes) < 2:
            return False
        nome_share = partes[1]
        return len(nome_share) == 1 and nome_share.isalpha()

    def _montar_caminho_absoluto(self, caminho_relativo: str) -> str:
        if not caminho_relativo:
            return self.base_path
        return str(PureWindowsPath(self.base_path) / PureWindowsPath(caminho_relativo))

    def _formatar_caminho_exibicao(self, share_path: str, caminho_relativo: str) -> str:
        if not caminho_relativo:
            return share_path
        return str(PureWindowsPath(share_path) / PureWindowsPath(caminho_relativo))
