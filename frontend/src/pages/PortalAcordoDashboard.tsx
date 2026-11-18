import axios from "axios";
import { FormEvent, startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

import AnalyticsPanel from "@/components/analytics/AnalyticsPanel";
import ChartCard from "@/components/charts/ChartCard";
import { BarChart, DonutChart, LineChart } from "@/components/charts/SimpleCharts";
import FilterPanel from "@/components/filters/FilterPanel";
import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import KpiCard from "@/components/ui/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import { formatNumber, formatPercent } from "@/lib/format";
import { useRevelarNaRolagem } from "@/lib/revelarNaRolagem";
import {
  consultarPortalAcordoDashboard,
  getApiError,
  listarPortalAcordoFiltros,
  type PortalAcordoDashboard as PortalAcordoDashboardPayload,
  type PortalAcordoFiltros,
} from "@/services/atlasApi";

type PortalAcordoCache = {
  filtros: PortalAcordoFiltros | null;
  dashboard: PortalAcordoDashboardPayload | null;
  currentQueryString: string;
  lastUpdatedAt: string;
};

const dashboardCaches: Record<string, PortalAcordoCache | null> = { portal: null, app: null };

const ORIGEM_LABEL: Record<string, string> = { portal: "Portal web", app: "App mobile" };

/** Datas chegam em ISO (26 caracteres) e estouram a largura da coluna. */
function dataHora(valor: string) {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function isoDaysAgo(days: number) {
  const reference = new Date();
  reference.setDate(reference.getDate() - days);
  // Formata pelo calendário local. toISOString() converte para UTC e, a partir das 21h
  // de Brasília, devolveria o dia seguinte — o painel abriria com um dia futuro zerado
  // no fim da série, que numa tela de monitoramento se lê como queda de tráfego.
  const mes = String(reference.getMonth() + 1).padStart(2, "0");
  const dia = String(reference.getDate()).padStart(2, "0");
  return `${reference.getFullYear()}-${mes}-${dia}`;
}

function buildDefaultQueryString(origem: string) {
  const params = new URLSearchParams();
  params.set("inicio", isoDaysAgo(29));
  params.set("fim", isoDaysAgo(0));
  params.set("origem", origem);
  return params.toString();
}

export default function PortalAcordoDashboard() {
  const [origem, setOrigem] = useState("portal");
  const cacheAtual = dashboardCaches[origem];
  const [filtros, setFiltros] = useState<PortalAcordoFiltros | null>(cacheAtual?.filtros || null);
  const [dashboard, setDashboard] = useState<PortalAcordoDashboardPayload | null>(cacheAtual?.dashboard || null);
  const [bootstrapping, setBootstrapping] = useState(!cacheAtual?.dashboard);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(cacheAtual?.lastUpdatedAt || "");
  const [currentQueryString, setCurrentQueryString] = useState(
    cacheAtual?.currentQueryString || buildDefaultQueryString("portal"),
  );
  const currentRequestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const deferredDashboard = useDeferredValue(dashboard);
  const conteudoRef = useRef<HTMLDivElement>(null);
  // Reavalia a cada payload novo: trocar de origem ou de periodo remonta os
  // paineis, e os que nascem fora da dobra precisam entrar no observador.
  useRevelarNaRolagem(conteudoRef, [deferredDashboard]);

  const currentQueryParams = new URLSearchParams(currentQueryString);
  const currentInicio = currentQueryParams.get("inicio") || isoDaysAgo(29);
  const currentFim = currentQueryParams.get("fim") || isoDaysAgo(0);
  const currentCedente = currentQueryParams.get("cedente") || "";
  const currentCategoria = currentQueryParams.get("categoria") || "";

  useEffect(() => {
    if (!dashboardCaches[origem]) {
      void load({ origemAlvo: origem, refreshFilters: true });
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function load({
    formData,
    origemAlvo,
    refreshFilters = false,
    notify = false,
  }: { formData?: FormData; origemAlvo?: string; refreshFilters?: boolean; notify?: boolean } = {}) {
    const requestId = currentRequestRef.current + 1;
    currentRequestRef.current = requestId;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const queryParams = formData ? new URLSearchParams(formData as never) : new URLSearchParams(currentQueryString);
    const origemEfetiva = origemAlvo || queryParams.get("origem") || origem;
    queryParams.set("origem", origemEfetiva);
    const cacheDestino = dashboardCaches[origemEfetiva];

    if (!cacheDestino?.dashboard) {
      setBootstrapping(true);
    }
    setIsRefreshing(true);
    setError("");
    if (notify) {
      setFeedback(null);
    }

    try {
      const [filtrosData, dashboardData] = await Promise.all([
        cacheDestino?.filtros && !refreshFilters
          ? Promise.resolve(cacheDestino.filtros)
          : listarPortalAcordoFiltros(origemEfetiva, controller.signal),
        consultarPortalAcordoDashboard(queryParams, controller.signal),
      ]);

      if (requestId !== currentRequestRef.current) {
        return;
      }

      const atualizadoEm = new Date().toLocaleTimeString("pt-BR");
      startTransition(() => {
        setOrigem(origemEfetiva);
        setFiltros(filtrosData);
        setDashboard(dashboardData);
        setCurrentQueryString(queryParams.toString());
        setLastUpdatedAt(atualizadoEm);
        dashboardCaches[origemEfetiva] = {
          filtros: filtrosData,
          dashboard: dashboardData,
          currentQueryString: queryParams.toString(),
          lastUpdatedAt: atualizadoEm,
        };
      });
      if (notify) {
        // Consulta que volta vazia nao e falha nem sucesso: o filtro rodou, so nao
        // achou evento. Avisar "concluida com sucesso" com a tela zerada faz o gestor
        // procurar defeito onde nao tem - e um erro de infraestrutura faria o oposto.
        const rotuloOrigem = ORIGEM_LABEL[origemEfetiva] || origemEfetiva;
        setFeedback(
          dashboardData?.resumo?.total_eventos
            ? { type: "success", message: `Consulta do ${rotuloOrigem} concluída com sucesso.` }
            : {
                type: "warning",
                message: `Nenhum evento de ${rotuloOrigem} para o período e os filtros aplicados.`,
              },
        );
      }
    } catch (requestError) {
      if (axios.isCancel(requestError)) {
        return;
      }
      const message = getApiError(requestError, "Falha ao carregar o monitoramento do Portal Acordo.");
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const origemSelecionada = String(formData.get("origem") || origem);
    const trocouOrigem = origemSelecionada !== origem;
    if (trocouOrigem) {
      // Carteira e categoria são listas próprias de cada origem: levar a seleção do
      // portal para o app filtra por um valor que não existe lá e devolve zero eventos,
      // enquanto o select — repopulado com os filtros novos — volta a exibir "Todas".
      formData.delete("cedente");
      formData.delete("categoria");
    }
    void load({ formData, origemAlvo: origemSelecionada, refreshFilters: trocouOrigem, notify: true });
  }

  const resumo = deferredDashboard?.resumo;
  const jornada = deferredDashboard?.jornada || [];
  const naoCatalogados = deferredDashboard?.nao_catalogados || [];
  const semDados = !!deferredDashboard && !resumo?.total_eventos;
  const formatarLabelCurta = (label: string) => label.slice(5);

  return (
    <div className="stack-lg pq-page" ref={conteudoRef}>
      <FeedbackToastBridge
        feedback={feedback}
        successTitle="Consulta concluída"
        errorTitle="Falha no monitoramento"
        warningTitle="Sem resultado"
      />
      <PageHeader
        eyebrow="Analytics / Portal Acordo"
        title="Monitoramento Portal Acordo"
        description="Acompanhe a jornada do cliente no portal e no app, identifique onde a negociação trava e detecte instrumentação desatualizada."
        meta={
          deferredDashboard
            ? [
                { label: "Origem", value: ORIGEM_LABEL[deferredDashboard.origem] || deferredDashboard.origem },
                { label: "Período", value: `${deferredDashboard.periodo.inicio} a ${deferredDashboard.periodo.fim}` },
                { label: "Dispositivos", value: formatNumber(resumo?.dispositivos) },
              ]
            : undefined
        }
      />

      <FilterPanel
        title="Recorte a jornada por período, origem e carteira"
        description={
          isRefreshing
            ? "Atualizando em segundo plano — a leitura atual continua disponível até a nova consulta concluir."
            : "O padrão são os últimos 30 dias, porque uma jornada de funil não se lê em um único dia."
        }
        onSubmit={handleSubmit}
        actions={lastUpdatedAt ? <span className="panel-status">Última atualização: {lastUpdatedAt}</span> : null}
      >
        <label className="field"><span>Início</span><input name="inicio" type="date" defaultValue={currentInicio} /></label>
        <label className="field"><span>Fim</span><input name="fim" type="date" defaultValue={currentFim} /></label>
        <label className="field">
          <span>Origem</span>
          <select name="origem" defaultValue={origem}>
            <option value="portal">Portal web</option>
            <option value="app">App mobile</option>
          </select>
        </label>
        <label className="field">
          <span>Carteira</span>
          <select name="cedente" defaultValue={currentCedente}>
            <option value="">Todas</option>
            {filtros?.carteiras.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Categoria</span>
          <select name="categoria" defaultValue={currentCategoria}>
            <option value="">Todas</option>
            {filtros?.categorias.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="button" type="submit">{isRefreshing ? "Atualizando..." : "Aplicar filtros"}</button>
      </FilterPanel>

      {bootstrapping && !deferredDashboard ? <div className="page-loader">Consultando os eventos...</div> : null}

      {error ? (
        <section className="panel">
          <div className="empty-state">{error}</div>
        </section>
      ) : null}

      {semDados ? (
        <section className="panel">
          <div className="empty-state">
            <strong>Sem resultado.</strong> A consulta rodou normalmente e não encontrou nenhum evento de{" "}
            {ORIGEM_LABEL[origem] || origem} no período e nos filtros aplicados.
            {filtros?.periodo_disponivel.ultimo_evento
              ? ` O último evento registrado nessa origem foi em ${filtros.periodo_disponivel.ultimo_evento.slice(0, 10)} — ajuste o período para alcançá-lo.`
              : ""}
          </div>
        </section>
      ) : null}

      {/* Nada abaixo é renderizado antes de haver payload: KPIs zerados e a frase
          "todo evento está catalogado" afirmariam fatos que nunca foram consultados
          quando a requisição falha. */}
      {deferredDashboard ? (
      <>
      <section className={`kpi-grid ${isRefreshing ? "dashboard-refreshing" : ""}`}>
        <KpiCard label="Eventos" value={formatNumber(resumo?.total_eventos)} helper="Volume bruto capturado no período." />
        <KpiCard label="Dispositivos" value={formatNumber(resumo?.dispositivos)} helper="Unidade do funil: presente em todo evento, inclusive antes do login." />
        <KpiCard label="CPFs identificados" value={formatNumber(resumo?.cpfs_unicos)} helper="Só existe depois do acesso — não serve para medir as etapas iniciais." />
        <KpiCard label="Taxa de erro" value={formatPercent(resumo?.taxa_erro_pct)} helper="Eventos de erro sobre o total do período." tone="warning" />
        <KpiCard
          label="Eventos desconhecidos"
          value={formatNumber(resumo?.eventos_desconhecidos)}
          helper="Código em campo fora do catálogo — ou falha ao ler o catálogo, que dá o mesmo sintoma."
          tone={resumo?.eventos_desconhecidos ? "danger" : "default"}
        />
        <KpiCard label="Dias com dados" value={formatNumber(resumo?.dias_com_dados)} helper="Cobertura real do período filtrado." />
      </section>

      <AnalyticsPanel
        eyebrow="Jornada"
        title="Veja em qual etapa a negociação trava"
        description="Cada etapa conta dispositivos distintos, não eventos: uma pessoa dispara vários eventos na mesma etapa, e contar eventos faria uma etapa posterior parecer maior que a anterior."
      >
        <div className="analytics-grid analytics-grid--two">
          <ChartCard title="Etapas da jornada" subtitle="Dispositivos distintos por etapa">
            <BarChart
              data={jornada.map((item) => ({ label: item.etapa, value: item.dispositivos }))}
              formatValue={(value) => formatNumber(value)}
              color="#1f5eff"
            />
          </ChartCard>
          <ChartCard title="Conversão de etapa para etapa" subtitle="Percentual que avançou da etapa anterior">
            <BarChart
              data={jornada
                .filter((item) => item.pct_da_anterior !== null)
                .map((item) => ({ label: item.etapa, value: Number(item.pct_da_anterior) }))}
              formatValue={(value) => formatPercent(value)}
              color="#00a36c"
            />
          </ChartCard>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel
        eyebrow="Temporal"
        title="Acompanhe o volume diário"
        description="Compare eventos e pessoas identificadas ao longo do período para separar pico de tráfego de pico de negociação."
      >
        <div className="analytics-grid analytics-grid--two">
          <ChartCard title="Eventos por dia">
            <LineChart
              data={(deferredDashboard?.eventos_por_dia || []).map((item) => ({ label: item.periodo, value: item.total_eventos }))}
              stroke="#1f5eff"
              axisLabelFormatter={formatarLabelCurta}
              maxAxisLabels={7}
            />
          </ChartCard>
          <ChartCard title="CPFs identificados por dia">
            <LineChart
              data={(deferredDashboard?.eventos_por_dia || []).map((item) => ({ label: item.periodo, value: item.cpfs_unicos }))}
              stroke="#7a5cff"
              axisLabelFormatter={formatarLabelCurta}
              maxAxisLabels={7}
            />
          </ChartCard>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel
        eyebrow="Distribuição"
        title="Entenda a concentração por categoria, carteira e canal de chegada"
        description="A carteira sai do CEDENTE do evento e, quando ele não vem, da página de origem ou do histórico do dispositivo. O balde (sem carteira) é o topo do funil — home, consulta e login acontecem antes de o visitante escolher carteira. A origem do tráfego vem do referrer: acesso direto é link de SMS, endereço digitado ou WhatsApp copiado, não falha de captura."
      >
        <div className="analytics-grid analytics-grid--two">
          <ChartCard title="Eventos por categoria">
            <DonutChart data={(deferredDashboard?.por_categoria || []).map((item) => ({ label: item.categoria, value: item.total }))} />
          </ChartCard>
          <ChartCard title="Eventos por carteira">
            <BarChart
              data={(deferredDashboard?.por_carteira || []).map((item) => ({ label: item.carteira, value: item.total }))}
              formatValue={(value) => formatNumber(value)}
              color="#ffb020"
            />
          </ChartCard>
          <ChartCard title="Eventos mais disparados" subtitle="Top 20 do período">
            <BarChart
              data={(deferredDashboard?.top_eventos || []).map((item) => ({ label: item.nome, value: item.total }))}
              formatValue={(value) => formatNumber(value)}
              color="#4a617d"
            />
          </ChartCard>
          <ChartCard
            title="Origem do tráfego"
            subtitle="Dispositivos distintos por canal de chegada"
          >
            <BarChart
              data={(deferredDashboard?.origens_trafego || []).map((item) => ({
                label: item.canal,
                value: item.dispositivos,
              }))}
              formatValue={(value) => formatNumber(value)}
              color="#00a36c"
            />
          </ChartCard>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel
        eyebrow="Saúde da instrumentação"
        title="Descubra o que está sendo emitido fora do catálogo"
        description="Um código aqui significa que o site está disparando um evento que o catálogo ainda não conhece — ou que a leitura do catálogo falhou, o que produz exatamente o mesmo registro."
      >
        {naoCatalogados.length ? (
          <DataTable
            className="table-scroll-x"
            data={naoCatalogados}
            exportFileName="portalacordo-eventos-nao-catalogados.csv"
            emptyMessage="Nenhum evento fora do catálogo no período."
            initialSortColumn="total"
            columns={[
              { id: "evento_original", title: "Código emitido", accessor: (row) => row.evento_original, sortable: true },
              { id: "total", title: "Ocorrências", accessor: (row) => row.total, sortable: true },
              { id: "primeiro", title: "Primeira vez", accessor: (row) => row.primeiro, render: (row) => dataHora(row.primeiro), sortable: true },
              { id: "ultimo", title: "Última vez", accessor: (row) => row.ultimo, render: (row) => dataHora(row.ultimo), sortable: true },
            ]}
          />
        ) : (
          <div className="empty-state">Todo evento do período está no catálogo.</div>
        )}
      </AnalyticsPanel>
      </>
      ) : null}
    </div>
  );
}
