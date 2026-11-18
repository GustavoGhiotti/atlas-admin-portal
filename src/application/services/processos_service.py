from datetime import datetime

from src.infrastructure.repositories.processos_repository import ProcessosRepository


class ProcessosService:
    def __init__(self) -> None:
        self.repository = ProcessosRepository()

    def listar_processos_ativos(self, login: str | None = None, somente_usuario: bool = True) -> dict[str, object]:
        rows = self.repository.listar_processos_ativos(login=login, somente_usuario=somente_usuario)
        processos = [self._map_processo(row) for row in rows]
        return {
            "atualizado_em": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total": len(processos),
            "processos": processos,
        }

    def _map_processo(self, row: dict[str, object]) -> dict[str, object]:
        return {
            "server_name": self._optional_string(row.get("server_name")),
            "session_id": int(row.get("session_id") or 0),
            "login_name": str(row.get("login_name") or ""),
            "host_name": self._optional_string(row.get("host_name")),
            "program_name": self._optional_string(row.get("program_name")),
            "job_name": self._optional_string(row.get("job_name")),
            "job_step_id": self._optional_int(row.get("job_step_id")),
            "job_step_name": self._optional_string(row.get("job_step_name")),
            "job_step_command": self._optional_string(row.get("job_step_command")),
            "database_name": self._optional_string(row.get("database_name")),
            "status": str(row.get("status") or ""),
            "command": str(row.get("command") or ""),
            "start_time": self._optional_string(row.get("start_time")),
            "cpu_time": int(row.get("cpu_time") or 0),
            "total_elapsed_time": int(row.get("total_elapsed_time") or 0),
            "reads": int(row.get("reads") or 0),
            "writes": int(row.get("writes") or 0),
            "blocking_session_id": int(row.get("blocking_session_id") or 0),
            "sql_text": self._optional_string(row.get("sql_text")),
        }

    def _optional_string(self, value: object) -> str | None:
        text = str(value or "").strip()
        return text or None

    def _optional_int(self, value: object) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
