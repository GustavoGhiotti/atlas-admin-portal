from src.infrastructure.databases.sql_server import get_sql_server_66, get_sql_server_71


class NumerosInfobipRepository:
    def __init__(self) -> None:
        self.chatbot_db = get_sql_server_66("DB_CHATBOT")
        self.report_db = get_sql_server_71("DB_REPORT")

    def listar_numeros(self):
        return self.chatbot_db.fetch_all(
            """
            SELECT
                ID,
                NUMERO,
                STATUS,
                DATA_CONSULTA,
                ID_CEDENTE,
                CEDENTE,
                SERVICE_SID,
                FLUXO,
                CANAL,
                NUMERO_VALIDO,
                PAIS,
                FORMATO_NACIONAL,
                NOME_EXIBICAO,
                EMISSOR_RAW,
                STATUS_REGISTRO,
                STATUS_REMETENTE,
                LIMITE_MENSAGENS,
                LIMITE_MENSAGENS_24H,
                QUALIDADE_RAW,
                PROVEDOR,
                WABA,
                ATIVO,
                CARTEIRAS_PERMITIDAS
            FROM INFOBIP.TB_NUMEROS WITH (NOLOCK)
            ORDER BY ID DESC
            """,
            query_name="numeros_infobip.listar_numeros",
        )

    def listar_carteiras_permitidas(self):
        carteiras_chatbot = self.chatbot_db.fetch_all(
            """
            SELECT DISTINCT ID_CEDENTE, NM_CEDENTE
            FROM msg.TB_CARTEIRA WITH (NOLOCK)
            WHERE ID_CEDENTE IS NOT NULL
              AND NM_CEDENTE IS NOT NULL
              AND LTRIM(RTRIM(NM_CEDENTE)) <> ''
            ORDER BY ID_CEDENTE DESC
            """,
            query_name="numeros_infobip.listar_carteiras_permitidas_chatbot",
        )
        carteiras_report = self.report_db.fetch_all(
            """
            SELECT DISTINCT ID_CEDENTE, CARTEIRA
            FROM DM.TB_CARTEIRA WITH (NOLOCK)
            WHERE ID_CEDENTE IS NOT NULL
              AND CARTEIRA IS NOT NULL
              AND LTRIM(RTRIM(CARTEIRA)) <> ''
            ORDER BY ID_CEDENTE DESC
            """,
            query_name="numeros_infobip.listar_carteiras_permitidas_report",
        )
        return [*carteiras_chatbot, *carteiras_report]

    def buscar_numero(self, id_registro: int):
        return self.chatbot_db.fetch_one(
            """
            SELECT TOP (1)
                ID,
                NUMERO,
                STATUS,
                DATA_CONSULTA,
                ID_CEDENTE,
                CEDENTE,
                SERVICE_SID,
                FLUXO,
                CANAL,
                NUMERO_VALIDO,
                PAIS,
                FORMATO_NACIONAL,
                NOME_EXIBICAO,
                EMISSOR_RAW,
                STATUS_REGISTRO,
                STATUS_REMETENTE,
                LIMITE_MENSAGENS,
                LIMITE_MENSAGENS_24H,
                QUALIDADE_RAW,
                PROVEDOR,
                WABA,
                ATIVO,
                CARTEIRAS_PERMITIDAS
            FROM INFOBIP.TB_NUMEROS WITH (NOLOCK)
            WHERE ID = ?
            """,
            [id_registro],
            query_name="numeros_infobip.buscar_numero",
        )

    def atualizar_numero(self, id_registro: int, ativo: int, carteiras_permitidas: str):
        self.chatbot_db.execute(
            """
            UPDATE INFOBIP.TB_NUMEROS
            SET ATIVO = ?,
                CARTEIRAS_PERMITIDAS = ?
            WHERE ID = ?
            """,
            [ativo, carteiras_permitidas, id_registro],
            query_name="numeros_infobip.atualizar_numero",
        )
        return self.buscar_numero(id_registro)
