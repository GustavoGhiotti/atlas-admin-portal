from pydantic import BaseModel


class ProcessoAtivoResponse(BaseModel):
    server_name: str | None = None
    session_id: int
    login_name: str
    host_name: str | None = None
    program_name: str | None = None
    job_name: str | None = None
    job_step_id: int | None = None
    job_step_name: str | None = None
    job_step_command: str | None = None
    database_name: str | None = None
    status: str
    command: str
    start_time: str | None = None
    cpu_time: int
    total_elapsed_time: int
    reads: int
    writes: int
    blocking_session_id: int
    sql_text: str | None = None


class ListaProcessosResponse(BaseModel):
    atualizado_em: str
    total: int
    processos: list[ProcessoAtivoResponse]
