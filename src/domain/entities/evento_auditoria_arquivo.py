from dataclasses import dataclass


@dataclass
class EventoAuditoriaArquivo:
    tp_operacao: str
    nm_login: str
    nm_colaborador: str
    nu_cpf_colaborador: str
    nm_funcao: str
    centro_custo: str
    email: str | None
    host_origem: str
    nm_servidor: str
    nm_compartilhamento: str
    caminho_informado: str
    caminho_completo: str
    caminho_relativo: str
    nm_arquivo: str
    nm_arquivo_original: str | None
    extensao: str
    tamanho_bytes: int | None
