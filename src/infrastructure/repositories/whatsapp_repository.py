from dataclasses import dataclass
from datetime import date, timedelta

from src.infrastructure.databases.sql_server import get_sql_server_66
from src.shared.exception import AtlasException


@dataclass(frozen=True)
class WhatsAppProviderConfig:
    provider_name: str
    numbers_table: str
    templates_table: str
    numbers_date_expr: str
    numbers_extra_select: str
    numbers_extra_label_1: str
    numbers_extra_label_2: str


class WhatsAppRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_CHATBOT")

    def buscar_resumo_controle(self, provider: str, inicio_sql: str, fim_sql: str):
        return self.db.fetch_one(
            f"""
            SELECT
                COUNT(*) AS total_envios,
                MAX(DATA_ENVIO) AS ultimo_envio
            FROM DB_COPILOT_ACME.dbo.WhatsAppEnvioLog WITH (NOLOCK)
            WHERE DATA_ENVIO >= CONVERT(datetime, '{inicio_sql}', 112)
              AND DATA_ENVIO < DATEADD(day, 1, CONVERT(datetime, '{fim_sql}', 112))
            """
        )

    def buscar_resumo_numeros(
        self,
        provider: str,
        inicio_sql: str,
        fim_sql: str,
        cedente: str | None,
        canal: str | None,
        status_numero: str | None,
    ):
        config = self._provider_config(provider)
        valid_conditions = self._build_where_valid_numbers(config.provider_name)
        return self.db.fetch_one(
            f"""
            SELECT
                COUNT(*) AS total_validos
            FROM {config.numbers_table} WITH (NOLOCK)
            {self._build_where_numbers(config, inicio_sql, fim_sql, cedente, canal, status_numero)}
              AND {valid_conditions}
            """
        )

    def buscar_total_numeros(
        self,
        provider: str,
        inicio_sql: str,
        fim_sql: str,
        cedente: str | None,
        canal: str | None,
        status_numero: str | None,
    ):
        config = self._provider_config(provider)
        return self.db.fetch_one(
            f"""
            SELECT
                COUNT(*) AS total_numeros
            FROM {config.numbers_table} WITH (NOLOCK)
            {self._build_where_numbers(config, inicio_sql, fim_sql, cedente, canal, status_numero)}
            """
        )

    def buscar_resumo_templates(self, provider: str, inicio_sql: str, fim_sql: str, status_template: str | None):
        config = self._provider_config(provider)
        active_condition = self._build_where_active_templates(config.provider_name)
        where = self._build_where_templates(status_template, active_condition)
        return self.db.fetch_one(
            f"""
            SELECT
                COUNT(*) AS total_ativos
            FROM {config.templates_table} WITH (NOLOCK)
            {where}
            """
        )

    def buscar_total_templates(self, provider: str, inicio_sql: str, fim_sql: str, status_template: str | None):
        config = self._provider_config(provider)
        return self.db.fetch_one(
            f"""
            SELECT
                COUNT(*) AS total_templates
            FROM {config.templates_table} WITH (NOLOCK)
            {self._build_where_templates(status_template)}
            """
        )

    def listar_controle_envios(self, provider: str, inicio_sql: str, fim_sql: str) -> list[tuple]:
        config = self._provider_config(provider)
        return self.db.fetch_all(
            f"""
            SELECT TOP (50)
                NUMERO,
                DATA_REFERENCIA,
                QTD_ENVIOS,
                DT_ULTIMO_ENVIO,
                DT_CRIACAO,
                DT_ATUALIZACAO
            FROM dbo.TB_CONTROLE_ENVIOS_NUMERO WITH (NOLOCK)
            {self._build_where_controle(config.provider_name, inicio_sql, fim_sql)}
            ORDER BY DATA_REFERENCIA DESC, QTD_ENVIOS DESC, NUMERO
            """
        )

    def listar_envios_por_semana(self, provider: str, referencia: date) -> list[tuple]:
        config = self._provider_config(provider)
        inicio_semana = referencia - timedelta(days=referencia.weekday())
        fim_semana = inicio_semana + timedelta(days=7)
        return self.db.fetch_all(
            f"""
            SELECT
                CONVERT(date, DATA_REFERENCIA) AS periodo,
                ISNULL(SUM(QTD_ENVIOS), 0) AS total_envios
            FROM dbo.TB_CONTROLE_ENVIOS_NUMERO WITH (NOLOCK)
            WHERE PROVEDOR = '{config.provider_name}'
              AND DATA_REFERENCIA >= CONVERT(date, '{inicio_semana.strftime("%Y%m%d")}', 112)
              AND DATA_REFERENCIA < CONVERT(date, '{fim_semana.strftime("%Y%m%d")}', 112)
            GROUP BY CONVERT(date, DATA_REFERENCIA)
            ORDER BY periodo
            """
        )

    def listar_envios_por_mes(self, provider: str, referencia: date) -> list[tuple]:
        config = self._provider_config(provider)
        inicio_mes = referencia.replace(day=1)
        if inicio_mes.month == 12:
            proximo_mes = inicio_mes.replace(year=inicio_mes.year + 1, month=1)
        else:
            proximo_mes = inicio_mes.replace(month=inicio_mes.month + 1)
        return self.db.fetch_all(
            f"""
            SELECT
                CONVERT(date, DATA_REFERENCIA) AS periodo,
                ISNULL(SUM(QTD_ENVIOS), 0) AS total_envios
            FROM dbo.TB_CONTROLE_ENVIOS_NUMERO WITH (NOLOCK)
            WHERE PROVEDOR = '{config.provider_name}'
              AND DATA_REFERENCIA >= CONVERT(date, '{inicio_mes.strftime("%Y%m%d")}', 112)
              AND DATA_REFERENCIA < CONVERT(date, '{proximo_mes.strftime("%Y%m%d")}', 112)
            GROUP BY CONVERT(date, DATA_REFERENCIA)
            ORDER BY periodo
            """
        )

    def listar_envios_por_periodo(self, provider: str, inicio_sql: str, fim_sql: str) -> list[tuple]:
        config = self._provider_config(provider)
        return self.db.fetch_all(
            f"""
            SELECT
                CONVERT(date, DATA_REFERENCIA) AS periodo,
                ISNULL(SUM(QTD_ENVIOS), 0) AS total_envios
            FROM dbo.TB_CONTROLE_ENVIOS_NUMERO WITH (NOLOCK)
            {self._build_where_controle(config.provider_name, inicio_sql, fim_sql)}
            GROUP BY CONVERT(date, DATA_REFERENCIA)
            ORDER BY periodo
            """
        )

    def listar_numeros(
        self,
        provider: str,
        inicio_sql: str,
        fim_sql: str,
        cedente: str | None,
        canal: str | None,
        status_numero: str | None,
    ) -> list[tuple]:
        config = self._provider_config(provider)
        where = self._build_where_numbers(config, inicio_sql, fim_sql, cedente, canal, status_numero)
        return self.db.fetch_all(
            f"""
            SELECT TOP (50)
                NUMERO,
                STATUS,
                CEDENTE,
                CANAL,
                {config.numbers_date_expr} AS DATA_CONSULTA_FORMATADA,
                {config.numbers_extra_select}
            FROM {config.numbers_table} WITH (NOLOCK)
            {where}
            ORDER BY {config.numbers_date_expr} DESC, NUMERO
            """
        )

    def listar_templates(self, provider: str, inicio_sql: str, fim_sql: str, status_template: str | None) -> list[tuple]:
        config = self._provider_config(provider)
        return self.db.fetch_all(
            f"""
            SELECT TOP (50)
                SID_TEMPLATE,
                NOME_TEMPLATE,
                STATUS_APROVACAO,
                DATA_APROVACAO,
                DT_INCLUSAO,
                LINGUA
            FROM {config.templates_table} WITH (NOLOCK)
            {self._build_where_templates(status_template)}
            ORDER BY DT_INCLUSAO DESC, NOME_TEMPLATE
            """
        )

    def listar_envios_por_carteira_log(self, inicio_sql: str, fim_sql: str) -> list[tuple]:
        return self.db.fetch_all(
            f"""
            SELECT
                ISNULL(NULLIF(LTRIM(RTRIM(NM_CEDENTE)), ''), 'Nao informado') AS nm_cedente,
                COUNT(*) AS total_envios
            FROM DB_COPILOT_ACME.dbo.WhatsAppEnvioLog WITH (NOLOCK)
            WHERE DATA_ENVIO >= CONVERT(datetime, '{inicio_sql}', 112)
              AND DATA_ENVIO < DATEADD(day, 1, CONVERT(datetime, '{fim_sql}', 112))
            GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(NM_CEDENTE)), ''), 'Nao informado')
            ORDER BY total_envios DESC, nm_cedente
            """
        )

    def listar_envios_por_operador_log(self, inicio_sql: str, fim_sql: str) -> list[tuple]:
        return self.db.fetch_all(
            f"""
            SELECT TOP (10)
                ISNULL(NULLIF(LTRIM(RTRIM(OPERADOR)), ''), 'Nao informado') AS operador,
                COUNT(*) AS total_envios
            FROM DB_COPILOT_ACME.dbo.WhatsAppEnvioLog WITH (NOLOCK)
            WHERE DATA_ENVIO >= CONVERT(datetime, '{inicio_sql}', 112)
              AND DATA_ENVIO < DATEADD(day, 1, CONVERT(datetime, '{fim_sql}', 112))
            GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(OPERADOR)), ''), 'Nao informado')
            ORDER BY total_envios DESC, operador
            """
        )

    def get_provider_config(self, provider: str) -> WhatsAppProviderConfig:
        return self._provider_config(provider)

    def _provider_config(self, provider: str) -> WhatsAppProviderConfig:
        normalized = (provider or "").strip().lower()
        if normalized == "infobip":
            return WhatsAppProviderConfig(
                provider_name="INFOBIP",
                numbers_table="INFOBIP.TB_NUMEROS",
                templates_table="INFOBIP.TB_TEMPLATES",
                numbers_date_expr="TRY_CONVERT(datetime, DATA_CONSULTA, 121)",
                numbers_extra_select="STATUS_REMETENTE, QUALIDADE_RAW",
                numbers_extra_label_1="Status remetente",
                numbers_extra_label_2="Qualidade",
            )
        if normalized == "twilio":
            return WhatsAppProviderConfig(
                provider_name="TWILIO",
                numbers_table="twilio.TB_NUMEROS",
                templates_table="twilio.TB_TEMPLATES",
                numbers_date_expr="TRY_CONVERT(datetime, DATA_CONSULTA, 121)",
                numbers_extra_select="RISCO_NIVEL, ERRO_VERIFICACAO",
                numbers_extra_label_1="Risco",
                numbers_extra_label_2="Erro verificacao",
            )
        raise AtlasException("Provider de WhatsApp invalido.")

    def _build_where_controle(self, provider: str, inicio_sql: str, fim_sql: str) -> str:
        return (
            "WHERE "
            f"PROVEDOR = '{provider}' "
            f"AND DATA_REFERENCIA >= CONVERT(date, '{inicio_sql}', 112) "
            f"AND DATA_REFERENCIA < DATEADD(day, 1, CONVERT(date, '{fim_sql}', 112)) "
        )

    def _build_where_numbers(
        self,
        config: WhatsAppProviderConfig,
        inicio_sql: str,
        fim_sql: str,
        cedente: str | None,
        canal: str | None,
        status_numero: str | None,
    ) -> str:
        clauses = [f"{config.numbers_date_expr} IS NOT NULL"]
        if config.provider_name != "TWILIO":
            clauses.append(f"{config.numbers_date_expr} >= CONVERT(datetime, '{inicio_sql}', 112)")
        if cedente:
            clauses.append(f"CEDENTE = '{self._esc(cedente)}'")
        if canal:
            clauses.append(f"CANAL = '{self._esc(canal)}'")
        if status_numero:
            clauses.append(f"STATUS = '{self._esc(status_numero)}'")
        return "WHERE " + " AND ".join(clauses)

    def _build_where_templates(self, status_template: str | None, extra_condition: str | None = None) -> str:
        clauses = []
        if status_template:
            clauses.append(f"STATUS_APROVACAO = '{self._esc(status_template)}'")
        if extra_condition:
            clauses.append(extra_condition)
        if not clauses:
            return ""
        return "WHERE " + " AND ".join(clauses)

    def _build_where_valid_numbers(self, provider: str) -> str:
        if provider == "INFOBIP":
            return (
                "STATUS_REGISTRO = 'Ativado' "
                "AND STATUS_REMETENTE = 'Conectado' "
                "AND STATUS = 'high' "
                "AND ISNULL(LIMITE_MENSAGENS_24H, 0) >= 2000"
            )
        if provider == "TWILIO":
            return (
                "NUMERO IS NOT NULL "
                "AND LTRIM(RTRIM(NUMERO)) <> '' "
                "AND STATUS IS NOT NULL "
                "AND LOWER(LTRIM(RTRIM(STATUS))) <> 'low' "
                "AND LOWER(LTRIM(RTRIM(STATUS))) <> 'unavailable' "
                "AND LOWER(LTRIM(RTRIM(STATUS))) <> 'missing' "
                "AND FLUXO IS NOT NULL "
                "AND LTRIM(RTRIM(FLUXO)) <> ''"
            )
        raise AtlasException("Provider de WhatsApp invalido.")

    def _build_where_active_templates(self, provider: str) -> str:
        if provider == "INFOBIP":
            return "STATUS_APROVACAO LIKE 'Ativo%%'"
        if provider == "TWILIO":
            return "STATUS_APROVACAO = 'Aprovado'"
        raise AtlasException("Provider de WhatsApp invalido.")

    def _esc(self, value: str) -> str:
        return value.replace("'", "''")
