import { useEffect, useMemo, useState } from "react";

import Modal from "@/components/modals/Modal";
import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  atualizarCentroCusto2Operacional,
  getApiError,
  listarCentrosCustoOperacional,
  listarColaboradoresCarteiraVega,
  type CentroCusto,
  type ColaboradorCarteiraOperacional,
} from "@/services/atlasApi";

export default function UsuariosCarteiraVega() {
  const { user } = useAuth();
  const responsavel = user?.nm_colaborador ?? user?.nm_login ?? "";
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorCarteiraOperacional[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [selected, setSelected] = useState<ColaboradorCarteiraOperacional | null>(null);
  const [centroCusto2, setCentroCusto2] = useState("");
  const [centroCusto2Display, setCentroCusto2Display] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [centrosData, colaboradoresData] = await Promise.all([
        listarCentrosCustoOperacional(),
        listarColaboradoresCarteiraVega(),
      ]);
      setCentros(centrosData);
      setColaboradores(colaboradoresData);
      setFeedback(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao carregar a carteira operacional.") });
    } finally {
      setLoading(false);
    }
  }

  function openEdit(row: ColaboradorCarteiraOperacional) {
    setSelected(row);
    setCentroCusto2(row.centro_custo_2 || "");
    setCentroCusto2Display(row.centro_custo_2 || "");
  }

  function atualizarCentroCusto2PorDisplay(valor: string) {
    const display = String(valor || "");
    const valorLimpo = display.trim();
    const centroRelacionado = centros.find((item) => {
      const id = String(item.id_centro_custo).trim();
      const label = `${id} - ${item.centro_custo}`;
      return valorLimpo === id || valorLimpo === label;
    });

    if (centroRelacionado) {
      setCentroCusto2(centroRelacionado.centro_custo);
      setCentroCusto2Display(`${centroRelacionado.id_centro_custo} - ${centroRelacionado.centro_custo}`);
      return;
    }

    setCentroCusto2(valorLimpo);
    setCentroCusto2Display(display);
  }

  async function handleSave() {
    if (!selected) return;
    const centroFinal = centroCusto2.trim();
    if (!centroFinal) {
      setFeedback({ type: "danger", message: "Selecione o novo centro de custo 2." });
      return;
    }

    setSaving(true);
    try {
      const data = await atualizarCentroCusto2Operacional(selected.cpf, {
        centro_custo_2: centroFinal,
        responsavel,
      });
      setColaboradores((current) =>
        current.map((item) => (item.cpf === selected.cpf ? { ...item, centro_custo_2: centroFinal } : item)),
      );
      setFeedback({ type: "success", message: data.mensagem });
      setSelected(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao atualizar o centro de custo 2.") });
    } finally {
      setSaving(false);
    }
  }

  const totalSemCarteira = useMemo(
    () => colaboradores.filter((item) => !(item.centro_custo_2 || "").trim()).length,
    [colaboradores],
  );

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Carteira atualizada" errorTitle="Falha na carteira" />
      <PageHeader
        eyebrow="Usuarios"
        title="Centro de custo 2"
        description="Atualize o Centro de Custo 2 da Vega e mantenha a carteira do operador consistente."
      />

      <section className="kpi-grid">
        <article className="surface-card">
          <p className="eyebrow">Base operacional</p>
          <h2>{colaboradores.length}</h2>
          <p>Consolide colaboradores vinculados ao Vega 2 para agir com contexto.</p>
        </article>
        <article className="surface-card">
          <p className="eyebrow">Pendentes</p>
          <h2>{totalSemCarteira}</h2>
          <p>Identifique registros sem carteira definida e reduza pendencias operacionais.</p>
        </article>
      </section>

      {loading ? (
        <div className="page-loader">Carregando base operacional...</div>
      ) : (
        <div className="usuarios-carteira__table">
          <DataTable
            title="Gerencie carteiras operacionais"
            exportFileName="usuarios-carteira-vega.csv"
            pageSize={10}
            searchPlaceholder="Buscar por nome, CPF, funcao ou carteira"
            initialSortColumn="colaborador"
            initialSortDirection="asc"
            data={colaboradores}
            columns={[
              { id: "colaborador", title: "Colaborador", accessor: (row) => row.colaborador, sortable: true },
              { id: "cpf", title: "CPF", accessor: (row) => row.cpf, sortable: true },
              { id: "funcao", title: "Funcao", accessor: (row) => row.funcao, sortable: true },
              {
                id: "idCc",
                title: "ID CC",
                accessor: (row) => row.id_centro_custo,
                sortable: true,
                render: (row) => (
                  <div className="usuarios-carteira__cell usuarios-carteira__cell--cc">{row.id_centro_custo}</div>
                ),
                align: "right",
              },
              {
                id: "cc",
                title: "Centro de custo",
                accessor: (row) => row.centro_custo,
                sortable: true,
                render: (row) => <div className="usuarios-carteira__cell usuarios-carteira__cell--cc">{row.centro_custo}</div>,
              },
              {
                id: "cc2",
                title: "Centro de custo 2",
                accessor: (row) => row.centro_custo_2,
                sortable: true,
                render: (row) => (
                  <div className="usuarios-carteira__cell usuarios-carteira__cell--cc">{row.centro_custo_2 || "-"}</div>
                ),
                align: "right",
              },
              {
                id: "acoes",
                title: "Acao",
                accessor: (row) => row.cpf,
                render: (row) => (
                  <button
                    className="button button--secondary usuarios-carteira__action"
                    type="button"
                    onClick={() => openEdit(row)}
                  >
                    Editar carteira
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Atualizar centro de custo 2"
        description="Atualize a carteira operacional do colaborador sem alterar outros dados."
      >
        {selected ? (
          <div className="stack-lg">
            <div className="info-grid">
              <article className="info-card">
                <span>Colaborador</span>
                <strong>{selected.colaborador}</strong>
              </article>
              <article className="info-card">
                <span>CPF</span>
                <strong>{selected.cpf}</strong>
              </article>
              <article className="info-card">
                <span>Funcao</span>
                <strong>{selected.funcao}</strong>
              </article>
              <article className="info-card">
                <span>Centro atual</span>
                <strong>
                  {selected.id_centro_custo} - {selected.centro_custo}
                </strong>
              </article>
            </div>

            <label className="field">
              <span>Novo centro de custo 2</span>
              <input
                list="usuarios-carteira-centros-list"
                value={centroCusto2Display}
                onChange={(event) => atualizarCentroCusto2PorDisplay(event.target.value)}
                placeholder="Selecione ou digite..."
              />
            </label>

            <label className="field">
              <span>Responsavel</span>
              <input value={responsavel} readOnly />
            </label>

            <div className="toolbar">
              <button className="button button--ghost-neutral" type="button" onClick={() => setSelected(null)}>
                Fechar
              </button>
              <button className="button" type="button" disabled={saving} onClick={handleSave}>
                {saving ? "Salvando..." : "Atualizar"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <datalist id="usuarios-carteira-centros-list">
        {centros.map((item) => (
          <option
            key={`${item.id_centro_custo}-${item.centro_custo}`}
            value={`${item.id_centro_custo} - ${item.centro_custo}`}
          />
        ))}
      </datalist>
    </div>
  );
}
