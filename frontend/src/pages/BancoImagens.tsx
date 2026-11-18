import { ChangeEvent, useEffect, useState } from "react";

import Modal from "@/components/modals/Modal";
import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import {
  excluirImagem,
  getApiError,
  listarImagens,
  moverImagem,
  uploadImagens,
  type ArquivoImagem,
} from "@/services/atlasApi";

export default function BancoImagens() {
  const NEW_FOLDER_OPTION = "__nova_pasta__";
  const ALL_FOLDERS = "__todas__";
  const ROOT_FOLDER = "__geral__";
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<ArquivoImagem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyFile, setBusyFile] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [viewFolder, setViewFolder] = useState(ROOT_FOLDER);
  const [movingItem, setMovingItem] = useState<ArquivoImagem | null>(null);
  const [moveSelectedFolder, setMoveSelectedFolder] = useState("");
  const [moveNewFolder, setMoveNewFolder] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await listarImagens();
      setItems(data.arquivos);
      setError("");
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao listar arquivos."));
    } finally {
      setLoading(false);
    }
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files || []));
  }

  const folderOptions = Array.from(
    new Set(items.map((item) => item.pasta).filter((folder) => folder.trim().length > 0)),
  ).sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
  const availableFolders = [ROOT_FOLDER, ...folderOptions];
  const folderColumns = Math.min(4, Math.max(1, availableFolders.length));
  const currentFolderItems = items.filter((item) => {
    if (viewFolder === ALL_FOLDERS) return true;
    return viewFolder === ROOT_FOLDER ? !item.pasta : item.pasta === viewFolder;
  });
  const isNewFolderSelected = selectedFolder === NEW_FOLDER_OPTION;
  const canSubmit = files.length > 0 && (!isNewFolderSelected || newFolder.trim().length > 0);
  const isMoveNewFolderSelected = moveSelectedFolder === NEW_FOLDER_OPTION;
  const moveDestination = isMoveNewFolderSelected ? moveNewFolder.trim() : moveSelectedFolder;
  const canConfirmMove = Boolean(movingItem) && moveDestination !== (movingItem?.pasta || "");

  useEffect(() => {
    if (!availableFolders.includes(viewFolder)) {
      setViewFolder(ALL_FOLDERS);
    }
  }, [availableFolders, viewFolder]);

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);
    setMessage("");
    setError("");
    try {
      const pastaDestino = selectedFolder === NEW_FOLDER_OPTION ? newFolder.trim() : selectedFolder;
      const data = await uploadImagens(files, pastaDestino);
      setItems(data.arquivos);
      setFiles([]);
      setMessage(data.mensagem);
      setSelectedFolder("");
      setNewFolder("");
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao enviar arquivos."));
    } finally {
      setUploading(false);
    }
  }

  async function handleAction(caminhoArquivo: string) {
    setBusyFile(caminhoArquivo);
    setMessage("");
    setError("");
    try {
      const data = await excluirImagem(caminhoArquivo);
      setItems(data.arquivos);
      setMessage(data.mensagem);
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao excluir arquivo."));
    } finally {
      setBusyFile("");
    }
  }

  function openMoveModal(row: ArquivoImagem) {
    setMovingItem(row);
    setMoveSelectedFolder(row.pasta || ROOT_FOLDER);
    setMoveNewFolder("");
  }

  function closeMoveModal() {
    if (busyFile) return;
    setMovingItem(null);
    setMoveSelectedFolder("");
    setMoveNewFolder("");
  }

  async function handleMoveConfirm() {
    if (!movingItem || !canConfirmMove) return;
    const atual = movingItem.pasta || "Geral";
    setBusyFile(movingItem.caminho_arquivo);
    setMessage("");
    setError("");
    try {
      const data = await moverImagem(movingItem.caminho_arquivo, moveDestination === ROOT_FOLDER ? "" : moveDestination);
      setItems(data.arquivos);
      setMessage(`${data.mensagem} Pasta anterior: ${atual}.`);
      setMovingItem(null);
      setMoveSelectedFolder("");
      setMoveNewFolder("");
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao mover arquivo."));
    } finally {
      setBusyFile("");
    }
  }

  return (
    <div className="stack-lg">
      <FeedbackToastBridge successMessage={message} errorMessage={error} successTitle="Operacao concluida" errorTitle="Falha no banco de imagens" />
      <PageHeader
        eyebrow="Midia corporativa"
        title="Banco de imagens"
        description="Centralize ativos visuais e organize arquivos para uso rapido nas operacoes."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Upload</p>
            <h2>Envie novos arquivos</h2>
          </div>
        </div>
        <div className="inline-form inline-form--file">
          <label className="field field--grow">
            <span>Selecionar arquivos</span>
            <input type="file" multiple onChange={handleFilesChange} />
          </label>
          <label className="field field--grow">
            <span>Pasta de destino</span>
            <select
              value={selectedFolder}
              onChange={(event) => {
                setSelectedFolder(event.target.value);
                if (event.target.value !== NEW_FOLDER_OPTION) {
                  setNewFolder("");
                }
              }}
            >
              <option value="">Geral</option>
              {folderOptions.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
              <option value={NEW_FOLDER_OPTION}>Nova pasta</option>
            </select>
          </label>
          {isNewFolderSelected ? (
            <>
              <label className="field field--grow">
                <span>Nome da nova pasta</span>
                <input
                  type="text"
                  value={newFolder}
                  onChange={(event) => setNewFolder(event.target.value)}
                  placeholder="Ex.: campanhas/2026"
                />
              </label>
              <button className="button" type="button" disabled={uploading || !canSubmit} onClick={handleUpload}>
                {uploading ? "Enviando..." : "Enviar arquivos"}
              </button>
            </>
          ) : null}
          {!isNewFolderSelected ? (
            <div className="field field--full">
              <button className="button" type="button" disabled={uploading || !canSubmit} onClick={handleUpload}>
                {uploading ? "Enviando..." : "Enviar arquivos"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Acervo</p>
            <h3>Gerencie arquivos disponiveis</h3>
          </div>
        </div>
        {loading ? (
          <div className="page-loader">Carregando arquivos...</div>
        ) : (
          <div className="stack-lg">
            <div className="field">
              <span>Pastas</span>
              <button
                className={`button folder-grid__button ${viewFolder === ALL_FOLDERS ? "button--secondary" : "button--ghost-neutral"}`}
                type="button"
                onClick={() => setViewFolder(ALL_FOLDERS)}
              >
                Todos ({items.length})
              </button>
              <div className="folder-grid" style={{ gridTemplateColumns: `repeat(${folderColumns}, minmax(0, 1fr))` }}>
                {availableFolders.map((folder) => {
                  const label = folder === ROOT_FOLDER ? "Geral" : folder;
                  const count = items.filter((item) => (folder === ROOT_FOLDER ? !item.pasta : item.pasta === folder)).length;
                  return (
                    <button
                      key={folder}
                      className={`button folder-grid__button ${viewFolder === folder ? "button--secondary" : "button--ghost-neutral"}`}
                      type="button"
                      onClick={() => setViewFolder(folder)}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <DataTable
              className="banco-imagens-table"
              title={`Biblioteca de arquivos${viewFolder === ALL_FOLDERS ? " - Todos" : viewFolder === ROOT_FOLDER ? " - Geral" : ` - ${viewFolder}`}`}
              exportFileName="banco-imagens.csv"
              data={currentFolderItems}
              columns={[
                { id: "nome", title: "Nome", accessor: (row) => row.nome, sortable: true },
                { id: "extensao", title: "Extensao", accessor: (row) => row.extensao, sortable: true },
                ...(viewFolder === ALL_FOLDERS
                  ? [{ id: "pasta", title: "Pasta", accessor: (row: ArquivoImagem) => row.pasta || "Geral", sortable: true }]
                  : []),
                { id: "data", title: "Atualizacao", accessor: (row) => row.data_modificacao, sortable: true },
                {
                  id: "acoes",
                  title: "Acoes",
                  accessor: (row) => row.caminho_arquivo,
                  align: "right",
                  headerClassName: "banco-imagens__acoes-header",
                  render: (row) => {
                    const url = row.url_publica || `https://api.empresa.example/imagens/${encodeURI(row.caminho_arquivo)}`;
                    return (
                      <div className="table-actions">
                        <a className="button button--link" href={url} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                        <button className="button button--ghost-neutral" type="button" disabled={busyFile === row.caminho_arquivo} onClick={() => openMoveModal(row)}>
                          Pasta
                        </button>
                        <button className="button button--danger" type="button" disabled={busyFile === row.caminho_arquivo} onClick={() => handleAction(row.caminho_arquivo)}>
                          Excluir
                        </button>
                      </div>
                    );
                  },
                },
              ]}
            />
          </div>
        )}
      </section>

      <Modal
        open={Boolean(movingItem)}
        title="Mover imagem"
        description={movingItem ? `Defina a nova pasta de ${movingItem.nome}${movingItem.extensao} e reorganize o acervo.` : undefined}
        onClose={closeMoveModal}
      >
        {movingItem ? (
          <div className="stack-md">
            <label className="field">
              <span>Pasta de destino</span>
              <select
                value={moveSelectedFolder}
                onChange={(event) => {
                  setMoveSelectedFolder(event.target.value);
                  if (event.target.value !== NEW_FOLDER_OPTION) {
                    setMoveNewFolder("");
                  }
                }}
              >
                <option value={ROOT_FOLDER}>Geral</option>
                {folderOptions
                  .filter((folder) => folder !== movingItem.pasta)
                  .map((folder) => (
                    <option key={folder} value={folder}>
                      {folder}
                    </option>
                  ))}
                <option value={NEW_FOLDER_OPTION}>Nova pasta</option>
              </select>
            </label>

            {isMoveNewFolderSelected ? (
              <label className="field">
                <span>Nome da nova pasta</span>
                <input
                  type="text"
                  value={moveNewFolder}
                  onChange={(event) => setMoveNewFolder(event.target.value)}
                  placeholder="Ex.: campanhas/2026"
                />
              </label>
            ) : null}

            <div className="table-actions">
              <button className="button button--ghost-neutral" type="button" onClick={closeMoveModal} disabled={Boolean(busyFile)}>
                Cancelar
              </button>
              <button className="button" type="button" onClick={handleMoveConfirm} disabled={Boolean(busyFile) || !canConfirmMove}>
                {busyFile === movingItem.caminho_arquivo ? "Movendo..." : "Salvar pasta"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
