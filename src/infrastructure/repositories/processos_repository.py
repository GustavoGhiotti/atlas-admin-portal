import pyodbc

from src.infrastructure.databases.sql_server import SqlServerConnection, get_sql_server_66_master, get_sql_server_71_master


class ProcessosRepository:
    def __init__(self) -> None:
        self.databases: list[tuple[str, SqlServerConnection]] = [
            ("66", get_sql_server_66_master()),
            ("71", get_sql_server_71_master()),
        ]

    def listar_processos_ativos(self, login: str | None = None, somente_usuario: bool = True) -> list[dict[str, object]]:
        full_query, full_params = self._build_query(
            login=login,
            somente_usuario=somente_usuario,
            include_job_details=True,
            include_sql_text=True,
        )
        no_job_query, no_job_params = self._build_query(
            login=login,
            somente_usuario=somente_usuario,
            include_job_details=False,
            include_sql_text=True,
        )
        restricted_query, restricted_params = self._build_query(
            login=login,
            somente_usuario=somente_usuario,
            include_job_details=False,
            include_sql_text=False,
        )
        rows: list[dict[str, object]] = []

        for server_alias, db in self.databases:
            try:
                rows.extend(self._fetch_all_dicts(db, full_query, [server_alias, *full_params]))
            except pyodbc.ProgrammingError as exc:
                if not self._is_msdb_permission_error(exc):
                    rows.extend(self._fetch_all_dicts(db, restricted_query, [server_alias, *restricted_params]))
                    continue

                try:
                    rows.extend(self._fetch_all_dicts(db, no_job_query, [server_alias, *no_job_params]))
                except pyodbc.ProgrammingError:
                    rows.extend(self._fetch_all_dicts(db, restricted_query, [server_alias, *restricted_params]))

        return sorted(rows, key=lambda row: str(row.get("start_time") or ""), reverse=True)

    def _build_query(
        self,
        login: str | None = None,
        somente_usuario: bool = True,
        include_job_details: bool = True,
        include_sql_text: bool = True,
    ) -> tuple[str, list[object]]:
        where_clauses = []
        params: list[object] = []

        if somente_usuario:
            where_clauses.append("s.is_user_process = 1")

        if login:
            where_clauses.append("LOWER(s.login_name) LIKE LOWER(?) ESCAPE '\\'")
            params.append(f"%{self._escape_like(login.strip())}%")

        where = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        job_columns = (
            """
            j.name AS job_name,
            js.step_id AS job_step_id,
            js.step_name AS job_step_name,
            js.command AS job_step_command,
            """
            if include_job_details
            else """
            CAST(NULL AS VARCHAR(128)) AS job_name,
            CAST(NULL AS INT) AS job_step_id,
            CAST(NULL AS VARCHAR(128)) AS job_step_name,
            CAST(NULL AS VARCHAR(MAX)) AS job_step_command,
            """
        )
        job_joins = (
            """
        OUTER APPLY (
            SELECT
                CASE
                    WHEN s.program_name LIKE 'SQLAgent - TSQL JobStep (Job 0x% : Step %)'
                    THEN CONVERT(
                        UNIQUEIDENTIFIER,
                        CONVERT(
                            BINARY(16),
                            SUBSTRING(s.program_name, CHARINDEX('0x', s.program_name) + 2, 32),
                            2
                        )
                    )
                END AS job_id,
                TRY_CONVERT(
                    INT,
                    REPLACE(
                        REPLACE(
                            SUBSTRING(s.program_name, CHARINDEX(': Step ', s.program_name) + 7, 20),
                            ')',
                            ''
                        ),
                        ' ',
                        ''
                    )
                ) AS step_id
        ) parsed_job
        LEFT JOIN msdb.dbo.sysjobs j
            ON j.job_id = parsed_job.job_id
        LEFT JOIN msdb.dbo.sysjobsteps js
            ON js.job_id = parsed_job.job_id
           AND js.step_id = parsed_job.step_id
            """
            if include_job_details
            else ""
        )
        sql_text_column = "t.text AS sql_text" if include_sql_text else "CAST(NULL AS VARCHAR(MAX)) AS sql_text"
        sql_text_apply = "OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t" if include_sql_text else ""
        query = f"""
        SELECT
            CAST(? AS VARCHAR(20)) + ' - ' + CAST(@@SERVERNAME AS VARCHAR(128)) AS server_name,
            r.session_id,
            s.login_name,
            s.host_name,
            s.program_name,
            {job_columns}
            DB_NAME(r.database_id) AS database_name,
            r.status,
            r.command,
            CONVERT(VARCHAR(19), r.start_time, 120) AS start_time,
            r.cpu_time,
            r.total_elapsed_time,
            r.reads,
            r.writes,
            r.blocking_session_id,
            {sql_text_column}
        FROM sys.dm_exec_requests r
        INNER JOIN sys.dm_exec_sessions s
            ON r.session_id = s.session_id
        {sql_text_apply}
        {job_joins}
        {where}
        ORDER BY r.start_time DESC
        """
        return query, params

    def _fetch_all_dicts(
        self,
        db: SqlServerConnection,
        query: str,
        params: list[object] | None = None,
    ) -> list[dict[str, object]]:
        with db._connect() as connection:
            cursor = connection.cursor()
            db._execute(cursor, query, params)
            columns = [column[0] for column in cursor.description]
            return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]

    def _is_msdb_permission_error(self, exc: pyodbc.ProgrammingError) -> bool:
        message = str(exc).lower()
        return "permiss" in message and "msdb" in message

    def _escape_like(self, value: str) -> str:
        return (
            value.replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
            .replace("[", "\\[")
        )
