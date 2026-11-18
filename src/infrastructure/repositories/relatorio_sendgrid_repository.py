import random
from datetime import date, timedelta

from src.infrastructure.databases.sql_server import get_sql_server_66
from src.infrastructure.services.env_load import get_env
from src.shared.exception import AtlasException


class RelatorioSendGridRepository:
    def __init__(self) -> None:
        self.db = get_sql_server_66("DB_EMAIL")
        self.table_name = get_env("SENDGRID_EMAIL_TABLE", default="sendgrid.tb_email_disparo") or "sendgrid.tb_email_disparo"

    def listar_carteiras(self):
        return self.db.fetch_all(
            f"""
            SELECT ID_CEDENTE, NM_CARTEIRA
            FROM {self.table_name} WITH (NOLOCK)
            WHERE NM_CARTEIRA IS NOT NULL AND LTRIM(RTRIM(NM_CARTEIRA)) <> ''
            GROUP BY ID_CEDENTE, NM_CARTEIRA
            ORDER BY NM_CARTEIRA
            """
        )

    def listar_grupos(self):
        return self.db.fetch_all(
            f"""
            SELECT GRUPO
            FROM {self.table_name} WITH (NOLOCK)
            WHERE GRUPO IS NOT NULL AND LTRIM(RTRIM(GRUPO)) <> ''
            GROUP BY GRUPO
            ORDER BY GRUPO
            """
        )

    def listar_canais(self):
        return self.db.fetch_all(
            f"""
            SELECT CANAL
            FROM {self.table_name} WITH (NOLOCK)
            WHERE CANAL IS NOT NULL AND LTRIM(RTRIM(CANAL)) <> ''
            GROUP BY CANAL
            ORDER BY CANAL
            """
        )

    def listar_status(self):
        return self.db.fetch_all(
            f"""
            SELECT STATUS
            FROM {self.table_name} WITH (NOLOCK)
            WHERE STATUS IS NOT NULL AND LTRIM(RTRIM(STATUS)) <> ''
            GROUP BY STATUS
            ORDER BY STATUS
            """
        )

    def buscar_carteira_por_id(self, carteira_informada: int):
        return self.db.fetch_one(
            f"""
            SELECT TOP (1) ID_CEDENTE, NM_CARTEIRA
            FROM {self.table_name} WITH (NOLOCK)
            WHERE ID_CEDENTE = ?
              AND NM_CARTEIRA IS NOT NULL
              AND LTRIM(RTRIM(NM_CARTEIRA)) <> ''
            ORDER BY ID DESC
            """,
            [carteira_informada],
        )

    def buscar_carteira_por_nome(self, carteira_informada: str):
        return self.db.fetch_one(
            f"""
            SELECT TOP (1) ID_CEDENTE, NM_CARTEIRA
            FROM {self.table_name} WITH (NOLOCK)
            WHERE UPPER(LTRIM(RTRIM(NM_CARTEIRA))) = UPPER(?)
              AND NM_CARTEIRA IS NOT NULL
              AND LTRIM(RTRIM(NM_CARTEIRA)) <> ''
            ORDER BY ID DESC
            """,
            [carteira_informada],
        )

    def inserir_envio_teste(self, id_cliente: int, id_cedente: int, nm_carteira: str, grupo: str, canal: str, email_cliente: str, email_empresa: str, id_template: str, variaveis_json: str):
        return self.db.fetch_one(
            f"""
            INSERT INTO {self.table_name} (
                ID_CLIENTE,
                ID_CEDENTE,
                NM_CARTEIRA,
                GRUPO,
                CANAL,
                EMAIL_CLIENTE,
                EMAIL_EMPRESA,
                ID_TEMPLATE,
                VARIAVEIS_JSON,
                STATUS
            )
            OUTPUT INSERTED.ID, INSERTED.ID_CLIENTE, INSERTED.NM_CARTEIRA, INSERTED.ID_CEDENTE, INSERTED.STATUS
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [id_cliente, id_cedente, nm_carteira, grupo, canal, email_cliente, email_empresa, id_template, variaveis_json, "PENDENTE"],
        )

    def buscar_envio_teste_por_id_cliente(self, id_cliente: int):
        return self.db.fetch_one(
            f"""
            SELECT TOP (1)
                ID,
                ID_CLIENTE,
                ID_CEDENTE,
                NM_CARTEIRA,
                GRUPO,
                CANAL,
                EMAIL_CLIENTE,
                EMAIL_EMPRESA,
                ID_TEMPLATE,
                VARIAVEIS_JSON,
                STATUS,
                DT_INCLUSAO,
                DT_ENVIO
            FROM {self.table_name} WITH (NOLOCK)
            WHERE ID_CLIENTE = ?
            """,
            [id_cliente],
        )

    def id_cliente_existe(self, candidato: int):
        return self.db.fetch_one(
            f"""
            SELECT TOP (1) 1
            FROM {self.table_name} WITH (NOLOCK)
            WHERE ID_CLIENTE = ?
            """,
            [candidato],
        )

    def gerar_id_cliente_teste(self) -> int:
        for _ in range(30):
            candidato = random.randint(10_000_000, 999_999_999)
            if not self.id_cliente_existe(candidato):
                return candidato
        raise AtlasException("Nao foi possivel gerar um ID Cliente unico para o envio teste.")

    def buscar_resumo_dashboard(
        self,
        inicio: date,
        fim: date,
        carteira: str | None,
        grupo: str | None,
        canal: str | None,
        status: str | None,
    ):
        where = self._build_where(inicio, fim, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT
                COUNT(*) AS total_envios,
                CAST(100.0 * SUM(CASE WHEN STATUS = 'SUCESSO' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(10,2)) AS taxa_sucesso_pct,
                CAST(100.0 * SUM(CASE WHEN STATUS <> 'SUCESSO' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(10,2)) AS taxa_erro_pct,
                AVG(
                    CAST(
                        CASE
                            WHEN DT_INCLUSAO IS NOT NULL AND DT_ENVIO IS NOT NULL
                            THEN DATEDIFF(SECOND, DT_INCLUSAO, DT_ENVIO)
                            ELSE NULL
                        END AS DECIMAL(18,2)
                    )
                ) AS tempo_medio_envio
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            """
        )[0]

    def listar_envios_por_dia(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        where = self._build_where(inicio, fim, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT CAST(DT_ENVIO AS DATE) AS dia, COUNT(*) AS total_envios
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            GROUP BY CAST(DT_ENVIO AS DATE)
            ORDER BY dia
            """
        )

    def listar_envios_por_semana(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        inicio_semana = inicio - timedelta(days=inicio.weekday())
        fim_semana = fim + timedelta(days=(6 - fim.weekday()))
        where = self._build_where(inicio_semana, fim_semana, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT CAST(DT_ENVIO AS DATE) AS dia, COUNT(*) AS total_envios
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            GROUP BY CAST(DT_ENVIO AS DATE)
            ORDER BY dia
            """
        )

    def listar_envios_por_mes(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        inicio_mes = inicio.replace(day=1)
        if fim.month == 12:
            proximo_mes = fim.replace(year=fim.year + 1, month=1, day=1)
        else:
            proximo_mes = fim.replace(month=fim.month + 1, day=1)
        fim_mes = proximo_mes - timedelta(days=1)
        where = self._build_where(inicio_mes, fim_mes, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT CAST(DT_ENVIO AS DATE) AS dia, COUNT(*) AS total_envios
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            GROUP BY CAST(DT_ENVIO AS DATE)
            ORDER BY dia
            """
        )

    def listar_envios_por_carteira(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        where = self._build_where(inicio, fim, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT NM_CARTEIRA, COUNT(*) AS total_envios
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            GROUP BY NM_CARTEIRA
            ORDER BY total_envios DESC
            """
        )

    def listar_envios_por_grupo(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        where = self._build_where(inicio, fim, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT GRUPO, COUNT(*) AS total_envios
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            GROUP BY GRUPO
            ORDER BY total_envios DESC
            """
        )

    def listar_envios_por_canal(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        where = self._build_where(inicio, fim, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT CANAL, COUNT(*) AS total_envios
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            GROUP BY CANAL
            ORDER BY total_envios DESC
            """
        )

    def listar_status_dashboard(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        where = self._build_where(inicio, fim, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT STATUS, COUNT(*) AS total
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            GROUP BY STATUS
            ORDER BY total DESC
            """
        )

    def listar_templates_dashboard(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        where = self._build_where(inicio, fim, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT TOP (10) ID_TEMPLATE, COUNT(*) AS total_envios
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            GROUP BY ID_TEMPLATE
            ORDER BY total_envios DESC
            """
        )

    def listar_detalhes_dashboard(self, inicio: date, fim: date, carteira: str | None, grupo: str | None, canal: str | None, status: str | None):
        where = self._build_where(inicio, fim, carteira, grupo, canal, status)
        return self.db.fetch_all(
            f"""
            SELECT
                ID,
                ID_CLIENTE,
                ID_CEDENTE,
                NM_CARTEIRA,
                GRUPO,
                CANAL,
                EMAIL_CLIENTE,
                EMAIL_EMPRESA,
                ID_TEMPLATE,
                VARIAVEIS_JSON,
                STATUS,
                DT_INCLUSAO,
                DT_ENVIO
            FROM {self.table_name} WITH (NOLOCK)
            {where}
            ORDER BY DT_ENVIO DESC, ID DESC
            """
        )

    def _build_where(
        self,
        inicio: date,
        fim: date,
        carteira: str | None,
        grupo: str | None,
        canal: str | None,
        status: str | None,
    ) -> str:
        inicio_sql = inicio.strftime("%Y%m%d")
        fim_sql = (fim + timedelta(days=1)).strftime("%Y%m%d")

        def esc(value: str) -> str:
            return value.replace("'", "''")

        clauses = [
            f"DT_ENVIO >= CONVERT(datetime, '{inicio_sql}', 112)",
            f"DT_ENVIO < CONVERT(datetime, '{fim_sql}', 112)",
        ]
        if carteira:
            if not carteira.isdigit():
                raise AtlasException("Carteira invalida.")
            clauses.append(f"ID_CEDENTE = {carteira}")
        if grupo:
            clauses.append(f"GRUPO = '{esc(grupo)}'")
        if canal:
            clauses.append(f"CANAL = '{esc(canal)}'")
        if status:
            clauses.append(f"STATUS = '{esc(status)}'")
        return "WHERE " + " AND ".join(clauses)
