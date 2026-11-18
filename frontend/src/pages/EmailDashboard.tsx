import { FormEvent, useEffect, useState } from "react";

import AnalyticsPanel from "@/components/analytics/AnalyticsPanel";
import ChartCard from "@/components/charts/ChartCard";
import { BarChart, LineChart } from "@/components/charts/SimpleCharts";
import FilterPanel from "@/components/filters/FilterPanel";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import KpiCard from "@/components/ui/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import { formatNumber, formatPercent } from "@/lib/format";
import { consultarEmailDashboard, getApiError, listarEmailFiltros, type EmailFiltros } from "@/services/atlasApi";

type EmailDashboardCache = {
  filtros: EmailFiltros | null;
  dashboard: any | null;
  currentQueryString: string;
};

let emailDashboardCache: EmailDashboardCache | null = null;

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function EmailDashboard() {
  const defaultDate = new Date().toISOString().slice(0, 10);
  const initialQueryString = emailDashboardCache?.currentQueryString || buildDefaultQueryString(defaultDate);
  const [filtros, setFiltros] = useState<EmailFiltros | null>(emailDashboardCache?.filtros || null);
  const [dashboard, setDashboard] = useState<any | null>(emailDashboardCache?.dashboard || null);
  const [loading, setLoading] = useState(!emailDashboardCache?.dashboard);
  const [isExportingDetails, setIsExportingDetails] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [exportSelection, setExportSelection] = useState("detalhes");
  const [currentQueryString, setCurrentQueryString] = useState(initialQueryString);
  const currentQueryParams = new URLSearchParams(currentQueryString);
  const currentInicio = currentQueryParams.get("inicio") || defaultDate;
  const currentFim = currentQueryParams.get("fim") || defaultDate;
  const currentCarteira = currentQueryParams.get("carteira") || "";
  const currentGrupo = currentQueryParams.get("grupo") || "";
  const currentCanal = currentQueryParams.get("canal") || "";
  const currentStatus = currentQueryParams.get("status") || "";

  useEffect(() => {
    if (!emailDashboardCache) {
      void load();
    }
  }, []);

  async function load(formData?: FormData, options?: { notify?: boolean }) {
    const queryParams = formData ? new URLSearchParams(formData as never) : new URLSearchParams(currentQueryString);
    setLoading(true);
    setError("");
    if (options?.notify) {
      setFeedback(null);
    }
    try {
      const [filtrosData, dashboardData] = await Promise.all([
        filtros ? Promise.resolve(filtros) : listarEmailFiltros(),
        consultarEmailDashboard(queryParams, false),
      ]);
      setFiltros(filtrosData);
      setDashboard(dashboardData);
      setCurrentQueryString(queryParams.toString());
      emailDashboardCache = {
        filtros: filtrosData,
        dashboard: dashboardData,
        currentQueryString: queryParams.toString(),
      };
      if (options?.notify) {
        setFeedback({ type: "success", message: "Consulta do dashboard de email concluida com sucesso." });
      }
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao carregar dashboard de email.");
      setError(message);
      if (options?.notify) {
        setFeedback({ type: "danger", message });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load(new FormData(event.currentTarget), { notify: true });
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
    if (exportOption.id !== "detalhes") {
      exportCsv(exportOption.fileName, exportOption.header, exportOption.rows);
      return;
    }

    setIsExportingDetails(true);
    setError("");
    try {
      const detalhesDashboard = await consultarEmailDashboard(new URLSearchParams(currentQueryString), true);
      const detalheRows = (detalhesDashboard?.detalhes || []).map((row: any) => [
        row.id,
        row.id_cliente,
        row.id_cedente,
        row.nm_carteira,
        row.grupo,
        row.canal,
        row.email_cliente,
        row.email_empresa,
        row.id_template,
        row.variaveis_json,
        row.status,
        row.dt_inclusao,
        row.dt_envio,
      ]);
      exportCsv(exportOption.fileName, exportOption.header, detalheRows);
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao exportar os detalhes do periodo.");
      setError(message);
      setFeedback({ type: "danger", message });
    } finally {
      setIsExportingDetails(false);
    }
  }

  const resumo = dashboard?.resumo;
  const formatarLabelCurta = (label: string) => label.slice(5);
  const exportOptions = [
    {
      id: "detalhes",
      label: "Detalhes completos do periodo",
      fileName: "email-detalhes-periodo.csv",
      header: ["ID", "ID_CLIENTE", "ID_CEDENTE", "NM_CARTEIRA", "GRUPO", "CANAL", "EMAIL_CLIENTE", "EMAIL_EMPRESA", "ID_TEMPLATE", "VARIAVEIS_JSON", "STATUS", "DT_INCLUSAO", "DT_ENVIO"],
      rows: (dashboard?.detalhes || []).map((row: any) => [
        row.id,
        row.id_cliente,
        row.id_cedente,
        row.nm_carteira,
        row.grupo,
        row.canal,
        row.email_cliente,
        row.email_empresa,
        row.id_template,
        row.variaveis_json,
        row.status,
        row.dt_inclusao,
        row.dt_envio,
      ]),
    },
    {
      id: "envios_semana",
      label: "Envios da semana",
      fileName: "email-envios-semana.csv",
      header: ["Periodo", "Total envios"],
      rows: (dashboard?.envios_por_semana || []).map((row: any) => [row.periodo, row.total_envios]),
    },
    {
      id: "envios_mes",
      label: "Envios do mes",
      fileName: "email-envios-mes.csv",
      header: ["Periodo", "Total envios"],
      rows: (dashboard?.envios_por_mes || []).map((row: any) => [row.periodo, row.total_envios]),
    },
    {
      id: "envios_carteira",
      label: "Envios por carteira",
      fileName: "email-envios-carteira.csv",
      header: ["Carteira", "Total envios"],
      rows: (dashboard?.envios_por_carteira || []).map((row: any) => [row.carteira, row.total_envios]),
    },
    {
      id: "envios_grupo",
      label: "Envios por grupo",
      fileName: "email-envios-grupo.csv",
      header: ["Grupo", "Total envios"],
      rows: (dashboard?.envios_por_grupo || []).map((row: any) => [row.grupo, row.total_envios]),
    },
    {
      id: "envios_canal",
      label: "Envios por canal",
      fileName: "email-envios-canal.csv",
      header: ["Canal", "Total envios"],
      rows: (dashboard?.envios_por_canal || []).map((row: any) => [row.canal, row.total_envios]),
    },
    {
      id: "templates",
      label: "Templates mais usados",
      fileName: "email-templates.csv",
      header: ["ID_TEMPLATE", "Total envios"],
      rows: (dashboard?.templates || []).map((row: any) => [row.id_template, row.total_envios]),
    },
  ];
  const exportOption = exportOptions.find((item) => item.id === exportSelection) || exportOptions[0];

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Consulta concluida" errorTitle="Falha no dashboard de email" />
      <PageHeader
        eyebrow="Analytics / Email"
        title="Dashboard SendGrid"
        description="Monitore envios de email e identifique volume, distribuicao e desvios operacionais."
      />

      <FilterPanel title="Consolide a analise em uma unica base" description="Aplique filtros unificados e alinhe indicadores, graficos e detalhamento." onSubmit={handleSubmit}>
        <label className="field"><span>Inicio</span><input name="inicio" type="date" defaultValue={currentInicio} /></label>
        <label className="field"><span>Fim</span><input name="fim" type="date" defaultValue={currentFim} /></label>
        <label className="field"><span>Carteira</span><select name="carteira" defaultValue={currentCarteira}><option value="">Todas</option>{filtros?.carteiras.map((item) => <option key={item.id} value={item.id}>{`${item.nome} (${item.id})`}</option>)}</select></label>
        <label className="field"><span>Grupo</span><select name="grupo" defaultValue={currentGrupo}><option value="">Todos</option>{filtros?.grupos.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span>Canal</span><select name="canal" defaultValue={currentCanal}><option value="">Todos</option>{filtros?.canais.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="field"><span>Status</span><select name="status" defaultValue={currentStatus}><option value="">Todos</option>{filtros?.status.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button className="button" type="submit" disabled={loading}>{loading ? "Consultando..." : "Aplicar filtros"}</button>
      </FilterPanel>
      <section className="kpi-grid">
        <KpiCard label="Total de envios" value={formatNumber(resumo?.total_envios)} helper="Volume consolidado do periodo." />
        <KpiCard label="Tempo medio" value={`${formatNumber((Number(resumo?.tempo_medio_envio) || 0) / 60)} min`} helper="Media entre inclusao e envio do email." />
        <KpiCard label="Taxa de sucesso" value={formatPercent(resumo?.taxa_sucesso_pct)} helper="Participacao de envios com sucesso." tone="success" />
        <KpiCard label="Taxa de erro" value={formatPercent(resumo?.taxa_erro_pct)} helper="Participacao de falhas no periodo." tone="warning" />
      </section>

      <AnalyticsPanel eyebrow="Volume" title="Monitore tendencia e distribuicao" description="Acompanhe variacao temporal e distribua envios por carteira, grupo e canal.">
        <div className="analytics-grid analytics-grid--three">
          <ChartCard title="Envios da semana">
            <LineChart
              data={(dashboard?.envios_por_semana || []).map((item: any) => ({ label: item.periodo, value: Number(item.total_envios) }))}
              stroke="#4a617d"
              axisLabelFormatter={formatarLabelCurta}
              maxAxisLabels={7}
            />
          </ChartCard>
          <ChartCard title="Envios do mes">
            <LineChart
              data={(dashboard?.envios_por_mes || []).map((item: any) => ({ label: item.periodo, value: Number(item.total_envios) }))}
              stroke="#7a5cff"
              axisLabelFormatter={formatarLabelCurta}
              maxAxisLabels={8}
            />
          </ChartCard>
          <ChartCard title="Envios por carteira">
            <BarChart data={(dashboard?.envios_por_carteira || []).map((item: any) => ({ label: item.carteira, value: Number(item.total_envios) }))} color="#1f5eff" />
          </ChartCard>
          <ChartCard title="Envios por grupo">
            <BarChart data={(dashboard?.envios_por_grupo || []).map((item: any) => ({ label: item.grupo, value: Number(item.total_envios) }))} color="#00a36c" />
          </ChartCard>
          <ChartCard title="Envios por canal">
            <BarChart data={(dashboard?.envios_por_canal || []).map((item: any) => ({ label: item.canal, value: Number(item.total_envios) }))} color="#ffb020" />
          </ChartCard>
          <ChartCard title="Templates mais usados">
            <BarChart data={(dashboard?.templates || []).map((item: any) => ({ label: item.id_template, value: Number(item.total_envios) }))} color="#7a5cff" />
          </ChartCard>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Investigacao" title="Exporte dados operacionais" description="Selecione o recorte desejado e gere o CSV conforme o periodo aplicado.">
        {dashboard ? (
          <ChartCard title="Baixar dados do painel">
            <div className="chart-export-card">
              <label className="field">
                <span>Selecione o relatorio</span>
                <select value={exportSelection} onChange={(event) => setExportSelection(event.target.value)}>
                  {exportOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <p>O arquivo sera gerado conforme o periodo filtrado e com as colunas correspondentes ao relatorio escolhido.</p>
              <button className="button button--secondary" type="button" onClick={() => void handleExport()} disabled={isExportingDetails}>
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
