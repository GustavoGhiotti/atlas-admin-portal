from pydantic import BaseModel


class ServidorBancoOptionResponse(BaseModel):
    chave: str
    label: str
    host: str | None = None
    nome: str | None = None


class ConfiguracaoImportacaoBancoResponse(BaseModel):
    status: str
    servidores: list[ServidorBancoOptionResponse]
    bancos: list[ServidorBancoOptionResponse]
    formatos_permitidos: list[str]


class BancoServidorResponse(BaseModel):
    nome: str
    label: str


class ListaBancosServidorResponse(BaseModel):
    status: str
    quantidade: int
    bancos: list[BancoServidorResponse]


class TabelaBancoResponse(BaseModel):
    schema: str
    tabela: str


class ListaTabelasBancoResponse(BaseModel):
    status: str
    quantidade: int
    tabelas: list[TabelaBancoResponse]


class ColunaArquivoResponse(BaseModel):
    indice: int
    nome: str


class ColunaTabelaResponse(BaseModel):
    nome: str
    tipo: str
    obrigatoria: bool
    aceita_nulo: bool
    importavel: bool


class ColunaCorrespondenteResponse(BaseModel):
    origem: str
    destino: str


class AnaliseImportacaoBancoResponse(BaseModel):
    status: str
    modo_importacao: str | None = None
    schema_destino: str | None = None
    tabela_destino: str | None = None
    nome_arquivo: str
    tipo_arquivo: str
    delimitador: str | None = None
    abas_disponiveis: list[str]
    aba_selecionada: str | None = None
    total_linhas: int
    colunas_arquivo: list[ColunaArquivoResponse]
    colunas_tabela: list[ColunaTabelaResponse]
    colunas_correspondentes: list[ColunaCorrespondenteResponse]
    colunas_extras_arquivo: list[str]
    colunas_faltantes_tabela: list[str]
    colunas_nao_suportadas: list[str]
    pode_importar: bool
    mensagem: str
    amostra: list[dict[str, str]]


class InspecaoImportacaoBancoResponse(BaseModel):
    status: str
    nome_arquivo: str
    tipo_arquivo: str
    delimitador: str | None = None
    abas_disponiveis: list[str]
    aba_padrao: str | None = None
    total_colunas: int
    total_linhas: int


class ImportacaoBancoResponse(BaseModel):
    status: str
    modo_importacao: str | None = None
    schema_destino: str | None = None
    tabela_destino: str | None = None
    mensagem: str
    total_linhas_importadas: int
    nome_arquivo: str
    aba_selecionada: str | None = None
