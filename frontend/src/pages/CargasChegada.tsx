import { FormEvent, useEffect, useState } from "react";

import DataTable from "@/components/tables/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { getApiError, listarRecebimentoCargas, type CargasRecebimentoResponse } from "@/services/atlasApi";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CargasChegada() {
  const [dados, setDados] = useState<CargasRecebimentoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState(todayIso());

  useEffect(() => {
    void load();
  }, []);

  async function load(formData?: FormData, options?: { notify?: boolean }) {
    setLoading(true);
    setError("");
    if (options?.notify) {
      setFeedback(null);
    }
    try {
      const params = new URLSearchParams();
      params.set("data", dataSelecionada);
      if (formData) {
        const data = String(formData.get("data") || "").trim();
        const cedente = String(formData.get("cedente") || "").trim();
        if (data) {
          params.set("data", data);
          setDataSelecionada(data);
        }
        if (cedente) {
          params.set("cedente", cedente);
        }
      }
      setDados(await listarRecebimentoCargas(params));
      if (options?.notify) {
        setFeedback({ type: "success", message: "Consulta de recebimento de cargas concluida com sucesso." });
      }
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao carregar recebimento das cargas.");
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

  return (
    <div className="stack-md operacoes-page">
      <FeedbackToastBridge feedback={feedback} successTitle="Consulta concluida" errorTitle="Falha no recebimento de cargas" />
      <PageHeader
        eyebrow="Operacoes / EasyCollector"
        title="Recebimento cargas"
        description="Confirme recebimentos de carga e valide horarios e arquivos por cedente."
      />

      <section className="surface-card surface-card--compact operacoes-toolbar">
        <form className="filters-grid filters-grid--recebimento operacoes-toolbar__form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Dia</span>
            <input name="data" type="date" value={dataSelecionada} onChange={(event) => setDataSelecionada(event.target.value)} />
          </label>
          <label className="field">
            <span>Cedente</span>
            <select name="cedente" defaultValue="">
              <option value="">Todos</option>
              {(dados?.cedentes || []).map((item) => (
                <option key={`${item.id}-${item.nome}`} value={String(item.id)}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <button className="button filters-grid__submit filters-grid__submit--inline" type="submit" disabled={loading}>
            {loading ? "Consultando..." : "Aplicar filtros"}
          </button>
        </form>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Recebimentos" value={dados?.resumo.total_recebimentos || 0} helper="Consolide registros recebidos para validar a janela do dia." />
        <KpiCard label="Total de arquivos" value={dados?.resumo.total_arquivos || 0} helper="Some arquivos recebidos e confirme o volume processado." />
      </section>

      <DataTable
        title="Valide o recebimento das cargas"
        exportFileName={`recebimento-cargas-${dados?.data_referencia || dataSelecionada}.csv`}
        pageSize={14}
        searchPlaceholder="Buscar por cedente, arquivo ou horario"
        initialSortColumn="horario"
        initialSortDirection="desc"
        data={dados?.recebimentos || []}
        columns={[
          { id: "id_cedente", title: "ID cedente", accessor: (row) => row.id_cedente, sortable: true, align: "right" },
          { id: "nm_cedente", title: "Cedente", accessor: (row) => row.nm_cedente, sortable: true },
          { id: "horario", title: "Horario", accessor: (row) => row.horario, sortable: true },
          { id: "qtd_arquivos", title: "Qtd arquivos", accessor: (row) => row.qtd_arquivos, sortable: true, align: "right" },
          { id: "nm_arquivos", title: "Arquivos", accessor: (row) => row.nm_arquivos, sortable: true },
        ]}
      />
    </div>
  );
}
