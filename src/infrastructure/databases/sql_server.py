from collections.abc import Sequence

import pyodbc

from src.infrastructure.services.env_load import get_env


# ---------------------------------------------------------------------------
# Timeouts (segundos). O ponto-chave da correcao: sem timeout, um banco travado
# deixa a conexao pendurada, esgota as threads e derruba o app inteiro (inclusive
# o login). Com timeout curto, a operacao FALHA RAPIDO em vez de pendurar.
#   - login_timeout: tempo para ABRIR a conexao (pyodbc connect timeout)
#   - query_timeout: tempo para EXECUTAR a query (connection.timeout)
# Conexoes de log usam timeout ainda menor, pois log nunca pode segurar nada.
# ---------------------------------------------------------------------------
def _int_env(name: str, default: int) -> int:
    try:
        return int((get_env(name, default=str(default)) or str(default)).strip())
    except ValueError:
        return default


LOGIN_TIMEOUT_SECONDS = _int_env("DB_LOGIN_TIMEOUT", 5)
QUERY_TIMEOUT_SECONDS = _int_env("DB_QUERY_TIMEOUT", 30)
LOG_LOGIN_TIMEOUT_SECONDS = _int_env("DB_LOG_LOGIN_TIMEOUT", 3)
LOG_QUERY_TIMEOUT_SECONDS = _int_env("DB_LOG_QUERY_TIMEOUT", 5)


class SqlServerConnection:
    def __init__(
        self,
        host: str,
        database: str,
        user: str,
        password: str,
        login_timeout: int = LOGIN_TIMEOUT_SECONDS,
        query_timeout: int = QUERY_TIMEOUT_SECONDS,
    ) -> None:
        self.host = host
        self.database = database
        self.user = user
        self.password = password
        self.login_timeout = login_timeout
        self.query_timeout = query_timeout

    def _connect(self) -> pyodbc.Connection:
        connection_string = (
            "DRIVER={ODBC Driver 17 for SQL Server};"
            f"SERVER={self.host};"
            f"DATABASE={self.database};"
            f"UID={self.user};"
            f"PWD={self.password};"
            "TrustServerCertificate=YES"
        )
        # timeout do connect() = login timeout (abrir a conexao)
        connection = pyodbc.connect(connection_string, timeout=self.login_timeout)
        # connection.timeout = timeout de execucao de cada query
        connection.timeout = self.query_timeout
        return connection

    def fetch_all(self, query: str, params: Sequence | None = None, query_name: str | None = None) -> list[tuple]:
        with self._connect() as connection:
            cursor = connection.cursor()
            self._execute(cursor, query, params)
            return cursor.fetchall()

    def fetch_one(self, query: str, params: Sequence | None = None, query_name: str | None = None):
        with self._connect() as connection:
            cursor = connection.cursor()
            self._execute(cursor, query, params)
            return cursor.fetchone()

    def execute(self, query: str, params: Sequence | None = None, query_name: str | None = None) -> None:
        with self._connect() as connection:
            cursor = connection.cursor()
            self._execute(cursor, query, params)
            connection.commit()

    def executemany(self, query: str, params_list: Sequence[Sequence], query_name: str | None = None) -> None:
        with self._connect() as connection:
            cursor = connection.cursor()
            cursor.fast_executemany = True
            cursor.executemany(query, params_list)
            connection.commit()

    def _execute(self, cursor, query: str, params: Sequence | None = None) -> None:
        if params:
            cursor.execute(query, *params)
            return
        cursor.execute(query)


def get_sql_server_66(database_env_name: str, query_timeout: int | None = None) -> SqlServerConnection:
    connection = SqlServerConnection(
        host=get_env("DB_HOST_66", required=True),
        database=get_env(database_env_name, required=True),
        user=get_env("DB_USER", required=True),
        password=get_env("DB_PASSWORD", required=True),
    )
    # Permite override do timeout de query (ex.: relatorios pesados). 0 = sem timeout.
    if query_timeout is not None:
        connection.query_timeout = query_timeout
    return connection


def get_sql_server_66_master() -> SqlServerConnection:
    return SqlServerConnection(
        host=get_env("DB_HOST_66", required=True),
        database="master",
        user=get_env("DB_USER", required=True),
        password=get_env("DB_PASSWORD", required=True),
    )


def get_sql_server_65(database: str = "EASYCOLLECTOR") -> SqlServerConnection:
    return SqlServerConnection(
        host=get_env("DB_HOST_65", default="10.0.0.65") or "10.0.0.65",
        database=database,
        user=get_env("DB_USER", required=True),
        password=get_env("DB_PASSWORD", required=True),
    )


def get_sql_server_71(database_env_name: str) -> SqlServerConnection:
    return SqlServerConnection(
        host=get_env("DB_HOST_71", default="10.0.0.71") or "10.0.0.71",
        database=get_env(database_env_name, required=True),
        user=get_env("DB_USER", required=True),
        password=get_env("DB_PASSWORD", required=True),
    )


def get_sql_server_71_master() -> SqlServerConnection:
    return SqlServerConnection(
        host=get_env("DB_HOST_71", default="10.0.0.71") or "10.0.0.71",
        database="master",
        user=get_env("DB_USER", required=True),
        password=get_env("DB_PASSWORD", required=True),
    )


# ---------------------------------------------------------------------------
# Conexao DEDICADA de log (LOGS_ROBOS). Separada de proposito do banco de
# login e com timeout curto: se o LOGS_ROBOS travar, so a gravacao de log
# falha (rapido), o Atlas continua funcionando.
# ---------------------------------------------------------------------------
def get_sql_log() -> SqlServerConnection:
    return SqlServerConnection(
        host=get_env("DB_HOST_66", required=True),
        database=get_env("DB_LOGS", default="LOGS_ROBOS") or "LOGS_ROBOS",
        user=get_env("DB_USER", required=True),
        password=get_env("DB_PASSWORD", required=True),
        login_timeout=LOG_LOGIN_TIMEOUT_SECONDS,
        query_timeout=LOG_QUERY_TIMEOUT_SECONDS,
    )
