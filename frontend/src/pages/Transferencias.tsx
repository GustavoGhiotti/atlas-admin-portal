import { useEffect, useMemo, useState } from "react";

import DataTable from "@/components/tables/DataTable";
import Modal from "@/components/modals/Modal";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import {
  alterarTransferenciaMapaAtivo,
  listarTransferenciaMapas,
  obterTransferenciaMetadados,
  salvarTransferenciaMapa,
  type TransferenciaCedente,
  type TransferenciaColuna,
  type TransferenciaMapa,
} from "@/services/atlasApi";

// A tela nao conhece as colunas de TB_ARQUIVO_MAPA: ela recebe a lista do backend
// (metadados) e monta grid + formulario a partir dela. Adicionar uma coluna no robo
// (ex.: NOTIFICACAO) faz o campo surgir aqui sozinho, com o widget certo pelo tipo.

const NOME_ID = "ID";
const NOME_CEDENTE = "ID_CEDENTE";
const NOME_ORIGEM = "ORIGEM";
const NOME_DESTINO = "DESTINO";
const NOME_PADRAO = "PADRAO_ARQUIVO";
const NOME_ATIVO = "ATIVO";

// Celula que trunca com reticencias e mostra o texto completo no hover (title).
// Deixa Origem/Destino/arquivo caberem em largura fixa, sem estourar a tabela.
function celulaElipse(valor: unknown) {
  const texto = valor === null || valor === undefined || valor === "" ? "—" : String(valor);
  return (
    <span className="cell-elipse" title={texto}>
      {texto}
    </span>
  );
}

// O grid usa o DataTable padrao (faixa de cabecalho + divisorias) e mostra so 3
// colunas curtas. O registro completo (todas as colunas, inclusive as novas do robo)
// fica no modal de Novo/Editar.
type FormState = Record<string, unknown>;

function valorInicial(coluna: TransferenciaColuna): unknown {
  if (coluna.tipo === "toggle") {
    return coluna.valor_padrao ?? false;
  }
  return "";
}

function montarFormNovo(colunas: TransferenciaColuna[]): FormState {
  const estado: FormState = {};
  for (const coluna of colunas) {
    if (coluna.somente_leitura) continue;
    estado[coluna.nome] = valorInicial(coluna);
  }
  return estado;
}

function montarFormEdicao(colunas: TransferenciaColuna[], linha: TransferenciaMapa): FormState {
  const estado: FormState = { [NOME_ID]: linha[NOME_ID] };
  for (const coluna of colunas) {
    if (coluna.somente_leitura) continue;
    const bruto = linha[coluna.nome];
    if (coluna.tipo === "toggle") {
      estado[coluna.nome] = Boolean(bruto);
    } else {
      estado[coluna.nome] = bruto ?? "";
    }
  }
  return estado;
}

