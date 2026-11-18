import { ChangeEvent, useState } from "react";

import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { copyToClipboard } from "@/lib/clipboard";
import {
  getApiError,
  navegarArquivosCompartilhados,
  uploadArquivosCompartilhados,
  type ItemCompartilhado,
} from "@/services/atlasApi";

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function ArquivosImportacao() {
  const [files, setFiles] = useState<File[]>([]);
  const [caminhoDestino, setCaminhoDestino] = useState("");
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<ItemCompartilhado[]>([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  const [returningPath, setReturningPath] = useState(false);
  const [busyPath, setBusyPath] = useState("");
  const [copyingPath, setCopyingPath] = useState("");
  const [consultado, setConsultado] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files || []));
  }

  function resolverCaminhoPosUpload(caminhoRetornado: string, caminhoAtual: string) {
    const valor = (caminhoRetornado || "").trim();
    if (valor.startsWith("//") || valor.startsWith("\\\\")) {
      return valor;
    }
    return caminhoAtual;
  }

  function possuiCaminhoMinimo(caminho: string) {
    const valor = (caminho || "").trim().replace(/\\/g, "/");
    if (!valor.startsWith("//")) {
      return false;
    }
    return valor.slice(2).split("/").filter(Boolean).length >= 1;
  }

  function obterCaminhoPai(caminho: string) {
    const valor = (caminho || "").trim().replace(/\\/g, "/");
    if (!valor) {
      return "";
    }

    if (valor.startsWith("//")) {
      const partes = valor.slice(2).split("/").filter(Boolean);
      if (partes.length <= 1) {
        return "";
      }
      return `//${partes.slice(0, -1).join("/")}`;
    }

    const partes = valor.split("/").filter(Boolean);
    if (partes.length <= 1) {
      return "";
    }
    return partes.slice(0, -1).join("/");
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

  async function carregarConteudo(caminho: string, fallbackMessage: string) {
    const data = await navegarArquivosCompartilhados(caminho);
    setItems(data.itens);
    setCaminhoDestino(data.caminho_atual);
    setConsultado(data.caminho_atual);
    return data;
  }

  async function handleUpload() {
    if (!files.length) {
      setFeedback({ type: "danger", message: "Selecione ao menos um arquivo para importar." });
      return;
    }
    if (!possuiCaminhoMinimo(caminhoDestino)) {
      setFeedback({ type: "danger", message: "Informe ao menos o caminho base no formato //servidor para importar arquivos." });
      return;
    }

    setUploading(true);
    setFeedback(null);
    try {
      const data = await uploadArquivosCompartilhados(files, caminhoDestino);
      const caminhoAtualizado = resolverCaminhoPosUpload(data.caminho_destino, caminhoDestino);
      setFiles([]);
      await carregarConteudo(caminhoAtualizado, "Falha ao atualizar a pasta após a importação.");
      setFeedback({ type: "success", message: data.mensagem });
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao importar arquivos.") });
    } finally {
      setUploading(false);
    }
  }

  async function handleConsultarPasta() {
    if (!possuiCaminhoMinimo(caminhoDestino)) {
      setFeedback({ type: "danger", message: "Informe ao menos o caminho base no formato //servidor para buscar pastas." });
      return;
    }
    setLoadingBrowse(true);
    setFeedback(null);
    try {
      await carregarConteudo(caminhoDestino, "Falha ao navegar nas pastas.");
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao navegar nas pastas.") });
    } finally {
      setLoadingBrowse(false);
    }
  }

  async function handleAbrirPasta(item: ItemCompartilhado) {
    setBusyPath(item.caminho);
    setLoadingBrowse(true);
    setFeedback(null);
    try {
      await carregarConteudo(item.caminho, "Falha ao abrir pasta.");
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao abrir a pasta.") });
    } finally {
      setBusyPath("");
      setLoadingBrowse(false);
    }
  }

  async function handleVoltarPasta() {
    const caminhoPai = obterCaminhoPai(consultado || caminhoDestino);
    if (!caminhoPai) {
      return;
    }

    setReturningPath(true);
    setLoadingBrowse(true);
    setFeedback(null);
    try {
      await carregarConteudo(caminhoPai, "Falha ao voltar pasta.");
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao voltar para a pasta anterior.") });
    } finally {
      setReturningPath(false);
      setLoadingBrowse(false);
    }
  }

  async function handleCopiarCaminho(item: ItemCompartilhado) {
    setCopyingPath(item.caminho);
    setFeedback(null);
    try {
      await copiarTexto(item.caminho);
      setFeedback({ type: "success", message: "Caminho copiado com sucesso." });
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao copiar caminho.") });
    } finally {
      setCopyingPath("");
    }
  }

  const caminhoPai = obterCaminhoPai(consultado || caminhoDestino);
  const caminhoDestinoValido = possuiCaminhoMinimo(caminhoDestino);

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Importação concluída" errorTitle="Falha na importação" />
      <PageHeader
        eyebrow="Arquivos"
        title="Importação"
        description="Informe o caminho completo de destino. A busca de pastas e a importação funcionam apenas nos servidores 10.0.0.64, 10.0.0.71 e 10.0.0.72. Se apontar para uma pasta, o sistema envia os arquivos com o nome original. Se apontar para um arquivo, envie apenas um item e o nome informado será respeitado."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Upload</p>
            <h2>Enviar arquivos para um caminho específico</h2>
          </div>
        </div>
        <div className="inline-form inline-form--file">
          <label className="field field--grow">
            <span>Selecionar arquivos</span>
            <input type="file" multiple onChange={handleFilesChange} />
          </label>
          <button className="button" type="button" disabled={uploading || !files.length || !caminhoDestinoValido} onClick={() => void handleUpload()}>
            {uploading ? "Enviando..." : "Importar arquivos"}
          </button>
          <label className="field field--grow">
            <span>Caminho completo de destino</span>
            <input
              value={caminhoDestino}
              onChange={(event) => setCaminhoDestino(event.target.value)}
              placeholder="Ex.: \\servidor\\share\\pasta\arquivo.txt"
            />
          </label>
          <div className="arquivos-path-actions">
            <button className="button button--secondary" type="button" disabled={loadingBrowse || !caminhoPai} onClick={() => void handleVoltarPasta()}>
              {returningPath ? "Voltando..." : "Voltar pasta"}
            </button>
            <button className="button" type="button" disabled={loadingBrowse || !caminhoDestinoValido} onClick={() => void handleConsultarPasta()}>
              {loadingBrowse && !returningPath ? "Buscando..." : "Buscar pasta"}
            </button>
          </div>
        </div>
        <p className="muted">
          Melhor fluxo: use caminho de pasta para upload de vários arquivos. Use caminho de arquivo somente quando precisar subir um único arquivo com nome exato. A busca e a importação funcionam apenas nos servidores 10.0.0.64, 10.0.0.71 e 10.0.0.72.
        </p>
      </section>

      <DataTable
        className="arquivos-importacao-table"
        title={`Conteúdo do destino${consultado ? ` - ${consultado}` : ""}`}
        exportFileName="conteudo-importacao.csv"
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
              <span className="arquivos-importacao-table__name" title={row.nome}>
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
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={loadingBrowse}
                    onClick={() => void handleAbrirPasta(row)}
                  >
                    {busyPath === row.caminho ? "Abrindo..." : "Abrir pasta"}
                  </button>
                ) : null}
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
