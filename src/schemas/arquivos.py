from pydantic import BaseModel


class ArquivoCompartilhadoResponse(BaseModel):
    nome: str
    extensao: str
    pasta: str
    caminho_arquivo: str
    data_modificacao: str
    tamanho_bytes: int


class ItemCompartilhadoResponse(BaseModel):
    nome: str
    caminho: str
    tipo: str
    data_modificacao: str | None = None
    tamanho_bytes: int | None = None


class ListaArquivosCompartilhadosResponse(BaseModel):
    status: str
    quantidade: int
    caminho_consultado: str
    arquivos: list[ArquivoCompartilhadoResponse]


class UploadArquivosCompartilhadosResponse(BaseModel):
    status: str
    mensagem: str
    caminho_destino: str
    arquivos: list[ArquivoCompartilhadoResponse]


class NavegacaoArquivosResponse(BaseModel):
    status: str
    caminho_atual: str
    itens: list[ItemCompartilhadoResponse]