export default function Transferencias() {
  const [colunas, setColunas] = useState<TransferenciaColuna[]>([]);
  const [cedentes, setCedentes] = useState<TransferenciaCedente[]>([]);
  const [mapas, setMapas] = useState<TransferenciaMapa[]>([]);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [alterandoId, setAlterandoId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormState | null>(null);
  const editandoId = form?.[NOME_ID] as number | undefined;

  const cedentesPorId = useMemo(
    () => new Map(cedentes.map((c) => [c.id_cedente, c.nm_cedente])),
    [cedentes],
  );

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    try {
      setLoading(true);
      setError("");
      const [meta, itens] = await Promise.all([
        obterTransferenciaMetadados(),
        listarTransferenciaMapas(),
      ]);
      setColunas(meta.colunas);
      setCedentes(meta.cedentes);
      setMapas(itens);
    } catch {
      setError("Não foi possível carregar os mapas de transferência.");
    } finally {
      setLoading(false);
    }
  }

  function abrirNovo() {
    setMessage("");
    setError("");
    setForm(montarFormNovo(colunas));
  }

  function abrirEdicao(linha: TransferenciaMapa) {
    setMessage("");
    setError("");
    setForm(montarFormEdicao(colunas, linha));
  }

  function fecharModal() {
    setForm(null);
  }

  function atualizarCampo(nome: string, valor: unknown) {
    setForm((atual) => (atual ? { ...atual, [nome]: valor } : atual));
  }

  async function handleSalvar() {
    if (!form) return;
    try {
      setSalvando(true);
      setError("");
      setMessage("");
      await salvarTransferenciaMapa(form);
      setMessage(editandoId ? "Mapa atualizado com sucesso." : "Mapa criado com sucesso.");
      fecharModal();
      await carregar();
    } catch (erro) {
      setError(mensagemErro(erro, "Não foi possível salvar o mapa."));
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleAtivo(linha: TransferenciaMapa) {
    const id = Number(linha[NOME_ID]);
    const proximo = !linha[NOME_ATIVO];
    try {
      setAlterandoId(id);
      setError("");
      setMessage("");
      await alterarTransferenciaMapaAtivo(id, proximo);
      setMapas((atual) =>
        atual.map((item) => (Number(item[NOME_ID]) === id ? { ...item, [NOME_ATIVO]: proximo } : item)),
      );
      setMessage(proximo ? "Mapa ativado." : "Mapa desativado.");
    } catch (erro) {
      setError(mensagemErro(erro, "Não foi possível alterar a situação."));
    } finally {
      setAlterandoId(null);
    }
  }

  const temAtivo = colunas.some((c) => c.nome === NOME_ATIVO);
  const camposEditaveis = colunas.filter((c) => !c.somente_leitura);

  return (
    <div className="stack-lg">
      {/* Larguras fixas + reticencias fazem a tabela caber sem scroll horizontal:
          Origem/Destino/arquivo truncam e mostram o texto completo no hover. Tambem
          centraliza os titulos (o DataTable so centraliza a celula, nao o botao de
          ordenacao do <th>). */}
      <style>{`
        .transferencia-table .table { table-layout: fixed; width: 100%; }
        .transferencia-table .table th,
        .transferencia-table .table td { overflow: hidden; }
        .transferencia-table .table__sort { text-align: center; justify-content: center; }
        .transferencia-table .cell-elipse {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .transferencia-table .table th:nth-child(1),
        .transferencia-table .table td:nth-child(1) { width: 22%; }
        .transferencia-table .table th:nth-child(2),
        .transferencia-table .table td:nth-child(2) { width: 23%; }
        .transferencia-table .table th:nth-child(3),
        .transferencia-table .table td:nth-child(3) { width: 23%; }
        .transferencia-table .table th:nth-child(4),
        .transferencia-table .table td:nth-child(4) { width: 17%; }
        .transferencia-table .table th:nth-child(5),
        .transferencia-table .table td:nth-child(5) { width: 15%; overflow: visible; }
        .transferencia-table .table-actions--center {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 6px;
        }
        .transferencia-table .table-actions--center .button { padding: 4px 10px; font-size: 12px; }
      `}</style>

      <FeedbackToastBridge
        successMessage={message}
        errorMessage={error}
        successTitle="Operação concluída"
        errorTitle="Falha na Transferência"
      />

      <PageHeader
        eyebrow="Arquivos"
        title="Transferência"
        description="Configure os mapas do robô de organização de arquivos (origem → destino por cedente). As colunas são lidas direto da tabela, então novos campos aparecem aqui automaticamente."
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Mapas de transferência</p>
            <h2>TB_ARQUIVO_MAPA</h2>
          </div>
          <div className="panel__actions">
            <button className="button button--ghost-neutral" type="button" onClick={() => void carregar()} disabled={loading}>
              Atualizar
            </button>
            <button className="button" type="button" onClick={abrirNovo} disabled={loading || colunas.length === 0}>
              Novo mapa
            </button>
          </div>
        </div>

        <DataTable
          className="transferencia-table"
          data={mapas}
          carregando={loading}
          pageSize={10}
          initialSortColumn="cedente"
          initialSortDirection="asc"
          exportFileName="transferencia-mapas.csv"
          searchPlaceholder="Buscar por cedente ou nome do arquivo"
          emptyMessage="Nenhum mapa cadastrado ainda. Clique em “Novo mapa” para começar."
          columns={[
            {
              id: "cedente",
              title: "Cedente",
              accessor: (linha) => {
                const nome = (linha.nm_cedente as string) || cedentesPorId.get(Number(linha[NOME_CEDENTE])) || "";
                const id = linha[NOME_CEDENTE];
                return nome ? `${nome} (${id})` : String(id ?? "—");
              },
              sortable: true,
              align: "center",
              render: (linha) => {
                const nome = (linha.nm_cedente as string) || cedentesPorId.get(Number(linha[NOME_CEDENTE])) || "";
                const id = linha[NOME_CEDENTE];
                return celulaElipse(nome ? `${nome} (${id})` : id);
              },
            },
            {
              id: "origem",
              title: "Origem",
              accessor: (linha) => String(linha[NOME_ORIGEM] ?? ""),
              sortable: true,
              align: "center",
              render: (linha) => celulaElipse(linha[NOME_ORIGEM]),
            },
            {
              id: "destino",
              title: "Destino",
              accessor: (linha) => String(linha[NOME_DESTINO] ?? ""),
              sortable: true,
              align: "center",
              render: (linha) => celulaElipse(linha[NOME_DESTINO]),
            },
            {
              id: "arquivo",
              title: "Nome do arquivo",
              accessor: (linha) => String(linha[NOME_PADRAO] ?? ""),
              sortable: true,
              align: "center",
              render: (linha) => celulaElipse(linha[NOME_PADRAO]),
            },
            {
              id: "acoes",
              title: "Ações",
              accessor: (linha) => Number(linha[NOME_ID]),
              align: "center",
              render: (linha) => {
                const id = Number(linha[NOME_ID]);
                const ativo = Boolean(linha[NOME_ATIVO]);
                return (
                  <div className="table-actions table-actions--center">
                    <button className="button button--secondary" type="button" onClick={() => abrirEdicao(linha)}>
                      Editar
                    </button>
                    {temAtivo ? (
                      <button
                        className="button button--ghost-neutral"
                        type="button"
                        disabled={alterandoId === id}
                        onClick={() => void handleToggleAtivo(linha)}
                      >
                        {alterandoId === id ? "..." : ativo ? "Desativar" : "Ativar"}
                      </button>
                    ) : null}
                  </div>
                );
              },
            },
          ]}
        />
      </section>

      <Modal
        open={form !== null}
        className="modal--wide"
        onClose={fecharModal}
        title={editandoId ? `Editar mapa #${editandoId}` : "Novo mapa"}
        description="O cedente vem da TB_CONEXAO_SFTP. Campos são gerados a partir das colunas da tabela."
      >
        {form ? (
          <form
            className="stack-md"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSalvar();
            }}
          >
            <section className="surface-card surface-card--compact">
              <div className="form-grid form-grid--two">
                {camposEditaveis.map((coluna) => (
                  <CampoDinamico
                    key={coluna.nome}
                    coluna={coluna}
                    valor={form[coluna.nome]}
                    cedentes={cedentes}
                    onChange={(valor) => atualizarCampo(coluna.nome, valor)}
                  />
                ))}
              </div>
            </section>

            <div className="form-footer">
              <button className="button button--ghost-neutral" type="button" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button className="button" type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

type CampoDinamicoProps = {
  coluna: TransferenciaColuna;
  valor: unknown;
  cedentes: TransferenciaCedente[];
  onChange: (valor: unknown) => void;
};

function CampoDinamico({ coluna, valor, cedentes, onChange }: CampoDinamicoProps) {
  const largo = coluna.tipo === "textolongo";
  const titulo = (
    <span>
      {coluna.label}
      {coluna.obrigatorio ? " *" : ""}
    </span>
  );

  if (coluna.tipo === "toggle") {
    return (
      <label className="field">
        {titulo}
        <select value={valor ? "1" : "0"} onChange={(e) => onChange(e.target.value === "1")}>
          <option value="1">Sim</option>
          <option value="0">Não</option>
        </select>
      </label>
    );
  }

  return (
    <label className={`field${largo ? " field--full" : ""}`}>
      {titulo}

      {coluna.tipo === "cedente" ? (
        <select value={String(valor ?? "")} required={coluna.obrigatorio} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione um cedente...</option>
          {cedentes.map((c) => (
            <option key={c.id_cedente} value={c.id_cedente}>
              {c.nm_cedente} ({c.id_cedente})
            </option>
          ))}
        </select>
      ) : coluna.tipo === "textolongo" ? (
        <textarea rows={2} value={String(valor ?? "")} required={coluna.obrigatorio} onChange={(e) => onChange(e.target.value)} />
      ) : coluna.tipo === "numero" || coluna.tipo === "decimal" ? (
        <input
          type="number"
          step={coluna.tipo === "decimal" ? "any" : "1"}
          value={valor === null || valor === undefined ? "" : String(valor)}
          required={coluna.obrigatorio}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : coluna.tipo === "data" ? (
        <input type="date" value={String(valor ?? "").slice(0, 10)} required={coluna.obrigatorio} onChange={(e) => onChange(e.target.value)} />
      ) : coluna.tipo === "datahora" ? (
        <input type="datetime-local" value={String(valor ?? "").slice(0, 16)} required={coluna.obrigatorio} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type="text"
          value={String(valor ?? "")}
          maxLength={coluna.max_length ?? undefined}
          required={coluna.obrigatorio}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function mensagemErro(erro: unknown, fallback: string): string {
  const resposta = (erro as { response?: { data?: { mensagem?: string; detail?: string } } })?.response?.data;
  return resposta?.mensagem || resposta?.detail || fallback;
}
