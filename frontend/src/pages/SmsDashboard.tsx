import axios from "axios";
import { FormEvent, startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

import AnalyticsPanel from "@/components/analytics/AnalyticsPanel";
import ChartCard from "@/components/charts/ChartCard";
import { BarChart, DonutChart, LineChart } from "@/components/charts/SimpleCharts";
import FilterPanel from "@/components/filters/FilterPanel";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import KpiCard from "@/components/ui/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { consultarRcsDashboard, consultarSmsDashboard, getApiError, listarRcsFiltros, listarSmsFiltros, type SmsFiltros } from "@/services/atlasApi";

type SmsDashboardCache = {
  filtros: SmsFiltros | null;
  dashboard: any | null;
  currentQueryString: string;
  lastUpdatedAt: string;
};

const dashboardCaches: Record<string, SmsDashboardCache | null> = { SMS: null, RCS: null };

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function SmsDashboard({ tipo = "SMS" }: { tipo?: "SMS" | "RCS" }) {
  const smsDashboardCache = dashboardCaches[tipo];
  const listarFiltros = tipo === "RCS" ? listarRcsFiltros : listarSmsFiltros;
  const consultarDashboard = tipo === "RCS" ? consultarRcsDashboard : consultarSmsDashboard;
  const defaultDate = new Date().toISOString().slice(0, 10);
  const initialQueryString = smsDashboardCache?.currentQueryString || buildDefaultQueryString(defaultDate);
  const [filtros, setFiltros] = useState<SmsFiltros | null>(smsDashboardCache?.filtros || null);
  const [dashboard, setDashboard] = useState<any | null>(smsDashboardCache?.dashboard || null);
  const [bootstrapping, setBootstrapping] = useState(!smsDashboardCache?.dashboard);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingDetails, setIsExportingDetails] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [exportSelection, setExportSelection] = useState("envios_semana");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(smsDashboardCache?.lastUpdatedAt || "");
  const [currentQueryString, setCurrentQueryString] = useState(initialQueryString);
  const currentRequestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const deferredDashboard = useDeferredValue(dashboard);
  const currentQueryParams = new URLSearchParams(currentQueryString);
  const currentInicio = currentQueryParams.get("inicio") || defaultDate;
  const currentFim = currentQueryParams.get("fim") || defaultDate;
  const currentCedente = currentQueryParams.get("cedente") || "";
  const currentCanal = currentQueryParams.get("canal") || "";
  const currentUsuario = currentQueryParams.get("usuario") || "";
  const currentStatus = currentQueryParams.get("status") || "";

  useEffect(() => {
    if (!smsDashboardCache) {
      void load({ refreshFilters: true });
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function load({ formData, refreshFilters = false, notify = false }: { formData?: FormData; refreshFilters?: boolean; notify?: boolean } = {}) {
    const requestId = currentRequestRef.current + 1;
    currentRequestRef.current = requestId;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const queryParams = formData ? new URLSearchParams(formData as never) : new URLSearchParams(currentQueryString);

    if (!dashboard) {
      setBootstrapping(true);
    }
    setIsRefreshing(true);
    setError("");
    if (notify) {
      setFeedback(null);
    }
    try {
      const [filtrosData, dashboardData] = await Promise.all([
        filtros && !refreshFilters ? Promise.resolve(filtros) : listarFiltros(controller.signal),
        consultarDashboard(queryParams, controller.signal, false),
      ]);

      if (requestId !== currentRequestRef.current) {
        return;
      }

      startTransition(() => {
        setFiltros(filtrosData);
        setDashboard(dashboardData);
        setCurrentQueryString(queryParams.toString());
        setLastUpdatedAt(new Date().toLocaleTimeString("pt-BR"));
        dashboardCaches[tipo] = {
          filtros: filtrosData,
          dashboard: dashboardData,
          currentQueryString: queryParams.toString(),
          lastUpdatedAt: new Date().toLocaleTimeString("pt-BR"),
        };
      });
      if (notify) {
        setFeedback({ type: "success", message: `Consulta do dashboard de ${tipo} concluída com sucesso.` });
      }
    } catch (requestError) {
      if (axios.isCancel(requestError)) {
        return;
      }
      const message = getApiError(requestError, `Falha ao carregar dashboard de ${tipo}.`);
      setError(message);
      if (notify) {
        setFeedback({ type: "danger", message });
      }
    } finally {
      if (requestId === currentRequestRef.current) {
        setBootstrapping(false);
        setIsRefreshing(false);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load({ formData: new FormData(event.currentTarget), notify: true });
  }

  function exportCsv(fileName: string, header: string[], rows: unknown[][]) {
    const content = [header.map(csvEscape).join(";"), ...rows.map((row) => row.map(csvEscape).join(";"))].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function handleExport() {
    if (exportOption.id !== "detalhes_periodo") {
      exportCsv(exportOption.fileName, exportOption.header, exportOption.rows);
      return;
    }

    setIsExportingDetails(true);
    setError("");
    try {
      const detalhesDashboard = await consultarDashboard(new URLSearchParams(currentQueryString), undefined, true);
      const detalheRows = (detalhesDashboard?.detalhes || []).map((row: any) => [
        row.id,
        row.cedente,
        row.id_cedente,
        row.canal,
        row.id_cliente,
        row.num_cliente,
        row.mensagem_template,
        row.variaveis_json,
        row.status,
        row.status_desc,
        row.erro_infobip,
        row.dt_inclusao,
        row.dt_envio,
        row.dt_entrega,
        row.dt_atualizacao,
        row.sms_count,
        row.custo_total,
        row.usuario_envio,
      ]);
      exportCsv(exportOption.fileName, exportOption.header, detalheRows);
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao exportar os detalhes do período."));
    } finally {
      setIsExportingDetails(false);
    }
  }

  const resumo = deferredDashboard?.resumo;
  const totalEnviosSemana = (deferredDashboard?.envios_por_semana || []).reduce((total: number, item: any) => total + Number(item.total_envios || 0), 0);
  const totalEnviosMes = (deferredDashboard?.envios_por_mes || []).reduce((total: number, item: any) => total + Number(item.total_envios || 0), 0);
  const formatarLabelCurta = (label: string) => label.slice(5);
  const custoPorCarteira = deferredDashboard?.custo_por_carteira || [];
  const custoPorCanal = deferredDashboard?.custo_por_canal || [];
  const taxaEntregaPorCarteiraBase = deferredDashboard?.taxa_entrega_por_carteira || [];
  const taxaEntregaPorCanalBase = deferredDashboard?.desempenho_por_canal || [];
  const ordemCarteiras = Array.from(
    new Set([
      ...custoPorCarteira.map((item: any) => String(item.cedente)),
      ...taxaEntregaPorCarteiraBase.map((item: any) => String(item.cedente)),
    ]),
  );
  const ordemCanais = Array.from(
    new Set([
      ...custoPorCanal.map((item: any) => String(item.canal)),
      ...taxaEntregaPorCanalBase.map((item: any) => String(item.canal)),
    ]),
  );
  const posicaoOrdenada = (ordem: string[], valor: string) => {
    const indice = ordem.indexOf(valor);
    return indice === -1 ? Number.MAX_SAFE_INTEGER : indice;
  };
  const custoPorCarteiraMap = new Map(custoPorCarteira.map((item: any) => [String(item.cedente), Number(item.custo_total)]));
  const custoPorCanalMap = new Map(custoPorCanal.map((item: any) => [String(item.canal), Number(item.custo_total)]));
  const custoPorCarteiraOrdenado = ordemCarteiras.map((cedente) => ({
    cedente,
    custo_total: custoPorCarteiraMap.get(cedente) ?? 0,
  }));
  const custoPorCanalOrdenado = ordemCanais.map((canal) => ({
    canal,
    custo_total: custoPorCanalMap.get(canal) ?? 0,
  }));
  const taxaEntregaPorCarteira = [
    ...taxaEntregaPorCarteiraBase
      .slice()
      .sort((a: any, b: any) => posicaoOrdenada(ordemCarteiras, String(a.cedente)) - posicaoOrdenada(ordemCarteiras, String(b.cedente))),
  ];
  const taxaEntregaPorCanal = [
    ...taxaEntregaPorCanalBase
      .slice()
      .sort((a: any, b: any) => posicaoOrdenada(ordemCanais, String(a.canal)) - posicaoOrdenada(ordemCanais, String(b.canal))),
  ];
  const exportOptions = [
    {
      id: "detalhes_periodo",
      label: "Detalhes completos do período",
      fileName: "sms-detalhes-periodo.csv",
      header: [
        "ID",
        "CEDENTE",
        "ID_CEDENTE",
        "CANAL",
        "ID_CLIENTE",
        "NUM_CLIENTE",
        "MENSAGEM_TEMPLATE",
        "VARIAVEIS_JSON",
        "STATUS",
        "STATUS_DESC",
        "ERRO_INFOBIP",
        "DT_INCLUSAO",
        "DT_ENVIO",
        "DT_ENTREGA",
        "DT_ATUALIZACAO",
        "SMS_COUNT",
        "CUSTO_TOTAL",
        "USUARIO_ENVIO",
      ],
      rows: [],
    },
    {
      id: "envios_semana",
      label: "Envios da semana",
      fileName: "sms-envios-semana.csv",
      header: ["Periodo", "Total envios"],
      rows: (deferredDashboard?.envios_por_semana || []).map((row: any) => [row.periodo, row.total_envios]),
    },
    {
      id: "envios_mes",
      label: "Envios do mês",
      fileName: "sms-envios-mes.csv",
      header: ["Periodo", "Total envios"],
      rows: (deferredDashboard?.envios_por_mes || []).map((row: any) => [row.periodo, row.total_envios]),
    },
    {
      id: "custo_carteira",
      label: "Custo por carteira",
      fileName: "sms-custo-carteira.csv",
      header: ["Cedente", "Custo total"],
      rows: custoPorCarteiraOrdenado.map((row: any) => [row.cedente, row.custo_total]),
    },
    {
      id: "taxa_carteira",
      label: "Taxa de entrega por carteira",
      fileName: "sms-taxa-entrega-carteira.csv",
      header: ["Cedente", "Taxa entrega"],
      rows: taxaEntregaPorCarteira.map((row: any) => [row.cedente, row.taxa_entrega_pct]),
    },
    {
      id: "custo_canal",
      label: "Custo por canal",
      fileName: "sms-custo-canal.csv",
      header: ["Canal", "Custo total"],
      rows: custoPorCanalOrdenado.map((row: any) => [row.canal, row.custo_total]),
    },
    {
      id: "taxa_canal",
      label: "Taxa de entrega por canal",
      fileName: "sms-taxa-entrega-canal.csv",
      header: ["Canal", "Taxa entrega"],
      rows: taxaEntregaPorCanal.map((row: any) => [row.canal, row.taxa_entrega_pct]),
    },
    {
      id: "status",
      label: "Distribuicao de status",
      fileName: "sms-status.csv",
      header: ["Status", "Total"],
      rows: (deferredDashboard?.status || []).map((row: any) => [row.status, row.total]),
    },
    {
      id: "erros",
      label: "Ocorrências de erro",
      fileName: "sms-erros.csv",
      header: ["Erro Infobip", "Status desc", "Total"],
      rows: (deferredDashboard?.erros || []).map((row: any) => [row.erro_infobip, row.status_desc, row.total]),
    },
  ];
  const exportOption = exportOptions.find((item) => item.id === exportSelection) || exportOptions[0];

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Consulta concluída" errorTitle={`Falha no dashboard de ${tipo}`} />
      <PageHeader
        eyebrow={`Analytics / ${tipo}`}
        title={`Dashboard ${tipo} Infobip`}
        description={`Monitore ${tipo} e acompanhe volume, custo, entrega e falhas em uma única leitura.`}
      />

      <FilterPanel
        title="Consolide a análise em uma única base"
        description={isRefreshing ? "Atualize os dados em segundo plano e mantenha a leitura atual disponível até a conclusão da nova consulta." : "Aplique filtros unificados e alinhe os indicadores, gráficos e tabelas do painel."}
        onSubmit={handleSubmit}
        actions={lastUpdatedAt ? <span className="panel-status">Última atualização: {lastUpdatedAt}</span> : null}
      >
        <label className="field"><span>Início</span><input name="inicio" type="date" defaultValue={currentInicio} /></label>
        <label className="field"><span>Fim</span><input name="fim" type="date" defaultValue={currentFim} /></label>
        <label className="field"><span>Cedente</span><select name="cedente" defaultValue={currentCedente}><option value="">Todas</option>{filtros?.cedentes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
        <label className="field"><span>Canal</span><select name="canal" defaultValue={currentCanal}><option value="">Todos</option>{filtros?.canais.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span>Usuário</span><select name="usuario" defaultValue={currentUsuario}><option value="">Todos</option>{filtros?.usuarios.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span>Status</span><select name="status" defaultValue={currentStatus}><option value="">Todos</option>{filtros?.status.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button className="button" type="submit">{isRefreshing ? "Atualizando..." : "Aplicar filtros"}</button>
      </FilterPanel>
      {bootstrapping && !deferredDashboard ? <div className="page-loader">Carregando dashboard de {tipo}...</div> : null}

      <section className={`kpi-grid ${isRefreshing ? "dashboard-refreshing" : ""}`}>
        <KpiCard label="Total de envios" value={formatNumber(resumo?.total_envios)} helper="Consolide o volume processado para medir a carga do período." />
        <KpiCard label="Tempo médio" value={`${formatNumber((Number(resumo?.tempo_medio_entrega) || 0) / 60)} min`} helper="Acompanhe o tempo médio de entrega e detecte lentidão no canal." />
        <KpiCard label="Custo total" value={formatCurrency(resumo?.custo_total)} helper="Consolide o custo do período para sustentar decisões operacionais." />
        <KpiCard label="Custo médio" value={formatCurrency(resumo?.custo_medio_envio)} helper="Compare o custo médio por envio e identifique eficiência." />
        <KpiCard label="Taxa de entrega" value={formatPercent(resumo?.taxa_entrega_pct)} helper="Monitore entregas concluídas para validar a efetividade do canal." tone="success" />
        <KpiCard label="Taxa de erro" value={formatPercent(resumo?.taxa_erro_pct)} helper="Identifique falhas definitivas e priorize a correção operacional." tone="warning" />
      </section>

      <AnalyticsPanel eyebrow="Temporal" title="Monitore a tendência de envios e custos" description="Compare o comportamento diário, semanal e mensal para ajustar a operação.">
        <div className="analytics-grid analytics-grid--two">
          <ChartCard title="Envios da semana" subtitle="Contexto comparativo">
            <>
              <LineChart
                data={(deferredDashboard?.envios_por_semana || []).map((item: any) => ({ label: item.periodo, value: Number(item.total_envios) }))}
                stroke="#1f5eff"
                axisLabelFormatter={formatarLabelCurta}
                maxAxisLabels={7}
              />
              <div className="chart-summary">Total: {formatNumber(totalEnviosSemana)}</div>
            </>
          </ChartCard>
          <ChartCard title="Envios do mês" subtitle="Contexto comparativo">
            <>
              <LineChart
                data={(deferredDashboard?.envios_por_mes || []).map((item: any) => ({ label: item.periodo, value: Number(item.total_envios) }))}
                stroke="#4a617d"
                axisLabelFormatter={formatarLabelCurta}
                maxAxisLabels={8}
              />
              <div className="chart-summary">Total: {formatNumber(totalEnviosMes)}</div>
            </>
          </ChartCard>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Custo e desempenho" title="Monitore a concentração de custos e a eficiência" description="Acompanhe a carteira, o canal e o status para identificar oportunidades de melhoria.">
        <div className="analytics-grid analytics-grid--two">
          <ChartCard title="Custo por carteira">
            <BarChart
              data={custoPorCarteiraOrdenado.map((item: any) => ({ label: item.cedente, value: Number(item.custo_total) }))}
              formatValue={(value) => formatCurrency(value)}
              color="#1f5eff"
            />
          </ChartCard>
          <ChartCard title="Taxa de entrega por carteira">
            <BarChart
              data={taxaEntregaPorCarteira.map((item: any) => ({ label: item.cedente, value: Number(item.taxa_entrega_pct) }))}
              formatValue={(value) => formatPercent(value)}
              color="#00a36c"
            />
          </ChartCard>
          <ChartCard title="Custo por canal">
            <BarChart
              data={custoPorCanalOrdenado.map((item: any) => ({ label: item.canal, value: Number(item.custo_total) }))}
              formatValue={(value) => formatCurrency(value)}
              color="#ffb020"
            />
          </ChartCard>
          <ChartCard title="Taxa de entrega por canal">
            <BarChart
              data={taxaEntregaPorCanal.map((item: any) => ({ label: item.canal, value: Number(item.taxa_entrega_pct) }))}
              formatValue={(value) => formatPercent(value)}
              color="#7a5cff"
            />
          </ChartCard>
          <ChartCard title="Distribuicao de status">
            <DonutChart data={(deferredDashboard?.status || []).map((item: any) => ({ label: item.status, value: Number(item.total) }))} />
          </ChartCard>
          <ChartCard title="Erros por quantidade">
            <BarChart
              data={(deferredDashboard?.erros || []).map((item: any) => ({
                label: item.erro_infobip,
                value: Number(item.total),
              }))}
              formatValue={(value) => formatNumber(value)}
              color="#ff5d5d"
            />
          </ChartCard>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Investigação" title="Exporte dados operacionais" description="Selecione o recorte desejado e gere o CSV correspondente ao gráfico analisado.">
        {deferredDashboard ? (
          <ChartCard title="Baixar dados do painel">
            <div className="chart-export-card">
              <label className="field">
                <span>Selecione o gráfico</span>
                <select value={exportSelection} onChange={(event) => setExportSelection(event.target.value)}>
                  {exportOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <p>O arquivo será gerado com as colunas correspondentes ao gráfico selecionado.</p>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void handleExport()}
                disabled={isExportingDetails}
              >
                {isExportingDetails ? "Preparando detalhes..." : "Exportar CSV"}
              </button>
            </div>
          </ChartCard>
        ) : <div className="empty-state">Aplique filtros para carregar dados operacionais do painel.</div>}
      </AnalyticsPanel>
    </div>
  );
}

function buildDefaultQueryString(defaultDate: string) {
  const params = new URLSearchParams();
  params.set("inicio", defaultDate);
  params.set("fim", defaultDate);
  return params.toString();
}
