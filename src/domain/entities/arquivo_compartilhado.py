from dataclasses import dataclass


@dataclass
class ArquivoCompartilhado:
    nome: str
    extensao: str
    pasta: str
    caminho_arquivo: str
    data_modificacao: str
    tamanho_bytes: int


@dataclass
class ItemCompartilhado:
    nome: str
    caminho: str
    tipo: str
    data_modificacao: str | None
    tamanho_bytes: int | None
