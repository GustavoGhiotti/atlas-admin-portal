from src.domain.entities.evento_auditoria_arquivo import EventoAuditoriaArquivo


class ArquivosAuditoriaRepository:
    """Aposentado. A auditoria de arquivos agora e feita pelo middleware, que grava
    em LOGS_ROBOS (ATLAS.EXECUCAO). Esta classe virou no-op para PARAR de escrever na
    tabela antiga TB_LOG_ARQUIVOS_PORTAL, que ficava dentro do banco de login
    (DB_BIGGER_NEW) e fazia parte do acoplamento. Mantida so para nao quebrar quem a
    instancia/chama.
    """

    def __init__(self) -> None:
        pass

    def registrar_eventos(self, eventos: list[EventoAuditoriaArquivo]) -> None:
        return
