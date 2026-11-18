import { useEffect, useMemo, useState } from "react";

import Modal from "@/components/modals/Modal";
import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import {
  atualizarNumeroInfobip,
  getApiError,
  listarCarteirasPermitidasInfobip,
  listarNumerosInfobip,
  type CarteiraPermitidaInfobip,
  type NumeroInfobip,
} from "@/services/atlasApi";

type EdicaoNumero = {
  item: NumeroInfobip;
  ativo: number;
  carteiras: string[];
};

function formatarCarteiras(valor: string) {
  return valor ? valor.replace(/;/g, "; ") : "-";
}

export default function WhatsappNumerosInfobip() {
  const [numeros, setNumeros] = useState<NumeroInfobip[]>([]);
  const [carteiras, setCarteiras] = useState<CarteiraPermitidaInfobip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [edicao, setEdicao] = useState<EdicaoNumero | null>(null);
  const [buscaCarteira, setBuscaCarteira] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [numerosResponse, carteirasResponse] = await Promise.all([
        listarNumerosInfobip(),
        listarCarteirasPermitidasInfobip(),
      ]);
      setNumeros(numerosResponse.numeros || []);
      setCarteiras(carteirasResponse.carteiras || []);
      setFeedback(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao carregar numeros Infobip.") });
    } finally {
      setLoading(false);
    }
  }

  function abrirEdicao(item: NumeroInfobip) {
    setEdicao({
      item,
      ativo: Number(item.ativo || 0) === 1 ? 1 : 0,
      carteiras: item.carteiras_permitidas_lista || [],
    });
    setBuscaCarteira("");
  }

  function alternarCarteira(valor: string) {
    setEdicao((current) => {
      if (!current) return current;
      const existe = current.carteiras.includes(valor);
      return {
        ...current,
        carteiras: existe ? current.carteiras.filter((item) => item !== valor) : [...current.carteiras, valor],
      };
    });
  }

  async function salvarEdicao() {
    if (!edicao) return;
    if (!edicao.carteiras.length) {
      setFeedback({ type: "danger", message: "Selecione ao menos uma carteira permitida." });
      return;
    }

    setSaving(true);
    try {
      const response = await atualizarNumeroInfobip(edicao.item.id, {
        ativo: edicao.ativo,
        carteiras_permitidas: edicao.carteiras,
      });
      setNumeros((current) => current.map((item) => (item.id === response.numero.id ? response.numero : item)));
      setFeedback({ type: "success", message: response.mensagem || "Numero Infobip atualizado com sucesso." });
      setEdicao(null);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao atualizar numero Infobip.") });
    } finally {
      setSaving(false);
    }
  }

  const carteirasFiltradas = useMemo(() => {
    const termo = buscaCarteira.trim().toLowerCase();
    if (!termo) return carteiras;
    return carteiras.filter((item) => item.valor.toLowerCase().includes(termo));
  }, [buscaCarteira, carteiras]);
  const carteirasAtuaisForaLista = useMemo(() => {
    if (!edicao) return [];
    const opcoesAtuais = new Set(carteiras.map((item) => item.valor));
    return edicao.carteiras.filter((valor) => !opcoesAtuais.has(valor));
  }, [edicao, carteiras]);

  const totalAtivos = useMemo(() => numeros.filter((item) => Number(item.ativo) === 1).length, [numeros]);
  const totalInativos = Math.max(numeros.length - totalAtivos, 0);

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Numero atualizado" errorTitle="Falha nos numeros Infobip" />
      <PageHeader
        eyebrow="Operacao controlada / WhatsApp"
        title="Numeros Infobip"
        description="Consulte a base operacional de numeros e atualize somente status ativo e carteiras permitidas."
        meta={[
          { label: "Total", value: String(numeros.length) },
          { label: "Ativos", value: String(totalAtivos) },
          { label: "Inativos", value: String(totalInativos) },
          { label: "Carteiras", value: String(carteiras.length) },
        ]}
        actions={
          <button className="button button--secondary" type="button" onClick={() => void load()} disabled={loading}>
            Atualizar
          </button>
        }
      />

      {loading ? (
        <div className="page-loader">Carregando numeros Infobip...</div>
      ) : (
        <DataTable
          className="whatsapp-numeros-table"
          exportFileName="whatsapp-numeros-infobip.csv"
          searchPlaceholder="Buscar por numero, cedente, status ou carteira"
          initialSortColumn="id"
          initialSortDirection="desc"
          pageSize={12}
          data={numeros}
          columns={[
            { id: "id", title: "ID", accessor: (row) => row.id, sortable: true, align: "right" },
            { id: "numero", title: "Numero", accessor: (row) => row.numero, sortable: true },
            { id: "cedente", title: "Cedente", accessor: (row) => row.cedente, sortable: true },
            { id: "canal", title: "Canal", accessor: (row) => row.canal, sortable: true },
            { id: "qualidade", title: "Qualidade", accessor: (row) => row.qualidade_raw || row.status, sortable: true },
            {
              id: "ativo",
              title: "Ativo",
              accessor: (row) => row.ativo,
              sortable: true,
              align: "center",
              render: (row) => (
                <span className={`status-pill ${Number(row.ativo) === 1 ? "status-pill--success" : "status-pill--danger"}`}>
                  {Number(row.ativo) === 1 ? "1" : "0"}
                </span>
              ),
            },
            {
              id: "carteiras",
              title: "Carteiras permitidas",
              accessor: (row) => row.carteiras_permitidas,
              sortable: true,
              render: (row) => <span className="muted">{formatarCarteiras(row.carteiras_permitidas)}</span>,
            },
            {
              id: "acao",
              title: "Acao",
              accessor: (row) => row.id,
              render: (row) => (
                <button className="button button--secondary" type="button" onClick={() => abrirEdicao(row)}>
                  Editar
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={!!edicao}
        onClose={() => setEdicao(null)}
        title="Editar numero Infobip"
        description="Apenas ativo e carteiras permitidas podem ser alterados."
      >
        {edicao ? (
          <div className="stack-lg">
            <div className="info-grid">
              <article className="info-card">
                <span>ID</span>
                <strong>{edicao.item.id}</strong>
              </article>
              <article className="info-card">
                <span>Numero</span>
                <strong>{edicao.item.numero}</strong>
              </article>
              <article className="info-card">
                <span>Cedente</span>
                <strong>{edicao.item.cedente || "-"}</strong>
              </article>
            </div>

            <label className="field">
              <span>Ativo</span>
              <select value={edicao.ativo} onChange={(event) => setEdicao({ ...edicao, ativo: Number(event.target.value) })}>
                <option value={1}>1</option>
                <option value={0}>0</option>
              </select>
            </label>

            <label className="field">
              <span>Buscar carteira</span>
              <input
                value={buscaCarteira}
                onChange={(event) => setBuscaCarteira(event.target.value)}
                placeholder="Digite ID cedente ou nome da carteira"
              />
            </label>

            <div className="panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Carteiras permitidas</p>
                  <h2>{edicao.carteiras.length} selecionadas</h2>
                </div>
              </div>
              {carteirasAtuaisForaLista.length ? (
                <div className="stack-lg">
                  <p className="muted">
                    Estas carteiras ja estavam gravadas neste numero, mas nao aparecem na consulta atual de carteiras.
                  </p>
                  <div className="checkbox-grid whatsapp-numeros-carteiras">
                    {carteirasAtuaisForaLista.map((valor) => (
                      <label className="checkbox-card" key={valor}>
                        <input
                          type="checkbox"
                          checked={edicao.carteiras.includes(valor)}
                          onChange={() => alternarCarteira(valor)}
                        />
                        <span>{valor}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="checkbox-grid whatsapp-numeros-carteiras">
                {carteirasFiltradas.map((carteira) => (
                  <label className="checkbox-card" key={carteira.valor}>
                    <input
                      type="checkbox"
                      checked={edicao.carteiras.includes(carteira.valor)}
                      onChange={() => alternarCarteira(carteira.valor)}
                    />
                    <span>{carteira.valor}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Valor que sera gravado</span>
              <textarea value={edicao.carteiras.join(";")} readOnly rows={3} />
            </label>

            <div className="toolbar">
              <button className="button button--ghost-neutral" type="button" onClick={() => setEdicao(null)}>
                Fechar
              </button>
              <button className="button" type="button" disabled={saving} onClick={() => void salvarEdicao()}>
                {saving ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
