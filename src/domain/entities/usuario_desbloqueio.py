from dataclasses import dataclass


@dataclass
class UsuarioDesbloqueio:
    nome: str
    login: str
    cpf: str
    funcao: str
    centro_custo: str
    status: str
