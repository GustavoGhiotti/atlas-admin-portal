import { FormEvent, useEffect, useState } from "react";
import type { CSSProperties } from "react";

import {
  ArquivoImagem,
  excluirImagem,
  listarImagens,
  uploadImagens,
} from "@/services/atlasApi";

type ImageBankPanelProps = {
  onResult: (value: unknown) => void;
};

export default function ImageBankPanel({ onResult }: ImageBankPanelProps) {
  const NEW_FOLDER_OPTION = "__nova_pasta__";
  const [arquivos, setArquivos] = useState<ArquivoImagem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pastaDestino, setPastaDestino] = useState("");
  const [novaPasta, setNovaPasta] = useState("");

  async function carregarLista() {
    setLoading(true);
    try {
      const data = await listarImagens();
      setArquivos(data.arquivos ?? []);
      onResult(data);
    } catch (error: any) {
      onResult(error.response?.data ?? { mensagem: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarLista();
  }, []);

  const folderOptions = Array.from(
    new Set(arquivos.map((arquivo) => arquivo.pasta).filter((folder) => folder.trim().length > 0)),
  ).sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("arquivos") as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) {
      onResult("Selecione ao menos um arquivo.");
      return;
    }

    try {
      const destino = pastaDestino === NEW_FOLDER_OPTION ? novaPasta.trim() : pastaDestino;
      const data = await uploadImagens(files, destino);
      onResult(data);
      input.value = "";
      setPastaDestino("");
      setNovaPasta("");
      await carregarLista();
    } catch (error: any) {
      onResult(error.response?.data ?? { mensagem: error.message });
    }
  }

  async function handleDelete(nomeArquivo: string) {
    try {
      const data = await excluirImagem(nomeArquivo);
      onResult(data);
      await carregarLista();
    } catch (error: any) {
      onResult(error.response?.data ?? { mensagem: error.message });
    }
  }

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Modulo</p>
          <h2 style={styles.title}>Banco de imagens</h2>
        </div>
        <button style={styles.secondaryButton} onClick={carregarLista} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar lista"}
        </button>
      </div>

      <form onSubmit={handleUpload} style={styles.form}>
        <label style={styles.label}>
          <span>Selecionar imagens</span>
          <input style={styles.input} type="file" name="arquivos" multiple />
        </label>
        <label style={styles.label}>
          <span>Pasta de destino</span>
          <select
            style={styles.input}
            value={pastaDestino}
            onChange={(event) => {
              setPastaDestino(event.target.value);
              if (event.target.value !== NEW_FOLDER_OPTION) {
                setNovaPasta("");
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
        {pastaDestino === NEW_FOLDER_OPTION ? (
          <label style={styles.label}>
            <span>Nome da nova pasta</span>
            <input
              style={styles.input}
              type="text"
              value={novaPasta}
              onChange={(event) => setNovaPasta(event.target.value)}
              placeholder="Ex.: campanhas/2026"
            />
          </label>
        ) : null}
        <button style={styles.primaryButton} type="submit">
          Enviar arquivos
        </button>
      </form>

      <div style={styles.list}>
        {!arquivos.length && <div style={styles.empty}>Nenhum arquivo encontrado.</div>}
        {arquivos.map((arquivo) => {
          const fileName = `${arquivo.nome}${arquivo.extensao}`;
          return (
            <article key={arquivo.caminho_arquivo} style={styles.item}>
              <div style={styles.itemHeader}>
                <strong>{fileName}</strong>
                <span style={styles.badge}>OK</span>
              </div>
              <div style={styles.meta}>Pasta: {arquivo.pasta || "Geral"}</div>
              <div style={styles.meta}>Modificado em: {arquivo.data_modificacao}</div>
              <div style={styles.meta}>
                URL:
                {" "}
                {arquivo.url_publica ? (
                  <a href={arquivo.url_publica} target="_blank" rel="noreferrer">
                    {arquivo.url_publica}
                  </a>
                ) : (
                  "nao configurada"
                )}
              </div>
              <div style={styles.actions}>
                <button style={styles.dangerButton} onClick={() => handleDelete(arquivo.caminho_arquivo)} type="button">
                  Excluir
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: "#fffaf2",
    border: "1px solid #ddc9ab",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 20px 40px rgba(60, 38, 17, 0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  kicker: {
    margin: 0,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#ab4d28",
    fontWeight: 700,
  },
  title: {
    margin: "6px 0 0",
    fontSize: 28,
  },
  form: {
    display: "grid",
    gap: 12,
    marginBottom: 18,
  },
  label: {
    display: "grid",
    gap: 6,
    fontWeight: 600,
  },
  input: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid #d7c8ab",
    background: "#fff",
  },
  primaryButton: {
    border: 0,
    borderRadius: 999,
    padding: "12px 18px",
    background: "#ab4d28",
    color: "#fff7f0",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d7c8ab",
    borderRadius: 999,
    padding: "10px 16px",
    background: "#efe5d5",
    color: "#231a10",
    fontWeight: 700,
    cursor: "pointer",
  },
  dangerButton: {
    border: 0,
    borderRadius: 999,
    padding: "10px 16px",
    background: "#8c2323",
    color: "#fff7f0",
    fontWeight: 700,
    cursor: "pointer",
  },
  list: {
    display: "grid",
    gap: 12,
  },
  empty: {
    border: "1px dashed #d7c8ab",
    borderRadius: 18,
    padding: 16,
    color: "#6f604f",
  },
  item: {
    border: "1px solid #ddc9ab",
    borderRadius: 18,
    padding: 14,
    background: "#fff",
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: "#ece2d1",
    color: "#7a2f13",
  },
  meta: {
    color: "#6f604f",
    fontSize: 14,
    marginBottom: 6,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
  },
};
