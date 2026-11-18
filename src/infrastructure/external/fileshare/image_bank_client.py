from __future__ import annotations

from contextlib import AbstractContextManager
from datetime import datetime
from pathlib import PureWindowsPath

from fastapi import UploadFile

from src.domain.entities.arquivo_imagem import ArquivoImagem
from src.infrastructure.services.env_load import get_env
from src.shared.exception import AtlasException
from src.shared.exception import IntegracaoException, NaoEncontradoException

try:
    import smbclient
except ImportError:  # pragma: no cover - depende do ambiente
    smbclient = None


def normalize_smb_path(path: str | None) -> str:
    normalized = str(path or "").strip().replace("/", "\\")
    if normalized.startswith("\\\\"):
        return normalized.rstrip("\\")
    return normalized


class ImageShareSession(AbstractContextManager):
    def __init__(self, share_path: str | None = None) -> None:
        self.share_path = normalize_smb_path(share_path or get_env("IMAGE_SHARE_PATH", required=True))
        self.server = self._extrair_servidor(self.share_path)
        self.user, self.password = self._resolver_credenciais(self.server)

    def __enter__(self):
        self._ensure_smbclient()
        try:
            if self.user or self.password:
                smbclient.register_session(self.server, username=self.user, password=self.password)
            else:
                smbclient.register_session(self.server)
        except Exception as exc:  # pragma: no cover - depende do ambiente
            raise IntegracaoException("Nao foi possivel conectar ao compartilhamento de imagens.") from exc
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if smbclient is None:
            return
        try:
            smbclient.unregister_session(self.server)
        except Exception:
            return

    def _ensure_smbclient(self) -> None:
        if smbclient is None:
            raise IntegracaoException("Biblioteca smbclient nao instalada no ambiente.")

    def _extrair_servidor(self, caminho: str) -> str:
        caminho_limpo = normalize_smb_path(caminho).lstrip("\\")
        if not caminho_limpo:
            raise IntegracaoException("Caminho do compartilhamento de imagens nao configurado.")
        return caminho_limpo.split("\\", 1)[0]

    def _resolver_credenciais(self, servidor: str) -> tuple[str, str]:
        suffix = servidor.split(".")[-1].strip()
        user = (get_env(f"SERVER_USER_{suffix}", default="") or "").strip()
        password = (get_env(f"SERVER_SENHA_{suffix}", default="") or "").strip()
        if user or password:
            return user, password

        return (
            (get_env("IMAGE_SHARE_USER", default="") or "").strip(),
            (get_env("IMAGE_SHARE_PASSWORD", default="") or "").strip(),
        )


