import { ChangeEvent, useEffect, useState } from "react";

import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import { copyToClipboard } from "@/lib/clipboard";
import {
  analisarDocumentoImportacaoBanco,
  analisarDocumentoImportacaoBancoBulk,
  getApiError,
  importarDocumentoImportacaoBanco,
  importarDocumentoImportacaoBancoBulk,
  inspecionarDocumentoImportacaoBanco,
  listarBancosImportacaoBanco,
  listarConfiguracaoImportacaoBanco,
  listarTabelasImportacaoBanco,
  type AnaliseImportacaoBanco,
  type BancoServidorOption,
  type ServidorBancoOption,
  type TabelaBanco,
} from "@/services/atlasApi";

type ModoImportacao = "tabela_existente" | "bulk";

export default function ArquivosImportacaoBanco() {
  const [modoImportacao, setModoImportacao] = useState<ModoImportacao>("bulk");
  const [servidores, setServidores] = useState<ServidorBancoOption[]>([]);
  const [bancos, setBancos] = useState<BancoServidorOption[]>([]);
  const [tabelas, setTabelas] = useState<TabelaBanco[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [servidor, setServidor] = useState("");
  const [banco, setBanco] = useState("");
  const [schemaNome, setSchemaNome] = useState("");
  const [tabelaNome, setTabelaNome] = useState("");
  const [abaNome, setAbaNome] = useState("");
  const [analise, setAnalise] = useState<AnaliseImportacaoBanco | null>(null);
  const [abasDisponiveis, setAbasDisponiveis] = useState<string[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copyingDestino, setCopyingDestino] = useState(false);
  const [destinoImportado, setDestinoImportado] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  useEffect(() => {
    void carregarConfiguracao();
  }, []);

  useEffect(() => {
    setAnalise(null);
    setDestinoImportado("");
    setBanco("");
    setBancos([]);
    setSchemaNome("");
    setTabelaNome("");
    setTabelas([]);

    if (!servidor) {
      return;
    }

    void carregarBancos(servidor);
  }, [servidor]);

  useEffect(() => {
    setAnalise(null);
    setDestinoImportado("");
    setSchemaNome("");
    setTabelaNome("");
    setTabelas([]);

    if (modoImportacao !== "tabela_existente" || !servidor || !banco) {
      return;
    }

    void carregarTabelas(servidor, banco);
  }, [servidor, banco, modoImportacao]);

  useEffect(() => {
    setAnalise(null);
    setDestinoImportado("");
    setTabelaNome("");
    setAbaNome("");
  }, [schemaNome]);

  useEffect(() => {
    setAnalise(null);
    setDestinoImportado("");
    setSchemaNome("");
    setTabelaNome("");
  }, [modoImportacao]);

  async function handleArquivoChange(event: ChangeEvent<HTMLInputElement>) {
    const arquivoSelecionado = event.target.files?.[0] ?? null;
    setAnalise(null);
    setDestinoImportado("");
    setAbaNome("");
    setAbasDisponiveis([]);
    setArquivo(arquivoSelecionado);

    if (!arquivoSelecionado || !arquivoSelecionado.name.toLowerCase().endsWith(".xlsx")) {
      return;
    }

    setLoadingSheets(true);
    setFeedback(null);
    try {
      const data = await inspecionarDocumentoImportacaoBanco(arquivoSelecionado);
      setAbasDisponiveis(data.abas_disponiveis);
      setAbaNome(data.aba_padrao || data.abas_disponiveis[0] || "");
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Não foi possível carregar as abas do arquivo Excel.") });
    } finally {
      setLoadingSheets(false);
    }
  }

  async function carregarConfiguracao() {
    setLoadingConfig(true);
    setFeedback(null);
    try {
      const data = await listarConfiguracaoImportacaoBanco();
      setServidores(data.servidores);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao carregar as configurações de importação SQL.") });
    } finally {
      setLoadingConfig(false);
    }
  }

  async function carregarBancos(servidorSelecionado: string) {
    setLoadingBanks(true);
    setFeedback(null);
    try {
      const data = await listarBancosImportacaoBanco(servidorSelecionado);
      setBancos(data.bancos);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao carregar os bancos do servidor selecionado.") });
    } finally {
      setLoadingBanks(false);
    }
  }

  async function carregarTabelas(servidorSelecionado: string, bancoSelecionado: string) {
    setLoadingTables(true);
    setFeedback(null);
    try {
      const data = await listarTabelasImportacaoBanco(servidorSelecionado, bancoSelecionado);
      setTabelas(data.tabelas);
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao carregar as tabelas do banco selecionado.") });
    } finally {
      setLoadingTables(false);
    }
  }

  async function handleAnalisar() {
    if (!arquivo) {
      setFeedback({ type: "danger", message: "Selecione um arquivo .xlsx, .csv ou .txt para analisar." });
      return;
    }
    if (!servidor || !banco) {
      setFeedback({ type: "danger", message: "Selecione servidor e banco antes de analisar." });
      return;
    }
    if (modoImportacao === "tabela_existente" && (!schemaNome || !tabelaNome)) {
      setFeedback({ type: "danger", message: "Selecione servidor, banco, schema e tabela antes de analisar." });
      return;
    }

    setAnalyzing(true);
    setFeedback(null);
    try {
      const data =
        modoImportacao === "tabela_existente"
          ? await analisarDocumentoImportacaoBanco({
              arquivo,
              servidor,
              banco,
              schema_nome: schemaNome,
              tabela_nome: tabelaNome,
              aba_nome: abaNome || undefined,
            })
          : await analisarDocumentoImportacaoBancoBulk({
              arquivo,
              servidor,
              banco,
              aba_nome: abaNome || undefined,
            });

      setAnalise(data);
      setAbasDisponiveis(data.abas_disponiveis);
      setAbaNome(data.aba_selecionada || "");
      setFeedback({
        type: data.pode_importar ? "success" : "danger",
        message: data.mensagem,
      });
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao analisar o documento.") });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleImportar() {
    if (!arquivo) {
      setFeedback({ type: "danger", message: "Selecione um arquivo antes de importar." });
      return;
    }
    if (!servidor || !banco) {
      setFeedback({ type: "danger", message: "Selecione servidor e banco antes de importar." });
      return;
    }
    if (modoImportacao === "tabela_existente" && (!schemaNome || !tabelaNome)) {
      setFeedback({ type: "danger", message: "Selecione servidor, banco, schema e tabela antes de importar." });
      return;
    }
    if (!analise?.pode_importar) {
      setFeedback({ type: "danger", message: "A estrutura do documento ainda não foi validada para importação." });
      return;
    }

    setImporting(true);
    setFeedback(null);
    try {
      const data =
        modoImportacao === "tabela_existente"
          ? await importarDocumentoImportacaoBanco({
              arquivo,
              servidor,
              banco,
              schema_nome: schemaNome,
              tabela_nome: tabelaNome,
              aba_nome: abaNome || undefined,
            })
          : await importarDocumentoImportacaoBancoBulk({
              arquivo,
              servidor,
              banco,
              aba_nome: abaNome || undefined,
            });

      const destinoGerado =
        banco && data.schema_destino && data.tabela_destino
          ? `[${banco}].[${data.schema_destino}].[${data.tabela_destino}]`
          : "";

      setDestinoImportado(destinoGerado);
      setFeedback({ type: "success", message: data.mensagem });
      setAnalise((current) =>
        current
          ? {
              ...current,
              modo_importacao: data.modo_importacao ?? current.modo_importacao,
              schema_destino: data.schema_destino ?? current.schema_destino,
              tabela_destino: data.tabela_destino ?? current.tabela_destino,
            }
          : current,
      );
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Não foi possível importar o documento na tabela SQL.") });
    } finally {
      setImporting(false);
    }
  }

  async function handleCopiarDestino() {
    if (!destinoImportado) {
      return;
    }

    setCopyingDestino(true);
    setFeedback(null);
    try {
      await copyToClipboard(destinoImportado);
      setFeedback({ type: "success", message: "Destino copiado com sucesso." });
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Falha ao copiar o destino.") });
    } finally {
      setCopyingDestino(false);
    }
  }

  const schemasDisponiveis = Array.from(new Set(tabelas.map((item) => item.schema))).sort((left, right) =>
    left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
  );
  const tabelasDisponiveis = tabelas
    .filter((item) => !schemaNome || item.schema === schemaNome)
    .sort((left, right) => left.tabela.localeCompare(right.tabela, "pt-BR", { sensitivity: "base" }));

  const ehArquivoXlsx = Boolean(arquivo && arquivo.name.toLowerCase().endsWith(".xlsx"));
  const podeAnalisar =
    Boolean(arquivo && servidor && banco && (modoImportacao === "bulk" || (schemaNome && tabelaNome))) &&
    !analyzing &&
    !loadingConfig &&
    !loadingBanks &&
    (modoImportacao === "bulk" || !loadingTables);
  const podeImportar = Boolean(arquivo && analise?.pode_importar) && !importing;

  return (
    <div className="stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Importação SQL" errorTitle="Falha na importação SQL" />
      <PageHeader
        eyebrow="Arquivos"
        title="Importação para banco"
        description={
          modoImportacao === "tabela_existente"
            ? "Envie um arquivo .xlsx, .csv ou .txt, selecione o servidor SQL, o banco e a tabela de destino. O sistema analisa a estrutura do documento, valida se as colunas batem com a tabela escolhida e só permite a importação quando a compatibilidade estiver correta."
            : "Envie um arquivo .xlsx, .csv ou .txt, selecione o servidor SQL e o banco. O sistema cria uma nova tabela em dbo com nome baseado no arquivo e faz a carga em lote para uso analítico."
        }
      />

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Destino SQL</p>
            <h2>Análise e importação de dados</h2>
          </div>
        </div>

        <div className="form-grid form-grid--two">
          <label className="field importacao-banco__file-field">
            <span>Selecionar arquivos</span>
            <input type="file" accept=".xlsx,.csv,.txt" onChange={(event) => void handleArquivoChange(event)} />
          </label>

          <label className="field">
            <span>Modo</span>
            <select value={modoImportacao} onChange={(event) => setModoImportacao(event.target.value as ModoImportacao)}>
              <option value="bulk">Nova Tabela</option>
              <option value="tabela_existente">Tabela existente</option>
            </select>
          </label>
        </div>

        <div className="form-grid form-grid--two importacao-banco__server-grid">
          <label className="field">
            <span>Servidor SQL</span>
            <select value={servidor} onChange={(event) => setServidor(event.target.value)} disabled={loadingConfig}>
              <option value="">Selecione</option>
              {servidores.map((item) => (
                <option key={item.chave} value={item.chave}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Banco</span>
            <select value={banco} onChange={(event) => setBanco(event.target.value)} disabled={loadingConfig || loadingBanks || !servidor}>
              <option value="">{!servidor ? "Selecione o servidor primeiro" : loadingBanks ? "Carregando..." : "Selecione"}</option>
              {bancos.map((item) => (
                <option key={item.nome} value={item.nome}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {modoImportacao === "tabela_existente" ? (
          <div className="form-grid form-grid--two">
            <label className="field">
              <span>Schema</span>
              <select value={schemaNome} onChange={(event) => setSchemaNome(event.target.value)} disabled={loadingTables || !tabelas.length}>
                <option value="">{loadingTables ? "Carregando..." : "Selecione"}</option>
                {schemasDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tabela</span>
              <select value={tabelaNome} onChange={(event) => setTabelaNome(event.target.value)} disabled={!schemaNome || loadingTables}>
                <option value="">{loadingTables ? "Carregando..." : "Selecione"}</option>
                {tabelasDisponiveis.map((item) => (
                  <option key={`${item.schema}.${item.tabela}`} value={item.tabela}>
                    {item.tabela}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="form-grid importacao-banco__actions-section">
          <div className="field field--full">
            <span>Ações</span>
            <div className="panel__actions importacao-banco__actions importacao-banco__actions--inline">
              <button className="button button--secondary" type="button" onClick={() => void handleAnalisar()} disabled={!podeAnalisar}>
                {analyzing ? "Analisando..." : "Analisar documento"}
              </button>
              <button className="button" type="button" onClick={() => void handleImportar()} disabled={!podeImportar}>
                {importing ? "Importando..." : modoImportacao === "bulk" ? "Criar tabela e importar" : "Importar na tabela SQL"}
              </button>
            </div>
          </div>
        </div>

        {destinoImportado ? (
          <div className="form-grid importacao-banco__destino-section">
            <div className="info-card field--full importacao-banco__destino-card">
              <span>Caminho</span>
              <div className="importacao-banco__destino-row">
                <strong className="importacao-banco__destino-value">{destinoImportado}</strong>
                <button className="button button--secondary" type="button" onClick={() => void handleCopiarDestino()} disabled={copyingDestino}>
                  {copyingDestino ? "Copiando..." : "Copiar caminho"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="form-grid">
          {ehArquivoXlsx ? (
            <label className="field field--full">
              <span>Aba do Excel</span>
              <select
                value={abaNome}
                onChange={(event) => {
                  setAbaNome(event.target.value);
                  setAnalise(null);
                }}
                disabled={loadingSheets || !abasDisponiveis.length}
              >
                <option value="">{loadingSheets ? "Carregando abas..." : abasDisponiveis.length ? "Selecione" : "Nenhuma aba encontrada"}</option>
                {abasDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <p className="muted">
          {modoImportacao === "tabela_existente"
            ? "O arquivo precisa ter cabeçalho. A importação compara as colunas do documento com a tabela escolhida, bloqueia colunas extras ou obrigatórias faltantes e informa quando não for possível prosseguir."
            : "O arquivo precisa ter cabeçalho. Nesse modo, o sistema cria uma nova tabela em dbo com base nas colunas do arquivo e faz a carga em lote."}
        </p>
      </section>

      {analise ? (
        <>
          <section className="surface-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Análise</p>
                <h2>Resultado da validação</h2>
              </div>
              <span className={`importacao-banco__status${analise.pode_importar ? " importacao-banco__status--success" : " importacao-banco__status--danger"}`}>
                {analise.pode_importar ? "Estrutura compatível" : "Estrutura inválida"}
              </span>
            </div>

            <div className="info-grid importacao-banco__summary">
              <div className="info-card">
                <span>Arquivo</span>
                <strong>{analise.nome_arquivo}</strong>
              </div>
              <div className="info-card">
                <span>Formato</span>
                <strong>{analise.tipo_arquivo}</strong>
              </div>
              <div className="info-card">
                <span>Linhas de dados</span>
                <strong>{analise.total_linhas}</strong>
              </div>
              <div className="info-card">
                <span>Aba / delimitador</span>
                <strong>{analise.aba_selecionada || analise.delimitador || "-"}</strong>
              </div>
            </div>

            <p className="muted">{analise.mensagem}</p>

            <div className="card-grid importacao-banco__lists">
              <div className="module-card module-card--compact">
                <span className="module-card__eyebrow">Colunas correspondentes</span>
                <strong>{analise.colunas_correspondentes.length}</strong>
                <div className="importacao-banco__tag-list">
                  {analise.colunas_correspondentes.length ? (
                    analise.colunas_correspondentes.map((item) => (
                      <span key={`${item.origem}-${item.destino}`} className="importacao-banco__tag">
                        {item.origem} {"->"} {item.destino}
                      </span>
                    ))
                  ) : (
                    <span className="importacao-banco__tag importacao-banco__tag--empty">Nenhuma coluna correspondente.</span>
                  )}
                </div>
              </div>

              <div className="module-card module-card--compact">
                <span className="module-card__eyebrow">Colunas extras no arquivo</span>
                <strong>{analise.colunas_extras_arquivo.length}</strong>
                <div className="importacao-banco__tag-list">
                  {analise.colunas_extras_arquivo.length ? (
                    analise.colunas_extras_arquivo.map((item) => (
                      <span key={item} className="importacao-banco__tag importacao-banco__tag--danger">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="importacao-banco__tag importacao-banco__tag--empty">Nenhuma.</span>
                  )}
                </div>
              </div>

              <div className="module-card module-card--compact">
                <span className="module-card__eyebrow">Obrigatórias faltantes</span>
                <strong>{analise.colunas_faltantes_tabela.length}</strong>
                <div className="importacao-banco__tag-list">
                  {analise.colunas_faltantes_tabela.length ? (
                    analise.colunas_faltantes_tabela.map((item) => (
                      <span key={item} className="importacao-banco__tag importacao-banco__tag--danger">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="importacao-banco__tag importacao-banco__tag--empty">Nenhuma.</span>
                  )}
                </div>
              </div>

              <div className="module-card module-card--compact">
                <span className="module-card__eyebrow">Tipos não suportados</span>
                <strong>{analise.colunas_nao_suportadas.length}</strong>
                <div className="importacao-banco__tag-list">
                  {analise.colunas_nao_suportadas.length ? (
                    analise.colunas_nao_suportadas.map((item) => (
                      <span key={item} className="importacao-banco__tag importacao-banco__tag--danger">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="importacao-banco__tag importacao-banco__tag--empty">Nenhum.</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <DataTable
            className="importacao-banco__table"
            title="Colunas do destino"
            exportFileName="importacao-sql-colunas-destino.csv"
            pageSize={10}
            searchPlaceholder="Buscar por nome ou tipo"
            data={analise.colunas_tabela}
            columns={[
              { id: "nome", title: "Nome", accessor: (row) => row.nome, sortable: true },
              { id: "tipo", title: "Tipo", accessor: (row) => row.tipo, sortable: true },
              { id: "obrigatoria", title: "Obrigatória", accessor: (row) => (row.obrigatoria ? "Sim" : "Não"), sortable: true },
              { id: "nulo", title: "Aceita nulo", accessor: (row) => (row.aceita_nulo ? "Sim" : "Não"), sortable: true },
              { id: "importavel", title: "Importável", accessor: (row) => (row.importavel ? "Sim" : "Não"), sortable: true },
            ]}
          />

          <DataTable
            className="importacao-banco__table"
            title="Amostra do documento"
            exportFileName="importacao-sql-amostra.csv"
            pageSize={8}
            searchPlaceholder="Buscar no preview"
            data={analise.amostra}
            columns={analise.colunas_arquivo.map((coluna) => ({
              id: coluna.nome,
              title: coluna.nome,
              accessor: (row: Record<string, string>) => row[coluna.nome] || "",
              sortable: true,
              render: (row: Record<string, string>) => (
                <span className="importacao-banco__cell" title={row[coluna.nome] || ""}>
                  {row[coluna.nome] || "-"}
                </span>
              ),
            }))}
          />
        </>
      ) : null}
    </div>
  );
}
