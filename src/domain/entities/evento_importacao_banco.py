from dataclasses import dataclass


@dataclass
class EventoImportacaoBanco:
    tp_evento: str
    nm_login: str
    nm_colaborador: str
    nu_cpf_colaborador: str
    nm_funcao: str
    centro_custo: str
    email: str | None
    host_origem: str
    nm_servidor_sql: str
    nm_banco: str
    nm_schema: str
    nm_tabela: str
    nm_arquivo: str
    tp_arquivo: str
    nm_aba: str | None
    delimitador: str | None
    total_linhas_arquivo: int
    total_linhas_importadas: int
    colunas_importadas: str | None
