from pydantic import BaseModel


class ArquivoImagemResponse(BaseModel):
    nome: str
    extensao: str
    pasta: str
    caminho_arquivo: str
    data_modificacao: str
    url_publica: str | None = None


class ListaArquivosResponse(BaseModel):
    status: str
    quantidade: int
    arquivos: list[ArquivoImagemResponse]


class AcaoArquivoResponse(BaseModel):
    status: str
    mensagem: str
    arquivos: list[ArquivoImagemResponse]
