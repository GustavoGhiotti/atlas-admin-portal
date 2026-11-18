from __future__ import annotations

from collections.abc import Sequence

from src.infrastructure.databases.sql_server import SqlServerConnection


class ImportacaoBancoRepository:
    def __init__(self, db: SqlServerConnection) -> None:
        self.db = db

    def listar_bancos(self) -> list[tuple]:
        return self.db.fetch_all(
            """
            SELECT
                name
            FROM sys.databases
            WHERE state_desc = 'ONLINE'
              AND database_id > 4
              AND source_database_id IS NULL
              AND HAS_DBACCESS(name) = 1
            ORDER BY name
            """
        )

    def listar_tabelas(self) -> list[tuple]:
        return self.db.fetch_all(
            """
            SELECT
                s.name AS schema_name,
                t.name AS table_name
            FROM sys.tables t
            INNER JOIN sys.schemas s
                ON s.schema_id = t.schema_id
            WHERE t.is_ms_shipped = 0
            ORDER BY s.name, t.name
            """
        )

    def listar_colunas(self, schema_name: str, table_name: str) -> list[tuple]:
        return self.db.fetch_all(
            """
            SELECT
                c.column_id,
                c.name AS column_name,
                ty.name AS data_type,
                CAST(c.is_nullable AS INT) AS is_nullable,
                CAST(c.is_identity AS INT) AS is_identity,
                CAST(c.is_computed AS INT) AS is_computed,
                CASE WHEN c.default_object_id > 0 THEN 1 ELSE 0 END AS has_default,
                c.max_length,
                c.precision,
                c.scale
            FROM sys.tables t
            INNER JOIN sys.schemas s
                ON s.schema_id = t.schema_id
            INNER JOIN sys.columns c
                ON c.object_id = t.object_id
            INNER JOIN sys.types ty
                ON ty.user_type_id = c.user_type_id
            WHERE s.name = ? AND t.name = ?
            ORDER BY c.column_id
            """,
            [schema_name, table_name],
        )

    def tabela_existe(self, schema_name: str, table_name: str) -> bool:
        row = self.db.fetch_one(
            """
            SELECT TOP 1 1
            FROM sys.tables t
            INNER JOIN sys.schemas s
                ON s.schema_id = t.schema_id
            WHERE s.name = ? AND t.name = ?
            """,
            [schema_name, table_name],
        )
        return bool(row)

    def criar_tabela_bulk(self, schema_name: str, table_name: str, columns: Sequence[str]) -> None:
        if not columns:
            return

        safe_schema = self._quote_identifier(schema_name)
        safe_table = self._quote_identifier(table_name)
        columns_sql = ", ".join(f"{self._quote_identifier(column)} NVARCHAR(MAX) NULL" for column in columns)

        self.db.execute(
            f"CREATE TABLE {safe_schema}.{safe_table} ({columns_sql})"
        )

    def inserir_linhas(
        self,
        schema_name: str,
        table_name: str,
        columns: Sequence[str],
        rows: Sequence[Sequence[object]],
    ) -> None:
        if not columns or not rows:
            return

        safe_schema = self._quote_identifier(schema_name)
        safe_table = self._quote_identifier(table_name)
        safe_columns = ", ".join(self._quote_identifier(column) for column in columns)
        placeholders = ", ".join("?" for _ in columns)

        self.db.executemany(
            f"INSERT INTO {safe_schema}.{safe_table} ({safe_columns}) VALUES ({placeholders})",
            rows,
        )

    def _quote_identifier(self, value: str) -> str:
        return f"[{str(value).replace(']', ']]')}]"
