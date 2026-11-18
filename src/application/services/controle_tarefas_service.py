from collections import Counter

from src.infrastructure.external.task_control_api.client import TaskControlApiClient
from src.infrastructure.services.logger_config import setup_logger
from src.shared.exception import IntegracaoException


logger = setup_logger("atlas.controle-tarefas")


class ControleTarefasService:
    def __init__(self) -> None:
        self.client = TaskControlApiClient()

    def listar_tarefas(self) -> dict[str, object]:
        response = self.client.get("/tasks/")
        payload = self._ensure_success(response.data, response.message)
        tarefas = [self._map_task(item) for item in payload]
        resumo = Counter(tarefa["status"] for tarefa in tarefas)

        return {
            "tarefas": tarefas,
            "resumo": {
                "total": len(tarefas),
                "running": resumo.get("running", 0),
                "ready": resumo.get("ready", 0),
                "disabled": resumo.get("disabled", 0),
                "unknown": resumo.get("unknown", 0),
            },
        }

    def buscar_task_id(self, task_path: str, task_name: str) -> int:
        response = self.client.get("/tasks/")
        payload = self._ensure_success(response.data, response.message)
        task_path_normalized = self._normalize_task_path(task_path)
        task_name_normalized = str(task_name or "").strip().lower()

        for item in payload:
            current_path = self._normalize_task_path(item.get("task_path") or item.get("TASK_PATH") or "")
            current_name = str(item.get("task_name") or item.get("TASK_NAME") or item.get("nome") or "").strip().lower()
            if current_path == task_path_normalized and current_name == task_name_normalized:
                return int(item.get("id") or 0)

        raise IntegracaoException("Task nao encontrada na API de controle para o caminho informado.")

    def executar_acao_em_segundo_plano(
        self,
        task_id: int,
        acao: str,
        usuario: str,
        task_path: str,
        task_name: str,
    ) -> None:
        try:
            self.client.post(f"/tasks/{task_id}/{acao}", params={"usuario": usuario})
        except Exception:
            logger.exception(
                "Falha ao executar acao assincrona de task.",
                extra={
                    "task_id": task_id,
                    "acao": acao,
                    "usuario": usuario,
                    "task_path": task_path,
                    "task_name": task_name,
                },
            )

    def listar_historico(self, task_path: str, task_name: str) -> dict[str, object]:
        task_id = self.buscar_task_id(task_path, task_name)
        response = self.client.get(f"/tasks/{task_id}/historico")
        payload = self._ensure_success(response.data, response.message)
        historico = [
            {
                "id": int(item.get("ID") or 0),
                "acao": str(item.get("ACAO") or ""),
                "usuario": str(item.get("USUARIO") or ""),
                "status": str(item.get("STATUS") or ""),
                "mensagem": str(item.get("MENSAGEM") or ""),
                "dt_execucao": str(item.get("DT_EXECUCAO") or ""),
            }
            for item in payload
        ]
        return {"historico": historico}

    def _ensure_success(self, data: object | None, message: str) -> list[dict[str, object]] | dict[str, object]:
        if data is None:
            raise IntegracaoException(message or "A API de controle de tarefas nao retornou dados.")
        return data  # type: ignore[return-value]

    def _map_task(self, item: dict[str, object]) -> dict[str, object]:
        status = str(item.get("status") or "unknown").strip().lower() or "unknown"
        if status not in {"running", "ready", "disabled"}:
            status = "unknown"

        nome = str(item.get("nome") or "")
        task_path = self._normalize_task_path(item.get("task_path") or item.get("TASK_PATH") or item.get("path") or "")
        task_name = str(item.get("task_name") or item.get("TASK_NAME") or nome or "").strip()
        pasta = self._resolve_folder(task_path)

        return {
            "id": int(item.get("id") or 0),
            "nome": nome,
            "pasta": pasta,
            "task_path": task_path,
            "task_name": task_name,
            "status": status,
            "proxima_execucao": item.get("proxima_execucao"),
            "ultima_execucao": item.get("ultima_execucao"),
            "ultimo_resultado_descricao": item.get("ultimo_resultado_descricao"),
        }

    def _resolve_folder(self, task_path: str) -> str:
        normalized_path = task_path.strip().replace("\\", "/").strip("/")
        if not normalized_path:
            return ""
        return normalized_path

    def _normalize_task_path(self, task_path: object) -> str:
        normalized = str(task_path or "").strip().replace("/", "\\")
        while "\\\\" in normalized:
            normalized = normalized.replace("\\\\", "\\")
        if not normalized:
            return ""
        if not normalized.startswith("\\"):
            normalized = f"\\{normalized}"
        if not normalized.endswith("\\"):
            normalized = f"{normalized}\\"
        return normalized
