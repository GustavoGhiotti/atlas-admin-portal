from datetime import date, timedelta

from src.infrastructure.repositories import WhatsAppRepository

class RelatorioWhatsAppService:
    def __init__(self) -> None:
        self.repository = WhatsAppRepository()

    def consultar_dashboard(
        self,
        provider: str,
        inicio: date,
        fim: date,
        cedente: str | None = None,
        canal: str | None = None,
        status_numero: str | None = None,
        status_template: str | None = None,
    ) -> dict[str, object]:
        config = self.repository.get_provider_config(provider)
        inicio_sql = inicio.strftime("%Y%m%d")
        fim_sql = (fim + timedelta(days=1)).strftime("%Y%m%d")

        resumo = self.repository.buscar_resumo_controle(provider, inicio_sql, fim_sql)
        total_numeros = self.repository.buscar_total_numeros(provider, inicio_sql, fim_sql, cedente, canal, status_numero)
        resumo_numeros = self.repository.buscar_resumo_numeros(provider, inicio_sql, fim_sql, cedente, canal, status_numero)
        total_templates = self.repository.buscar_total_templates(provider, inicio_sql, fim_sql, status_template)
        resumo_templates = self.repository.buscar_resumo_templates(provider, inicio_sql, fim_sql, status_template)
        envios_diarios = self.repository.listar_envios_por_periodo(provider, inicio_sql, fim_sql)
        envios_por_semana = self.repository.listar_envios_por_semana(provider, fim)
        envios_por_mes = self.repository.listar_envios_por_mes(provider, fim)
        envios_por_carteira = self.repository.listar_envios_por_carteira_log(inicio_sql, fim_sql)
        envios_por_operador = self.repository.listar_envios_por_operador_log(inicio_sql, fim_sql)
        controle_envios = self.repository.listar_controle_envios(provider, inicio_sql, fim_sql)
        numeros = self.repository.listar_numeros(provider, inicio_sql, fim_sql, cedente, canal, status_numero)
        templates = self.repository.listar_templates(provider, inicio_sql, fim_sql, status_template)

        return {
            "resumo": {
                "total_envios": int((resumo[0] if resumo else 0) or 0),
                "ultimo_envio_hora": self._fmt_time(resumo[1]) if resumo and len(resumo) > 1 and resumo[1] else "",
                "total_numeros": int((total_numeros[0] if total_numeros else 0) or 0),
                "total_validos": int((resumo_numeros[0] if resumo_numeros else 0) or 0),
                "total_templates": int((total_templates[0] if total_templates else 0) or 0),
                "templates_ativos": int((resumo_templates[0] if resumo_templates else 0) or 0),
            },
            "envios_por_semana": self._fill_periodo(
                fim - timedelta(days=fim.weekday()),
                fim - timedelta(days=fim.weekday()) + timedelta(days=6),
                envios_por_semana,
            ),
            "envios_por_mes": self._fill_periodo(
                fim.replace(day=1),
                self._ultimo_dia_mes(fim),
                envios_por_mes,
            ),
            "envios_diarios_periodo": self._fill_periodo(
                inicio,
                fim,
                envios_diarios,
            ),
            "envios_por_carteira": [
                {"label": str(row[0] or ""), "total_envios": int(row[1] or 0)}
                for row in envios_por_carteira
            ],
            "envios_por_operador": [
                {"label": str(row[0] or ""), "total_envios": int(row[1] or 0)}
                for row in envios_por_operador
            ],
            "controle_envios": [
                {
                    "numero": str(row[0] or ""),
                    "data_referencia": self._fmt(row[1]) if row[1] else "",
                    "qtd_envios": int(row[2] or 0),
                    "dt_ultimo_envio": self._fmt(row[3]) if row[3] else "",
                    "dt_criacao": self._fmt(row[4]) if row[4] else "",
                    "dt_atualizacao": self._fmt(row[5]) if row[5] else "",
                }
                for row in controle_envios
            ],
            "numeros": [
                {
                    "numero": str(row[0] or ""),
                    "status": str(row[1] or ""),
                    "cedente": str(row[2] or ""),
                    "canal": str(row[3] or ""),
                    "data_consulta": self._fmt(row[4]) if row[4] else "",
                    "extra_1": str(row[5] or ""),
                    "extra_2": str(row[6] or ""),
                }
                for row in numeros
            ],
            "templates": [
                {
                    "sid_template": str(row[0] or ""),
                    "nome_template": str(row[1] or ""),
                    "status_aprovacao": str(row[2] or ""),
                    "data_aprovacao": self._fmt(row[3]) if row[3] else "",
                    "dt_inclusao": self._fmt(row[4]) if row[4] else "",
                    "lingua": str(row[5] or ""),
                }
                for row in templates
            ],
            "meta": {
                "provider": config.provider_name,
                "numbers_extra_label_1": config.numbers_extra_label_1,
                "numbers_extra_label_2": config.numbers_extra_label_2,
            },
        }

    def _fmt(self, value) -> str:
        return value.isoformat() if hasattr(value, "isoformat") else str(value)

    def _fmt_time(self, value) -> str:
        if hasattr(value, "strftime"):
            return value.strftime("%H:%M")
        text = str(value or "")
        if "T" in text:
            text = text.split("T", 1)[1]
        if " " in text:
            text = text.split(" ", 1)[1]
        return text[:5]

    def _fill_periodo(self, inicio: date, fim: date, rows: list[tuple]) -> list[dict[str, object]]:
        valores = {
            self._to_date(row[0]): int(row[1] or 0)
            for row in rows
            if row and row[0]
        }
        atual = inicio
        serie: list[dict[str, object]] = []
        while atual <= fim:
            serie.append({
                "periodo": atual.isoformat(),
                "total_envios": valores.get(atual, 0),
            })
            atual += timedelta(days=1)
        return serie

    def _to_date(self, value) -> date:
        if isinstance(value, date):
            return value
        texto = str(value)
        if " " in texto:
            texto = texto.split(" ", 1)[0]
        if "T" in texto:
            texto = texto.split("T", 1)[0]
        return date.fromisoformat(texto)

    def _ultimo_dia_mes(self, referencia: date) -> date:
        if referencia.month == 12:
            return referencia.replace(month=12, day=31)
        proximo_mes = referencia.replace(day=28) + timedelta(days=4)
        return proximo_mes.replace(day=1) - timedelta(days=1)
