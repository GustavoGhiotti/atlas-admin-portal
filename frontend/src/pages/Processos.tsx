import { FormEvent, useEffect, useMemo, useState } from "react";

import Modal from "@/components/modals/Modal";
import { getApiError, listarProcessos, type ProcessoAtivo } from "@/services/atlasApi";

const SOMENTE_PROCESSOS_USUARIO = true;

type ProcessoFiltroCampo =
  | "server_name"
  | "session_id"
  | "login_name"
  | "host_name"
  | "program_name"
  | "job_name"
  | "job_step_name"
  | "database_name"
  | "command"
  | "status"
  | "blocking_session_id"
  | "sql_text";

type ProcessoFiltro = {
  id: string;
  campo: ProcessoFiltroCampo;
  valor: string;
};

const PROCESSO_FILTRO_CAMPOS: Array<{ campo: ProcessoFiltroCampo; label: string }> = [
  { campo: "server_name", label: "server_name" },
  { campo: "session_id", label: "session_id" },
  { campo: "login_name", label: "login_name" },
  { campo: "host_name", label: "host_name" },
  { campo: "program_name", label: "program_name" },
  { campo: "job_name", label: "job_name" },
  { campo: "job_step_name", label: "job_step_name" },
  { campo: "database_name", label: "database_name" },
  { campo: "command", label: "command" },
  { campo: "status", label: "status" },
  { campo: "blocking_session_id", label: "blocking_session_id" },
  { campo: "sql_text", label: "sql_text" },
];

