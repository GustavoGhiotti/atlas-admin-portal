import { FormEvent, useEffect, useState } from "react";

import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import { useAuth } from "@/contexts/AuthContext";
import {
  atualizarColaborador,
  atualizarColaboradorLote,
  atualizarStatusSincronia,
  buscarColaborador,
  consultarStatusSincronia,
  criarCentroCustoTemporario,
  getApiError,
  listarCentrosCusto,
  listarFuncoes,
  obterConfiguracaoAlteracoesColaboradores,
  type CentroCusto,
} from "@/services/atlasApi";

type FormAlteracao = {
  funcao: string;
  id_centro_custo: string;
  centro_custo: string;
  centro_custo_2: string;
  id_centro_custo_display: string;
};

const FORM_VAZIO: FormAlteracao = {
  funcao: "",
  id_centro_custo: "",
  centro_custo: "",
  centro_custo_2: "",
  id_centro_custo_display: "",
};

export default function AlteracoesColaboradores() {
  const { user } = useAuth();
  const responsavel = user?.nm_colaborador ?? user?.nm_login ?? "";
  const [cpfBusca, setCpfBusca] = useState("");
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [sincroniaAtiva, setSincroniaAtiva] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [loadingLote, setLoadingLote] = useState(false);
  const [loteAberto, setLoteAberto] = useState(false);
  const [novoCentroAberto, setNovoCentroAberto] = useState(false);
  const [cadastroCentroTemporarioHabilitado, setCadastroCentroTemporarioHabilitado] = useState(false);
  const [loadingNovoCentro, setLoadingNovoCentro] = useState(false);
  const [cpfsLote, setCpfsLote] = useState("");
  const [novoCentroId, setNovoCentroId] = useState("");
  const [novoCentroNome, setNovoCentroNome] = useState("");
  const [colaborador, setColaborador] = useState<any | null>(null);
  const [formIndividual, setFormIndividual] = useState<FormAlteracao>(FORM_VAZIO);
  const [formLote, setFormLote] = useState<FormAlteracao>(FORM_VAZIO);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [feedbackEdicao, setFeedbackEdicao] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [feedbackLote, setFeedbackLote] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  useEffect(() => {
    void Promise.all([listarCentrosCusto(), listarFuncoes(), consultarStatusSincronia(), obterConfiguracaoAlteracoesColaboradores()]).then(([centrosData, funcoesData, status, config]) => {
      setCentros(centrosData);
      setFuncoes(funcoesData);
      setSincroniaAtiva(status.status === 1);
      setCadastroCentroTemporarioHabilitado(config.cadastro_centro_custo_temporario_habilitado);
    });
  }, []);

  function aplicarAtalhoCentroCusto(form: FormAlteracao, proximoIdCentroCusto: string) {
    const idLimpo = String(proximoIdCentroCusto || "").trim();
    const centroRelacionado = centros.find((item) => String(item.id_centro_custo).trim() === idLimpo);
    return {
      ...form,
      id_centro_custo: idLimpo,
      centro_custo: centroRelacionado?.centro_custo ?? form.centro_custo,
      centro_custo_2: idLimpo === "1011-2" ? form.centro_custo_2 : "",
      id_centro_custo_display: centroRelacionado ? `${centroRelacionado.id_centro_custo} - ${centroRelacionado.centro_custo}` : idLimpo,
    };
  }

  function atualizarFormPorDisplayId(form: FormAlteracao, valor: string) {
    const display = String(valor || "");
    const valorLimpo = display.trim();
    const centroRelacionado = centros.find((item) => {
      const id = String(item.id_centro_custo).trim();
      const label = `${id} - ${item.centro_custo}`;
      return valorLimpo === id || valorLimpo === label;
    });

    if (centroRelacionado) {
      return {
        ...form,
        id_centro_custo: String(centroRelacionado.id_centro_custo).trim(),
        centro_custo: centroRelacionado.centro_custo,
        centro_custo_2: String(centroRelacionado.id_centro_custo).trim() === "1011-2" ? form.centro_custo_2 : "",
        id_centro_custo_display: `${centroRelacionado.id_centro_custo} - ${centroRelacionado.centro_custo}`,
      };
    }

    return {
      ...form,
      id_centro_custo: valorLimpo,
      id_centro_custo_display: display,
    };
  }

  function atualizarFormIndividual(campo: keyof FormAlteracao, valor: string) {
    setFormIndividual((atual) => {
      if (campo === "id_centro_custo") {
        return aplicarAtalhoCentroCusto(atual, valor);
      }
      if (campo === "id_centro_custo_display") {
        return atualizarFormPorDisplayId(atual, valor);
      }
      if (campo === "centro_custo_2" && atual.id_centro_custo !== "1011-2") {
        return atual;
      }
      return { ...atual, [campo]: valor };
    });
  }

  function atualizarFormLote(campo: keyof FormAlteracao, valor: string) {
    setFormLote((atual) => {
      if (campo === "id_centro_custo") {
        return aplicarAtalhoCentroCusto(atual, valor);
      }
      if (campo === "id_centro_custo_display") {
        return atualizarFormPorDisplayId(atual, valor);
      }
      if (campo === "centro_custo_2" && atual.id_centro_custo !== "1011-2") {
        return atual;
      }
      return { ...atual, [campo]: valor };
    });
  }

  function resetLote() {
    setCpfsLote("");
    setFormLote(FORM_VAZIO);
    setFeedbackLote(null);
  }

  async function recarregarCentros() {
    const centrosData = await listarCentrosCusto();
    setCentros(centrosData);
  }

  async function handleBuscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setFeedbackEdicao(null);
    const cpfLimpo = cpfBusca.replace(/\D/g, "").slice(0, 11);
    if (cpfLimpo.length !== 11) {
      setColaborador(null);
      setFormIndividual(FORM_VAZIO);
      setFeedback({ type: "danger", message: "CPF deve conter 11 digitos." });
      return;
    }
    setLoadingBusca(true);
    try {
      const data = await buscarColaborador(cpfLimpo);
      setColaborador(data);
      setFormIndividual(FORM_VAZIO);
      setFeedback({ type: "success", message: `Dados de ${data.colaborador} carregados com sucesso.` });
    } catch (error) {
      setColaborador(null);
      setFormIndividual(FORM_VAZIO);
      setFeedback({ type: "danger", message: getApiError(error, "Nao foi possivel buscar o colaborador.") });
    } finally {
      setLoadingBusca(false);
    }
  }

  async function handleSalvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!colaborador) return;
    setFeedbackEdicao(null);
    if (!formIndividual.funcao || !formIndividual.id_centro_custo || !formIndividual.centro_custo) {
      setFeedbackEdicao({ type: "danger", message: "Funcao, ID Centro de Custo e Centro de Custo sao obrigatorios." });
      return;
    }
    if (formIndividual.id_centro_custo === "1011-2" && !formIndividual.centro_custo_2.trim()) {
      setFeedbackEdicao({ type: "danger", message: "Carteira atual obrigatoria para o centro de custo 1011-2." });
      return;
    }

    setLoadingSalvar(true);
    try {
      const data = await atualizarColaborador(colaborador.cpf, {
        funcao: formIndividual.funcao,
        id_centro_custo: formIndividual.id_centro_custo,
        centro_custo: formIndividual.centro_custo,
        centro_custo_2: formIndividual.centro_custo_2,
        user_atualizacao: responsavel,
      });
      setFeedbackEdicao({ type: "success", message: data.mensagem });
    } catch (error) {
      setFeedbackEdicao({ type: "danger", message: getApiError(error, "Nao foi possivel atualizar os dados.") });
    } finally {
      setLoadingSalvar(false);
    }
  }

  async function handleLote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedbackLote(null);
    const cpfs = cpfsLote
      .split(/[\n,;]+/)
      .map((item) => item.replace(/\D/g, ""))
      .filter((item) => item.length === 11);

    if (!cpfs.length) {
      setFeedbackLote({ type: "danger", message: "Informe pelo menos um CPF valido com 11 digitos." });
      return;
    }
    if (!formLote.funcao || !formLote.id_centro_custo || !formLote.centro_custo) {
      setFeedbackLote({ type: "danger", message: "Funcao, ID Centro de Custo e Centro de Custo sao obrigatorios." });
      return;
    }
    if (formLote.id_centro_custo === "1011-2" && !formLote.centro_custo_2.trim()) {
      setFeedbackLote({ type: "danger", message: "Carteira atual obrigatoria para o centro de custo 1011-2." });
      return;
    }

    setLoadingLote(true);
    try {
      const data = await atualizarColaboradorLote({
        cpfs,
        funcao: formLote.funcao,
        id_centro_custo: formLote.id_centro_custo,
        centro_custo: formLote.centro_custo,
        centro_custo_2: formLote.centro_custo_2,
        responsavel,
      });
      setFeedbackLote({
        type: "success",
        message: `Processados: ${data.total_processados}. Nao encontrados: ${data.nao_encontrados.length}.`,
      });
      resetLote();
      setLoteAberto(false);
    } catch (error) {
      setFeedbackLote({ type: "danger", message: getApiError(error, "Nao foi possivel processar as alteracoes em lote.") });
    } finally {
      setLoadingLote(false);
    }
  }

  async function handleToggleSincronia() {
    const next = sincroniaAtiva ? 0 : 1;
    setLoadingStatus(true);
    try {
      await atualizarStatusSincronia(next);
      setSincroniaAtiva(next === 1);
      if (next === 0) {
        window.location.reload();
        return;
      }
    } catch (error) {
      setFeedback({ type: "danger", message: getApiError(error, "Nao foi possivel atualizar a sincronizacao.") });
    } finally {
      setLoadingStatus(false);
    }
  }

  async function handleCriarCentroTemporario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedbackLote(null);
    const idLimpo = novoCentroId.trim();
    const centroLimpo = novoCentroNome.trim();
    if (!idLimpo || !centroLimpo) {
      setFeedbackLote({ type: "danger", message: "ID Centro de Custo e Centro de Custo sao obrigatorios." });
      return;
    }
    setLoadingNovoCentro(true);
    try {
      const data = await criarCentroCustoTemporario({
        id_centro_custo: idLimpo,
        centro_custo: centroLimpo,
        responsavel,
      });
      await recarregarCentros();
      setNovoCentroAberto(false);
      setNovoCentroId("");
      setNovoCentroNome("");
      setFeedbackLote({ type: "success", message: data.mensagem });
    } catch (error) {
      setFeedbackLote({ type: "danger", message: getApiError(error, "Nao foi possivel criar o centro de custo temporario.") });
    } finally {
      setLoadingNovoCentro(false);
    }
  }

  return (
    <div className="alteracoes-page stack-lg">
      <FeedbackToastBridge feedback={feedback} successTitle="Consulta concluída" errorTitle="Falha na consulta" />
      <FeedbackToastBridge feedback={feedbackEdicao} successTitle="Alteração individual concluída" errorTitle="Falha na alteração individual" />
      <FeedbackToastBridge feedback={feedbackLote} successTitle="Operação em lote concluída" errorTitle="Falha na operação em lote" />
      <section className="alteracoes-hero">
        <div className="alteracoes-hero__title">
          <div>
            <h1>Painel de Alterações</h1>
            <p>Atualize informações de colaboradores de forma segura e monitorada.</p>
          </div>
        </div>

        <div className="alteracoes-hero__actions">
          {cadastroCentroTemporarioHabilitado ? (
            <button className="button alteracoes-hero__batch-button" type="button" onClick={() => setNovoCentroAberto(true)}>
              Novo Centro
            </button>
          ) : null}
          <button className="button alteracoes-hero__batch-button" type="button" onClick={() => setLoteAberto(true)}>
            Alteração em Lote
          </button>
          <button className="alteracoes-sync-toggle" type="button" onClick={handleToggleSincronia} disabled={loadingStatus}>
            <div>
              <strong>
                SINCRONIZAÇÃO
                <span
                  className="alteracoes-sync-toggle__help"
                  title="Quando a sincronização está ativada, as alterações feitas aqui são aplicadas automaticamente. Quando desativada, as mudanças devem ser realizadas diretamente no TOTVS."
                  aria-label="Informações sobre sincronização"
                >
                  ?
                </span>
              </strong>
              <span>{sincroniaAtiva ? "Execução automática ligada" : "Execução automática desligada"}</span>
            </div>
            <span className={`alteracoes-sync-toggle__track${sincroniaAtiva ? " is-active" : ""}`}>
              <span className="alteracoes-sync-toggle__thumb" />
            </span>
          </button>
        </div>
      </section>

      <section className="surface-card alteracoes-search-card">
        <form className="alteracoes-search-form" onSubmit={handleBuscar}>
          <label className="field field--grow">
            <span>CPF do colaborador</span>
            <input
              name="cpf"
              inputMode="numeric"
              value={cpfBusca}
              onChange={(event) => setCpfBusca(event.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="Digite o CPF (apenas números)"
            />
          </label>
          <button className="button alteracoes-search-form__button" type="submit" disabled={loadingBusca}>
            {loadingBusca ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </section>

      {colaborador ? (
        <section className="alteracoes-workspace">
          <article className="surface-card alteracoes-card">
            <p className="eyebrow">Dados atuais</p>
            <div className="alteracoes-current-list">
              <div className="alteracoes-current-item">
                <span>COLABORADOR</span>
                <strong>{colaborador.colaborador}</strong>
              </div>
              <div className="alteracoes-current-item">
                <span>FUNCAO</span>
                <strong>{colaborador.funcao}</strong>
              </div>
              <div className="alteracoes-current-item">
                <span>ID CENTRO DE CUSTO</span>
                <strong>{colaborador.id_centro_custo}</strong>
              </div>
              <div className="alteracoes-current-item">
                <span>CENTRO DE CUSTO</span>
                <strong>{colaborador.centro_custo}</strong>
              </div>
              {colaborador.centro_custo_2 ? (
                <div className="alteracoes-current-item">
                  <span>CARTEIRA ATUAL</span>
                  <strong>{colaborador.centro_custo_2}</strong>
                </div>
              ) : null}
            </div>
          </article>

          <article className="surface-card alteracoes-card">
            <p className="eyebrow">Novos dados</p>
            <form className="alteracoes-form" onSubmit={handleSalvar}>
              <label className="field">
                <span>Nova Função *</span>
                <input
                  list="funcoes-list"
                  value={formIndividual.funcao}
                  onChange={(event) => atualizarFormIndividual("funcao", event.target.value)}
                  placeholder="Selecione ou digite..."
                  required
                />
              </label>

              <label className="field">
                <span>Novo ID Centro de Custo *</span>
                <input
                  list="centros-id-combinado-list"
                  value={formIndividual.id_centro_custo_display}
                  onChange={(event) => atualizarFormIndividual("id_centro_custo_display", event.target.value)}
                  placeholder="Selecione ou digite..."
                  required
                />
              </label>

              <label className="field">
                <span>Novo Centro de Custo *</span>
                <input
                  list="centros-nome-list"
                  value={formIndividual.centro_custo}
                  onChange={(event) => atualizarFormIndividual("centro_custo", event.target.value)}
                  placeholder="Selecione ou digite..."
                  required
                />
              </label>

              {formIndividual.id_centro_custo === "1011-2" ? (
                <label className="field">
                  <span>Carteira Atual *</span>
                    <input
                      list="centros-nome-list"
                      value={formIndividual.centro_custo_2}
                      onChange={(event) => atualizarFormIndividual("centro_custo_2", event.target.value)}
                      placeholder="Selecione ou digite..."
                      required
                    />
                </label>
              ) : null}

              <label className="field">
                <span>Responsável *</span>
                <input value={responsavel} readOnly />
              </label>

              <button className="button alteracoes-submit" type="submit" disabled={loadingSalvar || !sincroniaAtiva}>
                {loadingSalvar ? "Salvando..." : "Prosseguir"}
              </button>

              {!sincroniaAtiva ? <p className="alteracoes-helper">Habilite a sincronização para poder prosseguir com as alterações.</p> : null}
            </form>
          </article>
        </section>
      ) : null}

      {loteAberto ? (
        <div className="modal-backdrop" onClick={() => setLoteAberto(false)}>
          <section className="modal alteracoes-lote-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div>
                <p className="eyebrow">Lote</p>
                <h3>Alteração em Lote</h3>
              </div>
              <button className="alteracoes-modal__close" type="button" onClick={() => setLoteAberto(false)} aria-label="Fechar modal de alteracao em lote">
                <span aria-hidden="true">X</span>
              </button>
            </div>
            <div className="modal__body">
              <form className="alteracoes-form" onSubmit={handleLote}>
                <label className="field">
                  <span>CPFs (um por linha ou separados por vírgula)</span>
                  <textarea value={cpfsLote} onChange={(event) => setCpfsLote(event.target.value)} rows={7} placeholder="Cole os CPFs aqui..." />
                </label>

                <label className="field">
                  <span>Nova Função *</span>
                  <input
                    list="funcoes-list"
                    value={formLote.funcao}
                    onChange={(event) => atualizarFormLote("funcao", event.target.value)}
                    placeholder="Selecione ou digite..."
                    required
                  />
                </label>

                <label className="field">
                  <span>Novo ID Centro de Custo *</span>
                  <input
                    list="centros-id-combinado-list"
                    value={formLote.id_centro_custo_display}
                    onChange={(event) => atualizarFormLote("id_centro_custo_display", event.target.value)}
                    placeholder="Selecione ou digite..."
                    required
                  />
                </label>

                <label className="field">
                  <span>Novo Centro de Custo *</span>
                  <input
                    list="centros-nome-list"
                    value={formLote.centro_custo}
                    onChange={(event) => atualizarFormLote("centro_custo", event.target.value)}
                    placeholder="Selecione ou digite..."
                    required
                  />
                </label>

                {formLote.id_centro_custo === "1011-2" ? (
                  <label className="field">
                    <span>Carteira Atual *</span>
                    <input
                      list="centros-nome-list"
                      value={formLote.centro_custo_2}
                      onChange={(event) => atualizarFormLote("centro_custo_2", event.target.value)}
                      placeholder="Selecione ou digite..."
                      required
                    />
                  </label>
                ) : null}

                <label className="field">
                  <span>Responsável *</span>
                  <input value={responsavel} readOnly />
                </label>

                <button className="button alteracoes-submit" type="submit" disabled={loadingLote || !sincroniaAtiva}>
                  {loadingLote ? "Processando..." : "Aplicar alterações"}
                </button>

                {!sincroniaAtiva ? <p className="alteracoes-helper">Habilite a sincronização para prosseguir.</p> : null}
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {cadastroCentroTemporarioHabilitado && novoCentroAberto ? (
        <div className="modal-backdrop" onClick={() => setNovoCentroAberto(false)}>
          <section className="modal alteracoes-lote-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div>
                <p className="eyebrow">Temporário</p>
                <h3>Novo Centro de Custo</h3>
              </div>
              <button className="alteracoes-modal__close" type="button" onClick={() => setNovoCentroAberto(false)} aria-label="Fechar modal de novo centro de custo">
                <span aria-hidden="true">X</span>
              </button>
            </div>
            <div className="modal__body">
              <form className="alteracoes-form" onSubmit={handleCriarCentroTemporario}>
                <label className="field">
                  <span>Novo ID Centro de Custo *</span>
                  <input value={novoCentroId} onChange={(event) => setNovoCentroId(event.target.value)} placeholder="Ex.: 1099-9" required />
                </label>
                <label className="field">
                  <span>Novo Centro de Custo *</span>
                  <input value={novoCentroNome} onChange={(event) => setNovoCentroNome(event.target.value)} placeholder="Ex.: NOVA CARTEIRA DIGITAL" required />
                </label>
                <label className="field">
                  <span>Responsável *</span>
                  <input value={responsavel} readOnly />
                </label>
                <button className="button alteracoes-submit" type="submit" disabled={loadingNovoCentro || !sincroniaAtiva}>
                  {loadingNovoCentro ? "Criando..." : "Criar centro de custo temporário"}
                </button>
                {!sincroniaAtiva ? <p className="alteracoes-helper">Habilite a sincronização para prosseguir.</p> : null}
              </form>
            </div>
          </section>
        </div>
      ) : null}

      <datalist id="funcoes-list">{funcoes.map((item) => <option key={item} value={item} />)}</datalist>
      <datalist id="centros-id-combinado-list">{centros.map((item) => <option key={item.id_centro_custo} value={`${item.id_centro_custo} - ${item.centro_custo}`} />)}</datalist>
      <datalist id="centros-nome-list">{centros.map((item) => <option key={`${item.id_centro_custo}-${item.centro_custo}`} value={item.centro_custo} />)}</datalist>
    </div>
  );
}
