import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import AnalyticsPanel from "@/components/analytics/AnalyticsPanel";
import ChartCard from "@/components/charts/ChartCard";
import { BarChart, LineChart } from "@/components/charts/SimpleCharts";
import FilterPanel from "@/components/filters/FilterPanel";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import KpiCard from "@/components/ui/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import { formatNumber } from "@/lib/format";
import { consultarWhatsappDashboard, getApiError } from "@/services/atlasApi";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function WhatsappDashboard() {
  const { provider = "infobip" } = useParams();
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [exportSelection, setExportSelection] = useState("controle");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    void load();
  }, [provider]);

  async function load(formData?: FormData, options?: { notify?: boolean }) {
    setLoading(true);
    setError("");
    if (options?.notify) {
      setFeedback(null);
    }
    try {
      const dashboardData = await consultarWhatsappDashboard(provider, new URLSearchParams(formData as never));
      setDashboard(dashboardData);
      if (options?.notify) {
        setFeedback({ type: "success", message: "Consulta do dashboard de WhatsApp concluida com sucesso." });
      }
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao carregar dashboard de WhatsApp.");
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

  const resumo = dashboard?.resumo;
  const meta = dashboard?.meta;
  const enviosDiariosPeriodo = dashboard?.envios_diarios_periodo || [];
  const totalEnviosCarteira = (dashboard?.envios_por_carteira || []).reduce((total: number, item: any) => total + Number(item.total_envios || 0), 0);
  const totalEnviosOperador = (dashboard?.envios_por_operador || []).reduce((total: number, item: any) => total + Number(item.total_envios || 0), 0);
  const formatarLabelCurta = (label: string) => label.slice(5);
  const formatarMes = (valor: string) => {
    const [ano, mes] = valor.split("-");
    return `${mes}/${ano}`;
  };
  const weekKey = (dataIso: string) => {
    const data = new Date(`${dataIso}T00:00:00`);
    const dia = data.getDay();
    const deslocamento = dia === 0 ? -6 : 1 - dia;
    data.setDate(data.getDate() + deslocamento);
    return data.toISOString().slice(0, 10);
  };
  const addDays = (dataIso: string, dias: number) => {
    const data = new Date(`${dataIso}T00:00:00`);
    data.setDate(data.getDate() + dias);
    return data.toISOString().slice(0, 10);
  };
  const weekOptions = Array.from(new Set(enviosDiariosPeriodo.map((item: any) => weekKey(item.periodo))))
    .sort((left, right) => left.localeCompare(right))
    .map((inicioSemana) => ({
      value: inicioSemana,
      label: `${inicioSemana.slice(5)} a ${addDays(inicioSemana, 6).slice(5)}`,
    }));
  const monthOptions = Array.from(new Set(enviosDiariosPeriodo.map((item: any) => String(item.periodo).slice(0, 7))))
    .sort((left, right) => left.localeCompare(right))
    .map((mes) => ({ value: mes, label: formatarMes(mes) }));

  useEffect(() => {
    if (weekOptions.length && !weekOptions.some((item) => item.value === selectedWeek)) {
      setSelectedWeek(weekOptions[weekOptions.length - 1].value);
    }
  }, [selectedWeek, weekOptions]);

  useEffect(() => {
    if (monthOptions.length && !monthOptions.some((item) => item.value === selectedMonth)) {
      setSelectedMonth(monthOptions[monthOptions.length - 1].value);
    }
  }, [monthOptions, selectedMonth]);

  const enviosSemanaSelecionada = enviosDiariosPeriodo.filter((item: any) => weekKey(item.periodo) === selectedWeek);
  const enviosMesSelecionado = enviosDiariosPeriodo.filter((item: any) => String(item.periodo).slice(0, 7) === selectedMonth);
  const usarJanelaAutomatica = enviosDiariosPeriodo.length <= 1;
  const serieSemana = usarJanelaAutomatica ? (dashboard?.envios_por_semana || []) : enviosSemanaSelecionada;
  const serieMes = usarJanelaAutomatica ? (dashboard?.envios_por_mes || []) : enviosMesSelecionado;
  const totalEnviosSemana = serieSemana.reduce((total: number, item: any) => total + Number(item.total_envios || 0), 0);
  const totalEnviosMes = serieMes.reduce((total: number, item: any) => total + Number(item.total_envios || 0), 0);
  const exportOptions = [
    {
      id: "controle",
      label: "Controle de envios",
      fileName: `whatsapp-${provider}-controle.csv`,
      header: ["Numero", "Data referencia", "Qtd envios", "Ultimo envio", "Dt criacao", "Dt atualizacao"],
      rows: (dashboard?.controle_envios || []).map((row: any) => [
        row.numero,
        row.data_referencia,
        row.qtd_envios,
        row.dt_ultimo_envio,
        row.dt_criacao,
        row.dt_atualizacao,
      ]),
    },
    {
      id: "numeros",
      label: "Base de numeros",
      fileName: `whatsapp-${provider}-numeros.csv`,
      header: ["Numero", "Status", "Cedente", "Canal", meta?.numbers_extra_label_1 || "Extra 1", meta?.numbers_extra_label_2 || "Extra 2", "Data consulta"],
      rows: (dashboard?.numeros || []).map((row: any) => [
        row.numero,
        row.status,
        row.cedente,
        row.canal,
        row.extra_1,
        row.extra_2,
        row.data_consulta,
      ]),
    },
    {
      id: "templates",
      label: "Catalogo de templates",
      fileName: `whatsapp-${provider}-templates.csv`,
      header: ["SID", "Nome", "Status aprovacao", "Lingua", "Data aprovacao", "Dt inclusao"],
      rows: (dashboard?.templates || []).map((row: any) => [
        row.sid_template,
        row.nome_template,
        row.status_aprovacao,
        row.lingua,
        row.data_aprovacao,
        row.dt_inclusao,
      ]),
    },
  ];
  const exportOption = exportOptions.find((item) => item.id === exportSelection) || exportOptions[0];

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Consulta concluida" errorTitle="Falha no dashboard de WhatsApp" />
      <PageHeader
        eyebrow="Analytics / WhatsApp"
        title={`Dashboard ${provider}`}
        description="Monitore envios, numeros e templates do provedor para agir com contexto."
      />

      <FilterPanel title="Consolide a consulta em uma unica base" description="Aplique filtros e alinhe controle de envios, base de numeros e catalogo de templates." onSubmit={handleSubmit}>
        <label className="field"><span>Inicio</span><input name="inicio" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label className="field"><span>Fim</span><input name="fim" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <button className="button" type="submit" disabled={loading}>{loading ? "Consultando..." : "Aplicar filtros"}</button>
      </FilterPanel>
      <section className="kpi-grid">
        <KpiCard label="Total de envios" value={formatNumber(resumo?.total_envios)} helper="Consolide envios do provedor e acompanhe a carga do periodo." />
        <KpiCard label="Ultimo envio" value={resumo?.ultimo_envio_hora || "--:--"} helper="Valide o horario do ultimo disparo para confirmar continuidade operacional." />
        <KpiCard label="Total de numeros" value={formatNumber(resumo?.total_numeros)} helper="Acompanhe a base de numeros considerada no recorte aplicado." />
        <KpiCard label="Numeros validos" value={formatNumber(resumo?.total_validos)} helper="Monitore numeros aptos ao envio conforme a regra do provedor." tone="success" />
        <KpiCard label="Total de templates" value={formatNumber(resumo?.total_templates)} helper="Consolide templates disponiveis para suportar campanhas e jornadas." />
        <KpiCard label="Templates ativos" value={formatNumber(resumo?.templates_ativos)} helper="Identifique templates liberados para uso imediato na operacao." tone="success" />
      </section>

      <AnalyticsPanel eyebrow="Temporal" title="Monitore tendencia de envios" description="Compare semanas e meses para identificar variacoes no volume do provedor.">
        <div className="analytics-grid analytics-grid--two">
          <ChartCard
            title="Envios da semana"
            subtitle="Contexto comparativo"
            action={(
              <label className="field chart-card__filter">
                <span>Semana</span>
                <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)}>
                  {weekOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            )}
          >
            <>
              <LineChart
                data={serieSemana.map((item: any) => ({ label: item.periodo, value: Number(item.total_envios) }))}
                stroke="#1f5eff"
                axisLabelFormatter={formatarLabelCurta}
                maxAxisLabels={7}
              />
              <div className="chart-summary">Total: {formatNumber(totalEnviosSemana)}</div>
            </>
          </ChartCard>
          <ChartCard
            title="Envios do mes"
            subtitle="Contexto comparativo"
            action={(
              <label className="field chart-card__filter">
                <span>Mes</span>
                <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                  {monthOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            )}
          >
            <>
              <LineChart
                data={serieMes.map((item: any) => ({ label: item.periodo, value: Number(item.total_envios) }))}
                stroke="#4a617d"
                axisLabelFormatter={formatarLabelCurta}
                maxAxisLabels={10}
              />
              <div className="chart-summary">Total: {formatNumber(totalEnviosMes)}</div>
            </>
          </ChartCard>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Produtividade" title="Monitore envios por carteira e operador" description="Acompanhe distribuicao operacional e identifique concentracao por responsavel.">
        <div className="analytics-grid analytics-grid--two">
          <ChartCard title="Envios por carteira" subtitle="Todas as carteiras no periodo">
            <>
              <BarChart
                data={(dashboard?.envios_por_carteira || []).map((item: any) => ({ label: item.label, value: Number(item.total_envios) }))}
                color="#ff7a1a"
                formatValue={(value) => formatNumber(value)}
              />
              <div className="chart-summary">Total: {formatNumber(totalEnviosCarteira)}</div>
            </>
          </ChartCard>
          <ChartCard title="Envios por operador" subtitle="Top 10 operadores">
            <>
              <BarChart
                data={(dashboard?.envios_por_operador || []).map((item: any) => ({ label: item.label, value: Number(item.total_envios) }))}
                color="#1f5eff"
                formatValue={(value) => formatNumber(value)}
              />
              <div className="chart-summary">Total: {formatNumber(totalEnviosOperador)}</div>
            </>
          </ChartCard>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel eyebrow="Investigacao" title="Exporte dados operacionais" description="Selecione o relatorio e gere o CSV conforme o periodo filtrado.">
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
              <button
                className="button button--secondary"
                type="button"
                onClick={() => exportCsv(exportOption.fileName, exportOption.header, exportOption.rows)}
              >
                Exportar CSV
              </button>
            </div>
          </ChartCard>
        ) : <div className="empty-state">Aplique filtros para carregar dados operacionais do painel.</div>}
      </AnalyticsPanel>
    </div>
  );
}
