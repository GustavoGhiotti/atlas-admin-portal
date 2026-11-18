import { FormEvent, useEffect, useState } from "react";

import DataTable from "@/components/tables/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { getApiError, listarCargas, atualizarCargas, type CargasResponse } from "@/services/atlasApi";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function statusTone(status: string) {
  switch (status) {
    case "PROCESSADO":
      return "success";
    case "AGUARDANDO":
      return "warning";
    case "EM ANDAMENTO":
      return "accent";
    case "ERRO":
      return "danger";
    default:
      return "default";
  }
}

export default function CargasDashboard() {
  const [dados, setDados] = useState<CargasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState(todayIso());
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    data: todayIso(),
    tarefa: "",
    status: "",
  });

  useEffect(() => {
    void handleRefresh(todayIso());
  }, []);

  async function load(formData?: FormData, options?: { notify?: boolean }) {
    setLoading(true);
    setError("");
    if (options?.notify) {
      setFeedback(null);
    }
    try {
      const params = buildParams(formData);
      const consultaInicial = await listarCargas(params);

      if (formData && (consultaInicial.execucoes?.length || 0) === 0) {
        const data = params.get("data") || dataSelecionada;
        await atualizarCargas(data);
        setDados(await listarCargas(params));
      } else {
        setDados(consultaInicial);
      }
      if (options?.notify) {
        setFeedback({ type: "success", message: "Consulta de cargas concluida com sucesso." });
      }
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao carregar historico de cargas.");
      setError(message);
      if (options?.notify) {
        setFeedback({ type: "danger", message });
      }
    } finally {
      setLoading(false);
    }
  }

  function buildParams(formData?: FormData) {
    const params = new URLSearchParams();
    params.set("data", dataSelecionada);
    if (formData) {
      const data = String(formData.get("data") || "").trim();
      const tarefa = String(formData.get("tarefa") || "").trim();
      const status = String(formData.get("status") || "").trim();
      if (data) {
        params.set("data", data);
        setDataSelecionada(data);
      }
      if (tarefa) params.set("tarefa", tarefa);
      if (status) params.set("status", status);
      setFiltrosAplicados({
        data: data || dataSelecionada,
        tarefa,
        status,
      });
    }
    return params;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load(new FormData(event.currentTarget), { notify: true });
  }

  async function handleRefresh(dataOverride?: string) {
    setError("");
    try {
      const dataAlvo = dataOverride || dataSelecionada;
      if (dataOverride && dataOverride !== dataSelecionada) {
        setDataSelecionada(dataOverride);
      }
      await atualizarCargas(dataAlvo);
      await load();
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao atualizar cargas."));
    }
  }

  const resumo = dados?.resumo || {};
  const existeFiltroAtivo = Boolean(filtrosAplicados.tarefa || filtrosAplicados.status);
  const descricaoFiltros = [
    `Dia: ${filtrosAplicados.data.split("-").reverse().join("/")}`,
    filtrosAplicados.tarefa ? `Origem: ${filtrosAplicados.tarefa}` : null,
    filtrosAplicados.status ? `Status: ${filtrosAplicados.status}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <div className="stack-md operacoes-page">
      <FeedbackToastBridge feedback={feedback} successTitle="Consulta concluida" errorTitle="Falha nas cargas" />
      <PageHeader
        eyebrow="Operacoes / EasyCollector"
        title="Cargas"
        description="Monitore cargas do EasyCollector e identifique falhas por dia, origem e status."
      />

      <section className="surface-card surface-card--compact operacoes-toolbar">
        <form className="filters-grid filters-grid--status operacoes-toolbar__form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Dia</span>
            <input name="data" type="date" value={dataSelecionada} onChange={(event) => setDataSelecionada(event.target.value)} />
          </label>
          <label className="field field--grow">
            <span>Origem</span>
            <input name="tarefa" placeholder="Pesquisar por parte da origem da carga" />
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue="">
              <option value="">Todos</option>
              {(dados?.status_disponiveis || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button className="button filters-grid__submit filters-grid__submit--inline" type="submit" disabled={loading}>
            {loading ? "Consultando..." : "Aplicar filtros"}
          </button>
        </form>
      </section>

      {existeFiltroAtivo ? <div className="alert alert--warning">Filtros ativos: {descricaoFiltros}</div> : null}
      {dados?.ultimo_erro ? <div className="alert alert--warning">Ultimo erro de coleta: {dados.ultimo_erro}</div> : null}
      {dados?.em_andamento ? <div className="alert">Atualizacao em andamento. Os dados podem mudar nos proximos instantes.</div> : null}

      <section className="kpi-grid">
        <KpiCard label="Processado" value={resumo.PROCESSADO || 0} helper="Confirme cargas concluidas para fechar o acompanhamento do dia." tone="success" />
        <KpiCard label="Em andamento" value={resumo["EM ANDAMENTO"] || 0} helper="Acompanhe cargas em processamento e antecipe gargalos." tone="accent" />
        <KpiCard label="Aguardando" value={resumo.AGUARDANDO || 0} helper="Identifique cargas pendentes para priorizar a fila." tone="warning" />
        <KpiCard label="Erro" value={resumo.ERRO || 0} helper="Isole falhas de processamento e reduza impacto operacional." tone="danger" />
        <KpiCard label="Nada" value={resumo.NADA || 0} helper="Mapeie cargas sem classificacao para corrigir a leitura operacional." />
      </section>

      <DataTable
        title="Monitore o historico de execucoes"
        exportFileName={`cargas-${dados?.data_referencia || dataSelecionada}.csv`}
        pageSize={14}
        searchPlaceholder="Buscar por tarefa, processo, arquivo ou status"
        initialSortColumn="inicio"
        initialSortDirection="desc"
        data={dados?.execucoes || []}
        columns={[
          { id: "origem", title: "Tarefa", accessor: (row) => row.origem, sortable: true },
          { id: "inicio", title: "Inicio", accessor: (row) => row.inicio, sortable: true },
          { id: "fim", title: "Fim", accessor: (row) => row.fim, sortable: true },
          {
            id: "status",
            title: "Status",
            accessor: (row) => row.status,
            sortable: true,
            render: (row) => <span className={`status-pill status-pill--${statusTone(row.status)}`}>{row.status}</span>,
          },
          { id: "arquivo", title: "Arquivo", accessor: (row) => row.arquivo, sortable: true },
        ]}
      />
    </div>
  );
}
