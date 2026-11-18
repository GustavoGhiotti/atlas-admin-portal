import { useEffect, useState } from "react";

import DataTable from "@/components/tables/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/contexts/ToastContext";
import {
  executarAcaoControleTarefa,
  getApiError,
  listarControleTarefas,
  type ControleTarefasResponse,
  type TaskMonitorada,
} from "@/services/atlasApi";

function statusTone(status: string) {
  switch (status) {
    case "running":
      return "accent";
    case "ready":
      return "success";
    case "disabled":
      return "danger";
    default:
      return "warning";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "running":
      return "Executando";
    case "ready":
      return "Pronta";
    case "disabled":
      return "Desabilitada";
    default:
      return "Indefinida";
  }
}

export default function ControleTarefas() {
  const ALL_FOLDERS = "__todas__";
  const ROOT_FOLDER = "__geral__";
  const [dados, setDados] = useState<ControleTarefasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [viewFolder, setViewFolder] = useState(ROOT_FOLDER);
  const toast = useToast();

  const tarefas = dados?.tarefas || [];
  const folderOptions = Array.from(
    new Set(tarefas.map((task) => (task.pasta || "").trim()).filter((folder) => folder.length > 0)),
  ).sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
  const availableFolders = [ROOT_FOLDER, ...folderOptions];
  const folderColumns = Math.min(4, Math.max(1, availableFolders.length));
  const currentFolderTasks = tarefas.filter((task) => {
    if (viewFolder === ALL_FOLDERS) return true;
    return viewFolder === ROOT_FOLDER ? !(task.pasta || "").trim() : task.pasta === viewFolder;
  });

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!availableFolders.includes(viewFolder)) {
      setViewFolder(ALL_FOLDERS);
    }
  }, [availableFolders, viewFolder]);

  async function load() {
    setLoading(true);
    setPageError("");
    try {
      setDados(await listarControleTarefas());
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao carregar as tarefas monitoradas.");
      setPageError(message);
      toast.error("Falha no carregamento", message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshTasks();
      setPageError("");
      toast.success("Leitura atualizada", "As tarefas foram atualizadas com sucesso.");
    } catch (requestError) {
      toast.error("Falha na atualizacao", getApiError(requestError, "Nao foi possivel atualizar a leitura das tarefas."));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAction(task: TaskMonitorada, acao: "executar" | "finalizar" | "habilitar" | "desabilitar") {
    const key = `${task.task_path}|${task.task_name}:${acao}`;
    setBusyAction(key);
    try {
      await executarAcaoControleTarefa(task.id, task.task_path, task.task_name, acao);
      window.setTimeout(() => {
        void refreshTasksWithRetry();
      }, 1200);
      toast.success(actionSuccessTitle(acao), `${task.nome}: ${actionSuccessMessage(acao)}`);
    } catch (requestError) {
      toast.error(actionErrorTitle(acao), `${task.nome}: ${getApiError(requestError, actionErrorMessage(acao))}`);
    } finally {
      setBusyAction("");
    }
  }

  async function refreshTasks() {
    const nextData = await listarControleTarefas();
    setDados(nextData);
    setPageError("");
    return nextData;
  }

  async function refreshTasksWithRetry() {
    let lastData: ControleTarefasResponse | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      lastData = await refreshTasks();
      if (attempt < 2) {
        await delay(900);
      }
    }

    return lastData;
  }

  return (
    <div className="stack-md operacoes-page">
      <PageHeader
        eyebrow="Operacoes / Agendador"
        title="Controle de tarefas"
        description="Monitore tasks do agendador e execute acoes remotas sem acessar o host."
        actions={
          <button className="button button--secondary" type="button" onClick={handleRefresh} disabled={loading || refreshing}>
            {refreshing ? "Atualizando..." : "Atualizar leitura"}
          </button>
        }
      />

      <section className="kpi-grid">
        <KpiCard label="Total" value={dados?.resumo.total || 0} helper="Tasks monitoradas na base do controlador." />
        <KpiCard label="Executando" value={dados?.resumo.running || 0} helper="Acompanhe tasks em execucao para agir em desvios." tone="accent" />
        <KpiCard label="Prontas" value={dados?.resumo.ready || 0} helper="Priorize tasks habilitadas e aguardando nova execucao." tone="success" />
        <KpiCard label="Desabilitadas" value={dados?.resumo.disabled || 0} helper="Identifique tasks bloqueadas e recupere a operacao." tone="danger" />
      </section>

      <section className="surface-card surface-card--compact">
        {loading ? (
          <div className="page-loader">Carregando tasks monitoradas...</div>
        ) : pageError ? (
          <div className="alert alert--danger">Nao foi possivel carregar as tasks monitoradas no momento.</div>
        ) : (
          <div className="stack-lg">
            <div className="field">
              <span>Pastas</span>
              <button
                className={`button folder-grid__button ${viewFolder === ALL_FOLDERS ? "button--secondary" : "button--ghost-neutral"}`}
                type="button"
                onClick={() => setViewFolder(ALL_FOLDERS)}
              >
                Todas ({tarefas.length})
              </button>
              <div className="folder-grid" style={{ gridTemplateColumns: `repeat(${folderColumns}, minmax(0, 1fr))` }}>
                {availableFolders.map((folder) => {
                  const label = folder === ROOT_FOLDER ? "Geral" : folder;
                  const count = tarefas.filter((task) => (folder === ROOT_FOLDER ? !(task.pasta || "").trim() : task.pasta === folder)).length;
                  return (
                    <button
                      key={folder}
                      className={`button folder-grid__button ${viewFolder === folder ? "button--secondary" : "button--ghost-neutral"}`}
                      type="button"
                      onClick={() => setViewFolder(folder)}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <DataTable
              className="controle-tarefas-table"
              title={`Monitore operacoes do agendador${viewFolder === ALL_FOLDERS ? " - Todas" : viewFolder === ROOT_FOLDER ? " - Geral" : ` - ${viewFolder}`}`}
              exportFileName="controle-tarefas.csv"
              pageSize={12}
              searchPlaceholder="Buscar por task, status ou ultimo resultado"
              initialSortColumn="nome"
              initialSortDirection="asc"
              data={currentFolderTasks}
              columns={[
                {
                  id: "nome",
                  title: "Task",
                  accessor: (row) => row.nome,
                  sortable: true,
                  render: (row) => <div className="controle-tarefas__task-name">{row.nome}</div>,
                },
                {
                  id: "status",
                  title: "Status",
                  accessor: (row) => statusLabel(row.status),
                  sortable: true,
                  render: (row) => <span className={`status-pill status-pill--${statusTone(row.status)}`}>{statusLabel(row.status)}</span>,
                },
                {
                  id: "proxima_execucao",
                  title: "Proxima execucao",
                  accessor: (row) => row.proxima_execucao || "-",
                  sortable: true,
                  render: (row) => <div className="controle-tarefas__date">{row.proxima_execucao || "-"}</div>,
                },
                {
                  id: "ultima_execucao",
                  title: "Ultima execucao",
                  accessor: (row) => row.ultima_execucao || "-",
                  sortable: true,
                  render: (row) => <div className="controle-tarefas__date">{row.ultima_execucao || "-"}</div>,
                },
                {
                  id: "ultimo_resultado_descricao",
                  title: "Ultimo resultado",
                  accessor: (row) => row.ultimo_resultado_descricao || "-",
                  sortable: true,
                  render: (row) => <div className="controle-tarefas__result">{row.ultimo_resultado_descricao || "-"}</div>,
                },
                {
                  id: "acoes",
                  title: "Acoes",
                  accessor: (row) => row.id,
                  align: "right",
                  headerClassName: "controle-tarefas__actions-header",
                  render: (row) => (
                    <div className="table-actions controle-tarefas__actions">
                      <button
                        className="button controle-tarefas__action"
                        type="button"
                        disabled={busyAction === `${row.task_path}|${row.task_name}:executar`}
                        onClick={() => handleAction(row, "executar")}
                      >
                        {busyAction === `${row.task_path}|${row.task_name}:executar` ? "Executando..." : "Executar"}
                      </button>
                      <button
                        className="button button--secondary controle-tarefas__action"
                        type="button"
                        disabled={busyAction === `${row.task_path}|${row.task_name}:finalizar`}
                        onClick={() => handleAction(row, "finalizar")}
                      >
                        {busyAction === `${row.task_path}|${row.task_name}:finalizar` ? "Finalizando..." : "Finalizar"}
                      </button>
                      <button
                        className="button button--success controle-tarefas__action"
                        type="button"
                        disabled={busyAction === `${row.task_path}|${row.task_name}:habilitar`}
                        onClick={() => handleAction(row, "habilitar")}
                      >
                        {busyAction === `${row.task_path}|${row.task_name}:habilitar` ? "Habilitando..." : "Habilitar"}
                      </button>
                      <button
                        className="button button--danger controle-tarefas__action"
                        type="button"
                        disabled={busyAction === `${row.task_path}|${row.task_name}:desabilitar`}
                        onClick={() => handleAction(row, "desabilitar")}
                      >
                        {busyAction === `${row.task_path}|${row.task_name}:desabilitar` ? "Desabilitando..." : "Desabilitar"}
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </section>

    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function actionSuccessTitle(acao: "executar" | "finalizar" | "habilitar" | "desabilitar") {
  switch (acao) {
    case "executar":
      return "Execucao iniciada";
    case "finalizar":
      return "Execucao finalizada";
    case "habilitar":
      return "Task habilitada";
    case "desabilitar":
      return "Task desabilitada";
  }
}

function actionSuccessMessage(acao: "executar" | "finalizar" | "habilitar" | "desabilitar") {
  switch (acao) {
    case "executar":
      return "solicitacao enviada; a atualizacao pode aparecer em alguns segundos.";
    case "finalizar":
      return "solicitacao enviada; a atualizacao pode aparecer em alguns segundos.";
    case "habilitar":
      return "solicitacao enviada; a atualizacao pode aparecer em alguns segundos.";
    case "desabilitar":
      return "solicitacao enviada; a atualizacao pode aparecer em alguns segundos.";
  }
}

function actionErrorTitle(acao: "executar" | "finalizar" | "habilitar" | "desabilitar") {
  switch (acao) {
    case "executar":
      return "Falha ao executar";
    case "finalizar":
      return "Falha ao finalizar";
    case "habilitar":
      return "Falha ao habilitar";
    case "desabilitar":
      return "Falha ao desabilitar";
  }
}

function actionErrorMessage(acao: "executar" | "finalizar" | "habilitar" | "desabilitar") {
  switch (acao) {
    case "executar":
      return "Nao foi possivel executar a task.";
    case "finalizar":
      return "Nao foi possivel finalizar a task.";
    case "habilitar":
      return "Nao foi possivel habilitar a task.";
    case "desabilitar":
      return "Nao foi possivel desabilitar a task.";
  }
}
