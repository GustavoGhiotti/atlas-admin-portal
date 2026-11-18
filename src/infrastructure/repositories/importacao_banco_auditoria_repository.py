from src.domain.entities.evento_importacao_banco import EventoImportacaoBanco


class ImportacaoBancoAuditoriaRepository:
    """Aposentado. Substituido pelo log do middleware em LOGS_ROBOS (ATLAS.EXECUCAO).
    Virou no-op para PARAR de escrever na tabela antiga TB_LOG_IMPORTACAO_SQL_PORTAL,
    dentro do banco de login (DB_BIGGER_NEW). Mantida so para nao quebrar quem chama.
    """

    def __init__(self) -> None:
        pass

    def registrar_evento(self, evento: EventoImportacaoBanco) -> None:
        return
