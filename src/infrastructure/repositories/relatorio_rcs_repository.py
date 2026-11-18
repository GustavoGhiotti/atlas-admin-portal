from src.infrastructure.repositories.relatorio_infobip_repository import RelatorioInfobipRepository


class RelatorioRcsRepository(RelatorioInfobipRepository):
    LIMITE_TABLE_SEMANAL = "TB_CEDENTE_RCS_LIMITE_SEMANAL"
    LIMITE_TABLE_MENSAL = "TB_CEDENTE_RCS_LIMITE_MENSAL"
    LIMITE_TOTAL_TABLE_SEMANAL = "TB_RCS_LIMITE_TOTAL_SEMANAL"
    LIMITE_TOTAL_TABLE_MENSAL = "TB_RCS_LIMITE_TOTAL_MENSAL"
    READ_SOURCE = "infobip.VW_ENVIO_RCS_MENSAGEM_LEITURA"
    WRITE_SOURCE = "infobip.TB_ENVIO_RCS_MENSAGEM"
    MESSAGE_COLUMN = "MENSAGEM"
    VOLUME_EXPRESSION = "1"
    QUERY_PREFIX = "rcs_infobip"

    def inserir_envio_teste(self, cedente_nome: str, canal: str, id_cedente: int, id_cliente: int, numero: str, mensagem: str, variaveis_json: str):
        return self.db.fetch_one(
            f"""
            INSERT INTO {self.write_source} (
                ID_CLIENTE, ID_CEDENTE, CEDENTE, CANAL, NM_USUARIO_ENVIO,
                NUM_CLIENTE, {self.MESSAGE_COLUMN}, VARIAVEIS_JSON, STATUS
            )
            OUTPUT INSERTED.ID, INSERTED.CEDENTE, INSERTED.ID_CEDENTE, INSERTED.NUM_CLIENTE, INSERTED.STATUS
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [id_cliente, id_cedente, cedente_nome, canal, "USUARIO_ROBO", numero, mensagem, variaveis_json, "PENDENTE"],
            query_name="rcs_infobip.inserir_envio_teste",
        )
