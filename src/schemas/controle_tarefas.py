from pydantic import BaseModel, Field


class TaskResumoResponse(BaseModel):
    total: int
    running: int
    ready: int
    disabled: int
    unknown: int


class TaskMonitoradaResponse(BaseModel):
    id: int
    nome: str
    pasta: str | None = None
    task_path: str
    task_name: str
    status: str
    proxima_execucao: str | None = None
    ultima_execucao: str | None = None
    ultimo_resultado_descricao: str | None = None


class ListaTasksResponse(BaseModel):
    resumo: TaskResumoResponse
    tarefas: list[TaskMonitoradaResponse]


class AcaoTaskResponse(BaseModel):
    status: str
    mensagem: str


class AcaoTaskRequest(BaseModel):
    task_id: int | None = Field(default=None, ge=1)
    task_path: str = Field(..., min_length=1)
    task_name: str = Field(..., min_length=1)


class TaskHistoricoResponse(BaseModel):
    id: int
    acao: str
    usuario: str
    status: str
    mensagem: str
    dt_execucao: str


class ListaHistoricoTaskResponse(BaseModel):
    historico: list[TaskHistoricoResponse]
