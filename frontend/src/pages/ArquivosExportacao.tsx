import { useState } from "react";

import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import {
  baixarArquivoCompartilhado,
  getApiError,
  navegarArquivosCompartilhados,
  type ItemCompartilhado,
} from "@/services/atlasApi";

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function ArquivosExportacao() {
  const [caminho, setCaminho] = useState("");
  const [items, setItems] = useState<ItemCompartilhado[]>([]);
  const [loading, setLoading] = useState(false);
  const [returningPath, setReturningPath] = useState(false);
  const [busyPath, setBusyPath] = useState("");
  const [copyingPath, setCopyingPath] = useState("");
  const [consultado, setConsultado] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  function obterCaminhoPai(valor: string) {
    const caminhoAtual = (valor || "").trim().replace(/\\/g, "/");
    if (!caminhoAtual) {
      return "";
    }

    if (caminhoAtual.startsWith("//")) {
      const partes = caminhoAtual.slice(2).split("/").filter(Boolean);
      if (partes.length <= 1) {
        return "";
      }
      return `//${partes.slice(0, -1).join("/")}`;
    }

    const partes = caminhoAtual.split("/").filter(Boolean);
    if (partes.length <= 1) {
      return "";
    }
    return partes.slice(0, -1).join("/");
  }

  function possuiCaminhoMinimo(valor: string) {
    const caminhoAtual = (valor || "").trim().replace(/\\/g, "/");
    if (!caminhoAtual.startsWith("//")) {
      return false;
    }
    return caminhoAtual.slice(2).split("/").filter(Boolean).length >= 1;
  }

  async function copiarTexto(texto: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return;
    }

    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "true");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.focus();
    campo.select();

    const copiado = document.execCommand("copy");
    document.body.removeChild(campo);

    if (!copiado) {
      throw new Error("Não foi possível copiar o caminho.");
    }
  }

  async function handleConsultar() {
    if (!possuiCaminhoMinimo(caminho)) {
      setFeedback({ type: "danger", message: "Informe ao menos o caminho base no formato //servidor para consultar arquivos." });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const data = await navegarArquivosCompartilhados(caminho);
      setItems(data.itens);
      setConsultado(data.caminho_atual);
      setCaminho(data.caminho_atual);
      setFeedback({ type: "success", message: `${data.itens.length} item(ns) localizado(s).` });
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao consultar arquivos.") });
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(row: ItemCompartilhado) {
    setBusyPath(row.caminho);
    setFeedback(null);
    try {
      const blob = await baixarArquivoCompartilhado(row.caminho);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = row.nome;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao baixar arquivo.") });
    } finally {
      setBusyPath("");
    }
  }

  async function handleEntrar(item: ItemCompartilhado) {
    setBusyPath(item.caminho);
    setCaminho(item.caminho);
    setLoading(true);
    setFeedback(null);
    try {
      const data = await navegarArquivosCompartilhados(item.caminho);
      setItems(data.itens);
      setConsultado(data.caminho_atual);
      setCaminho(data.caminho_atual);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao abrir a pasta.") });
    } finally {
      setBusyPath("");
      setLoading(false);
    }
  }

  async function handleVoltarPasta() {
    const caminhoPai = obterCaminhoPai(consultado || caminho);
    if (!caminhoPai) {
      return;
    }

    setReturningPath(true);
    setLoading(true);
    setFeedback(null);
    try {
      const data = await navegarArquivosCompartilhados(caminhoPai);
      setItems(data.itens);
      setConsultado(data.caminho_atual);
      setCaminho(data.caminho_atual);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao voltar para a pasta anterior.") });
    } finally {
      setReturningPath(false);
      setLoading(false);
    }
  }

  async function handleCopiarCaminho(row: ItemCompartilhado) {
    setCopyingPath(row.caminho);
    setFeedback(null);
    try {
      await copiarTexto(row.caminho);
      setFeedback({ type: "success", message: "Caminho copiado com sucesso." });
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao copiar caminho.") });
    } finally {
      setCopyingPath("");
    }
  }

  const caminhoPai = obterCaminhoPai(consultado || caminho);
  const caminhoValido = possuiCaminhoMinimo(caminho);

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Consulta concluída" errorTitle="Falha em arquivos" />
      <PageHeader
        eyebrow="Arquivos"
        title="Exportação"
        description="Consulte por caminho completo de pasta ou de arquivo. A busca funciona apenas nos servidores 10.0.0.64, 10.0.0.71 e 10.0.0.72. Se informar uma pasta, a tela lista os arquivos encontrados. Se informar um arquivo, a consulta retorna somente esse item para download."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Consulta</p>
            <h2>Buscar arquivos por caminho</h2>
          </div>
        </div>
        <div className="inline-form">
          <label className="field field--grow">
            <span>Caminho completo da pasta ou arquivo</span>
            <input
              value={caminho}
              onChange={(event) => setCaminho(event.target.value)}
              placeholder="Ex.: \\servidor\share\pasta\arquivo.txt"
            />
          </label>
          <div className="arquivos-path-actions">
            <button className="button button--secondary" type="button" onClick={() => void handleVoltarPasta()} disabled={loading || !caminhoPai}>
              {returningPath ? "Voltando..." : "Voltar pasta"}
            </button>
            <button className="button" type="button" onClick={() => void handleConsultar()} disabled={loading || !caminhoValido}>
              {loading && !returningPath ? "Consultando..." : "Consultar arquivos"}
            </button>
          </div>
        </div>
        <p className="muted">
          Melhor fluxo: pesquise pela pasta quando quiser navegar e localizar vários arquivos. Informe o caminho do arquivo quando já souber exatamente qual item deseja baixar. A busca funciona apenas nos servidores 10.0.0.64, 10.0.0.71 e 10.0.0.72.
        </p>
      </section>

      <DataTable
        className="arquivos-exportacao-table"
        title={`Arquivos disponíveis${consultado ? ` - ${consultado}` : ""}`}
        exportFileName="arquivos-exportacao.csv"
        pageSize={12}
        searchPlaceholder="Buscar por nome ou caminho"
        data={items}
        columns={[
          {
            id: "nome",
            title: "Nome",
            accessor: (row) => row.nome,
            sortable: true,
            render: (row) => (
              <span className="arquivos-exportacao-table__name" title={row.nome}>
                {row.nome}
              </span>
            ),
          },
          { id: "tamanho", title: "Tamanho", accessor: (row) => (row.tamanho_bytes ? formatBytes(row.tamanho_bytes) : "-"), sortable: true },
          { id: "data", title: "Atualização", accessor: (row) => row.data_modificacao || "-", sortable: true },
          {
            id: "acoes",
            title: "Ação",
            accessor: (row) => row.caminho,
            align: "right",
            render: (row) => (
              <div className="table-actions">
                {row.tipo === "pasta" ? (
                  <button className="button button--secondary" type="button" disabled={loading || busyPath === row.caminho} onClick={() => void handleEntrar(row)}>
                    {busyPath === row.caminho ? "Abrindo..." : "Abrir pasta"}
                  </button>
                ) : (
                  <button className="button" type="button" disabled={busyPath === row.caminho} onClick={() => void handleDownload(row)}>
                    {busyPath === row.caminho ? "Baixando..." : "Download"}
                  </button>
                )}
                <button
                  className="button button--ghost-neutral"
                  type="button"
                  disabled={copyingPath === row.caminho}
                  onClick={() => void handleCopiarCaminho(row)}
                >
                  {copyingPath === row.caminho ? "Copiando..." : "Copiar caminho"}
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
