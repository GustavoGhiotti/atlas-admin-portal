from dataclasses import dataclass


@dataclass
class ArquivoImagem:
    nome: str
    extensao: str
    pasta: str
    caminho_arquivo: str
    data_modificacao: str