class ImageBankClient:
    def __init__(self) -> None:
        share_path = normalize_smb_path(get_env("IMAGE_SHARE_PATH", required=True))
        self.share_path = share_path
        self.base_path = self._resolver_caminho_imagens(share_path)

    def list_files(self) -> list[ArquivoImagem]:
        with ImageShareSession(self.share_path):
            arquivos: list[ArquivoImagem] = []
            try:
                self._coletar_arquivos_recursivo(self.base_path, arquivos)
            except FileNotFoundError as exc:
                raise NaoEncontradoException("Pasta de imagens nao encontrada no compartilhamento.") from exc
            except Exception as exc:  # pragma: no cover - depende do ambiente
                raise IntegracaoException("Falha ao listar os arquivos do banco de imagens.") from exc

        return sorted(arquivos, key=lambda item: (item.pasta.lower(), item.nome.lower()))

    def save_files(self, uploads: list[UploadFile], pasta_destino: str = "") -> list[ArquivoImagem]:
        pasta_relativa = self._normalizar_pasta_relativa(pasta_destino)
        destination_dir = self._montar_caminho_absoluto(pasta_relativa)
        with ImageShareSession(self.share_path):
            self._garantir_pasta(destination_dir)
            try:
                for upload in uploads:
                    if not upload.filename:
                        continue
                    destination = f"{destination_dir}\\{PureWindowsPath(upload.filename).name}"
                    with smbclient.open_file(destination, mode="wb") as output_file:
                        output_file.write(upload.file.read())
            except Exception as exc:  # pragma: no cover - depende do ambiente
                raise IntegracaoException("Falha ao salvar os arquivos no banco de imagens.") from exc

        return self.list_files()

    def delete_file(self, caminho_arquivo: str) -> list[ArquivoImagem]:
        caminho_relativo = self._normalizar_pasta_relativa(caminho_arquivo, permitir_arquivo=True)
        target = self._montar_caminho_absoluto(caminho_relativo)
        with ImageShareSession(self.share_path):
            try:
                smbclient.remove(target)
                self._remover_pastas_vazias(PureWindowsPath(target).parent)
            except FileNotFoundError as exc:
                raise NaoEncontradoException("Arquivo nao encontrado no banco de imagens.") from exc
            except Exception as exc:  # pragma: no cover - depende do ambiente
                raise IntegracaoException("Falha ao excluir arquivo do banco de imagens.") from exc

        return self.list_files()

    def move_file(self, caminho_arquivo: str, pasta_destino: str = "") -> list[ArquivoImagem]:
        caminho_relativo = self._normalizar_pasta_relativa(caminho_arquivo, permitir_arquivo=True)
        pasta_relativa = self._normalizar_pasta_relativa(pasta_destino)
        source = self._montar_caminho_absoluto(caminho_relativo)
        source_path = PureWindowsPath(source)
        destination_dir = self._montar_caminho_absoluto(pasta_relativa)
        destination = str(PureWindowsPath(destination_dir) / source_path.name)

        if PureWindowsPath(destination) == source_path:
            return self.list_files()

        with ImageShareSession(self.share_path):
            try:
                self._garantir_pasta(destination_dir)
                if smbclient.path.exists(destination):
                    raise AtlasException("Ja existe um arquivo com esse nome na pasta de destino.")
                smbclient.rename(source, destination)
                self._remover_pastas_vazias(source_path.parent)
            except FileNotFoundError as exc:
                raise NaoEncontradoException("Arquivo nao encontrado no banco de imagens.") from exc
            except AtlasException:
                raise
            except Exception as exc:  # pragma: no cover - depende do ambiente
                raise IntegracaoException("Falha ao mover arquivo do banco de imagens.") from exc

        return self.list_files()

    def _resolver_caminho_imagens(self, share_path: str) -> str:
        path = PureWindowsPath(share_path)
        if path.name.lower() == "imagens":
            return str(path)
        return str(path / "imagens")

    def _garantir_pasta(self, target_path: str) -> None:
        try:
            smbclient.makedirs(target_path, exist_ok=True)
        except Exception as exc:  # pragma: no cover - depende do ambiente
            raise IntegracaoException("Falha ao garantir a pasta de imagens no compartilhamento.") from exc

    def _coletar_arquivos_recursivo(self, diretorio: str, arquivos: list[ArquivoImagem]) -> None:
        for entry in smbclient.scandir(diretorio):
            if entry.is_dir():
                self._coletar_arquivos_recursivo(entry.path, arquivos)
                continue
            if not entry.is_file():
                continue

            modified_at = datetime.fromtimestamp(entry.stat().st_mtime)
            path = PureWindowsPath(entry.path)
            relative_path = path.relative_to(PureWindowsPath(self.base_path))
            pasta = "" if str(relative_path.parent) == "." else str(relative_path.parent).replace("\\", "/")
            arquivos.append(
                ArquivoImagem(
                    nome=path.stem,
                    extensao=path.suffix,
                    pasta=pasta,
                    caminho_arquivo=str(relative_path).replace("\\", "/"),
                    data_modificacao=modified_at.strftime("%d/%m/%Y %H:%M"),
                )
            )

    def _normalizar_pasta_relativa(self, caminho: str, permitir_arquivo: bool = False) -> str:
        caminho_limpo = (caminho or "").strip().replace("/", "\\").strip("\\")
        if not caminho_limpo:
            return ""

        path = PureWindowsPath(caminho_limpo)
        if path.is_absolute() or path.drive:
            raise AtlasException("Informe uma pasta valida dentro do banco de imagens.")

        partes = [parte.strip() for parte in path.parts if parte and parte.strip()]
        if not partes:
            return ""
        if any(parte in {".", ".."} for parte in partes):
            raise AtlasException("Nao e permitido navegar para fora da pasta de imagens.")

        return "\\".join(partes)

    def _montar_caminho_absoluto(self, caminho_relativo: str) -> str:
        if not caminho_relativo:
            return self.base_path
        return f"{self.base_path}\\{caminho_relativo}"

    def _remover_pastas_vazias(self, pasta_atual: PureWindowsPath) -> None:
        base_path = PureWindowsPath(self.base_path)
        while pasta_atual != base_path:
            try:
                if any(smbclient.scandir(str(pasta_atual))):
                    break
                smbclient.rmdir(str(pasta_atual))
            except FileNotFoundError:
                break
            except OSError:
                break

            proxima = pasta_atual.parent
            if proxima == pasta_atual:
                break
            pasta_atual = proxima
