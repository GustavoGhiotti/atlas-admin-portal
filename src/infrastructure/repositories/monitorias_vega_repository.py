from __future__ import annotations

from src.infrastructure.databases.sql_server import SqlServerConnection
from src.infrastructure.services.env_load import get_env
from src.schemas.monitorias_vega import MonitoriaVegaPayload


class MonitoriasVegaRepository:
    _schema_pronto = False

    def __init__(self) -> None:
        self.db = SqlServerConnection(
            host=get_env("DB_HOST_66", default="10.0.0.66") or "10.0.0.66",
            database=get_env("DB_BIGGER_NEW", default="DB_BIGGER_NEW") or "DB_BIGGER_NEW",
            user=get_env("DB_USER", required=True),
            password=get_env("DB_PASSWORD", required=True),
        )
        self._garantir_schema()

    def _garantir_schema(self) -> None:
        if MonitoriasVegaRepository._schema_pronto:
            return
        self.db.execute("""
            IF SCHEMA_ID('treinamento') IS NULL EXEC('CREATE SCHEMA treinamento');
            IF OBJECT_ID('treinamento.monitorias_vega', 'U') IS NULL
                CREATE TABLE treinamento.monitorias_vega (
                    id_monitoria INT IDENTITY(1,1) PRIMARY KEY,
                    ano SMALLINT NOT NULL,
                    mes TINYINT NOT NULL,
                    semana TINYINT NOT NULL,
                    total INT NOT NULL CONSTRAINT DF_monitorias_vega_total DEFAULT 0,
                    conforme INT NOT NULL CONSTRAINT DF_monitorias_vega_conforme DEFAULT 0,
                    inconforme INT NOT NULL CONSTRAINT DF_monitorias_vega_inconforme DEFAULT 0,
                    atualizado_em DATETIME NOT NULL CONSTRAINT DF_monitorias_vega_data DEFAULT GETDATE(),
                    CONSTRAINT UQ_monitorias_vega UNIQUE (ano, mes, semana)
                );
        """, [])
        MonitoriasVegaRepository._schema_pronto = True

    def listar_ano(self, ano: int) -> list[tuple]:
        return self.db.fetch_all(
            """
            SELECT mes, semana, total, conforme, inconforme
              FROM treinamento.monitorias_vega WITH(NOLOCK)
             WHERE ano = ?
             ORDER BY mes, semana
            """,
            [ano],
        )

    def anos(self) -> list[int]:
        linhas = self.db.fetch_all(
            "SELECT DISTINCT ano FROM treinamento.monitorias_vega WITH(NOLOCK) ORDER BY ano DESC"
        )
        return [int(linha[0]) for linha in linhas]

    def upsert(self, payload: MonitoriaVegaPayload) -> None:
        self.db.execute(
            """
            UPDATE treinamento.monitorias_vega
               SET total = ?, conforme = ?, inconforme = ?, atualizado_em = GETDATE()
             WHERE ano = ? AND mes = ? AND semana = ?;
            IF @@ROWCOUNT = 0
                INSERT INTO treinamento.monitorias_vega (ano, mes, semana, total, conforme, inconforme)
                VALUES (?, ?, ?, ?, ?, ?);
            """,
            [
                payload.total, payload.conforme, payload.inconforme,
                payload.ano, payload.mes, payload.semana,
                payload.ano, payload.mes, payload.semana,
                payload.total, payload.conforme, payload.inconforme,
            ],
        )