function createFiltro(campo: ProcessoFiltroCampo = "login_name", valor = ""): ProcessoFiltro {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    campo,
    valor,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor((milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((item) => String(item).padStart(2, "0")).join(":");
}

function normalizeStatus(status: string, blockingSessionId: number) {
  const normalized = String(status || "").trim().toLowerCase();
  if (blockingSessionId > 0 || normalized === "suspended") return "aguardando";
  if (normalized === "running" || normalized === "runnable") return "executando";
  return normalized || "desconhecido";
}

function StatusBadge({ status, blockingSessionId }: { status: string; blockingSessionId: number }) {
  const displayStatus = normalizeStatus(status, blockingSessionId);
  const isRunning = displayStatus === "executando";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${
        isRunning
          ? "border-emerald-400/15 bg-emerald-400/10 text-emerald-300"
          : "border-orange-400/20 bg-orange-400/10 text-orange-300"
      }`}
    >
      {displayStatus}
    </span>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 0 1-13.7 5.7" />
      <path d="M4 12A8 8 0 0 1 17.7 6.3" />
      <path d="M17 3v4h-4" />
      <path d="M7 21v-4h4" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function FileIcon({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 w-8 shrink-0 items-center justify-center rounded border border-orange-400/30 bg-orange-400/10 text-[10px] font-bold uppercase text-orange-300">
      {label}
    </span>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5h5v5" />
      <path d="m10 14 9-9" />
      <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function getProcessoOrigem(processo: ProcessoAtivo) {
  if (processo.job_name) {
    return `Job: ${processo.job_name}${processo.job_step_name ? ` / Step ${processo.job_step_id ?? ""}: ${processo.job_step_name}` : ""}`;
  }
  return processo.program_name || "-";
}

function getProcessoSql(processo: ProcessoAtivo) {
  return processo.job_step_command || processo.sql_text || "";
}

function getProcessoDetalhes(processo: ProcessoAtivo) {
  return [
    ["ID sessao", processo.session_id],
    ["Servidor", processo.server_name || "-"],
    ["Login", processo.login_name],
    ["Host", processo.host_name || "-"],
    ["Programa", processo.program_name || "-"],
    ["Origem", getProcessoOrigem(processo)],
    ["Job", processo.job_name || "-"],
    ["Step", processo.job_step_name || "-"],
    ["Banco de dados", processo.database_name || "-"],
    ["Comando", processo.command || "-"],
    ["Status", normalizeStatus(processo.status, processo.blocking_session_id)],
    ["Inicio", formatDateTime(processo.start_time)],
    ["Tempo rodando", formatElapsed(processo.total_elapsed_time)],
    ["CPU (ms)", processo.cpu_time],
    ["Leituras", processo.reads],
    ["Gravacoes", processo.writes],
    ["Bloqueado por", processo.blocking_session_id || "-"],
    ["SQL em execucao", getProcessoSql(processo) || "-"],
  ] as Array<[string, unknown]>;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getFiltroValue(processo: ProcessoAtivo, campo: ProcessoFiltroCampo) {
  switch (campo) {
    case "server_name":
      return processo.server_name || "";
    case "session_id":
      return String(processo.session_id);
    case "login_name":
      return processo.login_name || "";
    case "host_name":
      return processo.host_name || "";
    case "program_name":
      return processo.program_name || "";
    case "job_name":
      return processo.job_name || "";
    case "job_step_name":
      return processo.job_step_name || "";
    case "database_name":
      return processo.database_name || "";
    case "command":
      return processo.command || "";
    case "status":
      return normalizeStatus(processo.status, processo.blocking_session_id);
    case "blocking_session_id":
      return processo.blocking_session_id ? String(processo.blocking_session_id) : "";
    case "sql_text":
      return getProcessoSql(processo);
  }
}

function truncateLabel(value: string, maxLength = 15) {
  const text = value.trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export default function ProcessosBD() {
  const [processos, setProcessos] = useState<ProcessoAtivo[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState<ProcessoFiltro[]>(() => [createFiltro("login_name")]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoAtivo | null>(null);

  const loginFiltroBackend = useMemo(
    () => filtros.find((filtro) => filtro.campo === "login_name" && filtro.valor.trim())?.valor.trim() || "",
    [filtros],
  );

  const registrosAtivos = useMemo(
    () => processos.filter((item) => normalizeStatus(item.status, item.blocking_session_id) === "executando").length,
    [processos],
  );

  const filtrosAtivos = useMemo(() => filtros.filter((filtro) => filtro.valor.trim()), [filtros]);

  const processosFiltrados = useMemo(() => {
    const normalizedFiltros = filtros
      .map((filtro) => ({ ...filtro, valor: filtro.valor.trim().toLowerCase() }))
      .filter((filtro) => filtro.valor);
    if (!normalizedFiltros.length) return processos;

    return processos.filter((processo) =>
      normalizedFiltros.every((filtro) =>
        getFiltroValue(processo, filtro.campo).toLowerCase().includes(filtro.valor),
      ),
    );
  }, [filtros, processos]);

  async function loadProcessos(showLoading = false, options?: { login?: string; somenteUsuario?: boolean }) {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const login = options?.login ?? loginFiltroBackend;
      const apenasUsuario = options?.somenteUsuario ?? SOMENTE_PROCESSOS_USUARIO;
      const data = await listarProcessos({ login: login.trim() || undefined, somenteUsuario: apenasUsuario });
      setProcessos(data.processos);
      setLastUpdate(data.atualizado_em);
      setError("");
    } catch (err) {
      setError(getApiError(err, "Falha ao consultar processos ativos."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadProcessos(true, { login: loginFiltroBackend, somenteUsuario: SOMENTE_PROCESSOS_USUARIO });
  }, []);

  function handleSubmitFiltros(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFiltersOpen(false);
    void loadProcessos(true);
  }

  function adicionarFiltro() {
    setFiltros((current) => [...current, createFiltro()]);
  }

  function atualizarFiltro(id: string, patch: Partial<Omit<ProcessoFiltro, "id">>) {
    setFiltros((current) => current.map((filtro) => (filtro.id === id ? { ...filtro, ...patch } : filtro)));
  }

  function removerFiltro(id: string) {
    setFiltros((current) => (current.length > 1 ? current.filter((filtro) => filtro.id !== id) : [createFiltro()]));
  }

  function limparFiltros() {
    setFiltros([createFiltro()]);
    setFiltersOpen(false);
  }

  function exportCsv() {
    const header = [
      "ID sessao",
      "Servidor",
      "Login",
      "Host",
      "Programa",
      "Job",
      "Step",
      "Banco de dados",
      "Comando",
      "Status",
      "Inicio",
      "Tempo rodando",
      "CPU (ms)",
      "Leituras",
      "Gravacoes",
      "Bloqueado por",
      "SQL em execucao",
    ];
    const rows = processosFiltrados.map((processo) =>
      [
        processo.session_id,
        processo.server_name,
        processo.login_name,
        processo.host_name,
        processo.program_name,
        processo.job_name,
        processo.job_step_name,
        processo.database_name,
        processo.command,
        normalizeStatus(processo.status, processo.blocking_session_id),
        formatDateTime(processo.start_time),
        formatElapsed(processo.total_elapsed_time),
        processo.cpu_time,
        processo.reads,
        processo.writes,
        processo.blocking_session_id || "",
        getProcessoSql(processo),
      ]
        .map(csvEscape)
        .join(";"),
    );
    const blob = new Blob([[header.map(csvEscape).join(";"), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "processos-ativos.csv";
    anchor.click();
    URL.revokeObjectURL(href);
    setExportMenuOpen(false);
  }

  function exportPlanilha() {
    const header = [
      "ID sessao",
      "Servidor",
      "Login",
      "Host",
      "Programa",
      "Job",
      "Step",
      "Banco de dados",
      "Comando",
      "Status",
      "Inicio",
      "Tempo rodando",
      "CPU (ms)",
      "Leituras",
      "Gravacoes",
      "Bloqueado por",
      "SQL em execucao",
    ];
    const rows = processosFiltrados
      .map((processo) =>
        [
          processo.session_id,
          processo.server_name,
          processo.login_name,
          processo.host_name,
          processo.program_name,
          processo.job_name,
          processo.job_step_name,
          processo.database_name,
          processo.command,
          normalizeStatus(processo.status, processo.blocking_session_id),
          formatDateTime(processo.start_time),
          formatElapsed(processo.total_elapsed_time),
          processo.cpu_time,
          processo.reads,
          processo.writes,
          processo.blocking_session_id || "",
          getProcessoSql(processo),
        ]
          .map((value) => `<td>${escapeHtml(value)}</td>`)
          .join(""),
      )
      .map((row) => `<tr>${row}</tr>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${header
      .map((item) => `<th>${escapeHtml(item)}</th>`)
      .join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
    downloadBlob(html, "processos-ativos.xls", "application/vnd.ms-excel;charset=utf-8;");
    setExportMenuOpen(false);
  }

  function exportPdf() {
    const rows = processosFiltrados
      .map(
        (processo) => `
          <tr>
            <td>${escapeHtml(processo.session_id)}</td>
            <td>${escapeHtml(processo.server_name || "-")}</td>
            <td>${escapeHtml(processo.login_name || "-")}</td>
            <td>${escapeHtml(processo.database_name || "-")}</td>
            <td>${escapeHtml(processo.command || "-")}</td>
            <td>${escapeHtml(normalizeStatus(processo.status, processo.blocking_session_id))}</td>
            <td>${escapeHtml(formatDateTime(processo.start_time))}</td>
            <td>${escapeHtml(formatElapsed(processo.total_elapsed_time))}</td>
            <td>${escapeHtml(getProcessoSql(processo) || "-")}</td>
          </tr>
        `,
      )
      .join("");
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Processos ativos</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { font-size: 20px; margin: 0 0 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; text-align: left; }
            th { background: #f3f4f6; }
            td { white-space: pre-wrap; overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          <h1>Processos ativos</h1>
          <table>
            <thead>
              <tr>
                <th>ID sessao</th>
                <th>Servidor</th>
                <th>Login</th>
                <th>Banco</th>
                <th>Comando</th>
                <th>Status</th>
                <th>Inicio</th>
                <th>Tempo</th>
                <th>SQL</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setExportMenuOpen(false);
  }

  function exportProcessoCsv(processo: ProcessoAtivo) {
    const rows = getProcessoDetalhes(processo).map(([campo, valor]) => [campo, valor].map(csvEscape).join(";"));
    downloadBlob(["Campo;Valor", ...rows].join("\n"), `processo-${processo.session_id}.csv`, "text/csv;charset=utf-8;");
  }

  function exportProcessoPlanilha(processo: ProcessoAtivo) {
    const rows = getProcessoDetalhes(processo)
      .map(([campo, valor]) => `<tr><td>${escapeHtml(campo)}</td><td>${escapeHtml(valor)}</td></tr>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${rows}</table></body></html>`;
    downloadBlob(html, `processo-${processo.session_id}.xls`, "application/vnd.ms-excel;charset=utf-8;");
  }

  function exportProcessoPdf(processo: ProcessoAtivo) {
    const rows = getProcessoDetalhes(processo)
      .map(([campo, valor]) => `<tr><th>${escapeHtml(campo)}</th><td>${escapeHtml(valor)}</td></tr>`)
      .join("");
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Processo ${escapeHtml(processo.session_id)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { font-size: 20px; margin: 0 0 16px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #d1d5db; padding: 8px 10px; vertical-align: top; text-align: left; }
            th { width: 220px; background: #f3f4f6; }
            td { white-space: pre-wrap; overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          <h1>Detalhes do processo ${escapeHtml(processo.session_id)}</h1>
          <table>${rows}</table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="min-h-full min-w-0 max-w-full space-y-5 overflow-x-hidden text-slate-100">
      <section className="rounded-lg border border-white/10 bg-slate-950/45 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em]">
              <span className="text-orange-400">Processos</span>
              <span className="text-slate-500">&gt;</span>
              <span className="text-slate-200">Consulta</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-white">Consulta de processos ativos</h1>
            <p className="mt-4 max-w-3xl text-base text-slate-400">
              Veja as requisicoes em execucao agora no SQL Server, com origem, tempo, bloqueios e SQL executado.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-orange-500/60 bg-orange-500/10 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => loadProcessos(false)}
              disabled={loading || refreshing}
            >
              <RefreshIcon />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</div>
      ) : null}

      <section className="min-w-0 max-w-full rounded-lg border border-white/10 bg-slate-950/45 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-orange-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-orange-400/30 bg-orange-400/10">
              <span className="h-2 w-2 rounded-full bg-orange-300" />
            </span>
            Resultado da consulta
          </p>

          <div className="flex items-center gap-3">
            <button
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-white transition ${
                filtersOpen
                  ? "border-orange-400/60 bg-orange-500/15"
                  : "border-white/10 bg-slate-900/60 hover:border-white/30"
              }`}
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <FilterIcon />
              Filtro
            </button>
            <span className="rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-300">
              {processosFiltrados.length} de {processos.length} registros encontrados
            </span>
            <div className="relative">
              <button
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  exportMenuOpen
                    ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
                    : "border-white/10 bg-slate-900/60 text-slate-100 hover:border-orange-400/50 hover:text-orange-300"
                }`}
                type="button"
                onClick={() => setExportMenuOpen((current) => !current)}
              >
                <ExportIcon />
                Exportar
              </button>
              {exportMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg bg-slate-950 shadow-2xl shadow-black/40">
                  <button className="flex w-full appearance-none items-center gap-3 border-0 bg-slate-950 px-4 py-3 text-left text-sm font-medium text-slate-200 shadow-none outline-none ring-0 hover:bg-slate-900 hover:text-orange-300 focus:outline-none focus:ring-0" type="button" onClick={exportCsv}>
                    <FileIcon label="csv" />
                    <span>Exportar CSV</span>
                  </button>
                  <button className="flex w-full appearance-none items-center gap-3 border-0 bg-slate-950 px-4 py-3 text-left text-sm font-medium text-slate-200 shadow-none outline-none ring-0 hover:bg-slate-900 hover:text-orange-300 focus:outline-none focus:ring-0" type="button" onClick={exportPlanilha}>
                    <FileIcon label="xls" />
                    <span>Exportar XLS</span>
                  </button>
                  <button className="flex w-full appearance-none items-center gap-3 border-0 bg-slate-950 px-4 py-3 text-left text-sm font-medium text-slate-200 shadow-none outline-none ring-0 hover:bg-slate-900 hover:text-orange-300 focus:outline-none focus:ring-0" type="button" onClick={exportPdf}>
                    <FileIcon label="pdf" />
                    <span>Exportar PDF</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {filtersOpen ? (
          <form className="mb-4 space-y-4 rounded-lg border border-white/10 bg-slate-900/35 p-4" onSubmit={handleSubmitFiltros}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">Filtros</p>
                <p className="mt-1 text-sm text-slate-400">Escolha a chave retornada pelo banco e informe o valor procurado.</p>
              </div>
              <button
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-500/60 bg-orange-500/10 text-xl font-semibold text-orange-300 transition hover:bg-orange-500/20"
                type="button"
                onClick={adicionarFiltro}
                aria-label="Adicionar filtro"
              >
                +
              </button>
            </div>

            <div className="space-y-3">
              {filtros.map((filtro, index) => (
                <div key={filtro.id} className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/45 p-3 lg:grid-cols-[minmax(180px,260px)_minmax(220px,1fr)_auto] lg:items-end">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Chave</span>
                    <select
                      className="h-11 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/60"
                      value={filtro.campo}
                      onChange={(event) => atualizarFiltro(filtro.id, { campo: event.target.value as ProcessoFiltroCampo })}
                    >
                      {PROCESSO_FILTRO_CAMPOS.map((item) => (
                        <option key={item.campo} value={item.campo}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Valor</span>
                    <input
                      className="h-11 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-orange-400/60"
                      value={filtro.valor}
                      onChange={(event) => atualizarFiltro(filtro.id, { valor: event.target.value })}
                      placeholder={filtro.campo === "login_name" ? "Ex.: robos" : "Valor parcial para procurar"}
                    />
                  </label>

                  <button
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-slate-900/70 px-4 text-sm font-semibold text-slate-300 transition hover:border-orange-400/50 hover:text-orange-300"
                    type="button"
                    onClick={() => removerFiltro(filtro.id)}
                  >
                    {index === 0 && filtros.length === 1 ? "Limpar" : "Remover"}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 bg-slate-900/70 px-5 text-sm font-semibold text-slate-300 transition hover:border-orange-400/50 hover:text-orange-300"
                type="button"
                onClick={limparFiltros}
              >
                Limpar filtros
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg border border-orange-500/60 bg-orange-500/10 px-5 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading || refreshing}
              >
                Aplicar filtros
              </button>
            </div>
          </form>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex h-7 max-w-[160px] items-center rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 text-xs font-medium text-emerald-300" title="Somente processos de usuario">
              usuario
            </span>
            {filtrosAtivos.map((filtro) => (
              <span
                key={filtro.id}
                className="inline-flex h-7 max-w-[160px] items-center rounded-md border border-white/10 bg-slate-800/70 px-2 text-xs font-medium text-slate-300"
                title={`${filtro.campo}: ${filtro.valor.trim()}`}
              >
                <span className="truncate">{truncateLabel(filtro.valor, 18)}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center">
            <span>Ultima atualizacao: {formatDateTime(lastUpdate)}</span>
            <span className={`inline-flex items-center gap-2 ${error ? "text-orange-300" : "text-emerald-300"}`}>
              <span className={`h-2 w-2 rounded-full ${error ? "bg-orange-400" : "bg-emerald-400"}`} />
              {error ? "Falha na consulta" : refreshing ? "Atualizando" : "Atualizado"}
            </span>
          </div>
        </div>

        <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-white/10">
          <div className="processos-table-scroll max-h-[calc(100vh-430px)] min-h-[320px] max-w-full overflow-x-auto overflow-y-auto">
            <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-4 font-semibold">ID sessao</th>
                  <th className="px-4 py-4 font-semibold">Servidor</th>
                  <th className="px-4 py-4 font-semibold">Login</th>
                  <th className="px-4 py-4 font-semibold">Host</th>
                  <th className="px-4 py-4 font-semibold">Origem</th>
                  <th className="px-4 py-4 font-semibold">Banco de dados</th>
                  <th className="px-4 py-4 font-semibold">Comando</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Inicio</th>
                  <th className="px-4 py-4 font-semibold">Tempo rodando</th>
                  <th className="px-4 py-4 font-semibold">CPU (ms)</th>
                  <th className="px-4 py-4 font-semibold">Leituras</th>
                  <th className="px-4 py-4 font-semibold">Gravacoes</th>
                  <th className="px-4 py-4 font-semibold">Bloqueado por</th>
                  <th className="px-4 py-4 font-semibold">SQL em execucao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/35">
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={15}>
                      Carregando processos ativos...
                    </td>
                  </tr>
                ) : processosFiltrados.length ? (
                  processosFiltrados.map((processo) => (
                    <tr key={processo.session_id} className="transition hover:bg-slate-800/35">
                      <td className="px-4 py-4 text-slate-100">{processo.session_id}</td>
                      <td className="px-4 py-4 text-slate-100">{processo.server_name || "-"}</td>
                      <td className="px-4 py-4 text-slate-100">{processo.login_name || "-"}</td>
                      <td className="px-4 py-4 text-slate-100">{processo.host_name || "-"}</td>
                      <td className="max-w-[240px] px-4 py-4 text-slate-100" title={processo.program_name || undefined}>
                        <span className="line-clamp-2">{getProcessoOrigem(processo)}</span>
                      </td>
                      <td className="px-4 py-4 text-slate-100">{processo.database_name || "-"}</td>
                      <td className="px-4 py-4 text-slate-100">{processo.command || "-"}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={processo.status} blockingSessionId={processo.blocking_session_id} />
                      </td>
                      <td className="px-4 py-4 text-slate-100">{formatDateTime(processo.start_time)}</td>
                      <td className="px-4 py-4 text-slate-100">{formatElapsed(processo.total_elapsed_time)}</td>
                      <td className="px-4 py-4 text-slate-100">{formatNumber(processo.cpu_time)}</td>
                      <td className="px-4 py-4 text-slate-100">{formatNumber(processo.reads)}</td>
                      <td className="px-4 py-4 text-slate-100">{formatNumber(processo.writes)}</td>
                      <td className="px-4 py-4 font-semibold text-orange-300">{processo.blocking_session_id || "-"}</td>
                      <td className="max-w-[300px] px-4 py-4">
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="line-clamp-2 min-w-0 flex-1 text-slate-400">{getProcessoSql(processo) || "-"}</span>
                          <button
                            className="shrink-0 border-0 bg-transparent p-0 text-orange-400 shadow-none outline-none ring-0 transition hover:text-orange-300 focus:outline-none focus:ring-0"
                            type="button"
                            onClick={() => setSelectedProcesso(processo)}
                            aria-label="Abrir detalhes do processo"
                          >
                            <ExternalIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-400" colSpan={15}>
                      Nenhum processo encontrado para os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-slate-950/45 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-orange-400">Informacoes</p>
            <p className="text-sm text-slate-400">
              Exibindo processos de usuario com {filtrosAtivos.length} filtro(s) de campo. {registrosAtivos} em execucao sem bloqueio.
            </p>
            <p className="mt-1 text-sm text-slate-400">Use Atualizar ou Aplicar filtros para buscar os dados mais recentes.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Atualizacao manual
          </div>
        </div>
      </section>

      <Modal
        open={!!selectedProcesso}
        onClose={() => setSelectedProcesso(null)}
        title={selectedProcesso ? `Processo ${selectedProcesso.session_id}` : "Detalhes do processo"}
        description="Detalhes completos da execucao selecionada."
        className="modal--wide"
      >
        {selectedProcesso ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-slate-900/70 px-4 text-sm font-semibold text-slate-100 transition hover:border-orange-400/50 hover:text-orange-300"
                type="button"
                onClick={() => exportProcessoCsv(selectedProcesso)}
              >
                Exportar CSV
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-slate-900/70 px-4 text-sm font-semibold text-slate-100 transition hover:border-orange-400/50 hover:text-orange-300"
                type="button"
                onClick={() => exportProcessoPlanilha(selectedProcesso)}
              >
                Exportar planilha
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-lg border border-orange-500/60 bg-orange-500/10 px-4 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20"
                type="button"
                onClick={() => exportProcessoPdf(selectedProcesso)}
              >
                Exportar PDF
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {getProcessoDetalhes(selectedProcesso).map(([campo, valor]) => (
                <article key={campo} className="rounded-lg border border-white/10 bg-slate-900/50 p-3">
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{campo}</span>
                  <strong className="mt-2 block whitespace-pre-wrap break-words text-sm font-medium text-slate-100">
                    {String(valor ?? "-")}
                  </strong>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
