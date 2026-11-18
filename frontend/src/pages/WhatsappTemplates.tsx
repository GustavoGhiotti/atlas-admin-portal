import { FormEvent, useEffect, useMemo, useState } from "react";

import Modal from "@/components/modals/Modal";
import DataTable from "@/components/tables/DataTable";
import FeedbackToastBridge from "@/components/ui/FeedbackToastBridge";
import PageHeader from "@/components/ui/PageHeader";
import {
  atualizarWhatsappTemplate,
  atualizarAtivoWhatsappTemplate,
  criarWhatsappTemplate,
  detalharWhatsappTemplate,
  excluirWhatsappTemplate,
  getApiError,
  listarWhatsappTemplates,
  submeterWhatsappTemplateMeta,
  type WhatsappTemplate,
  type WhatsappTemplateVariavel,
} from "@/services/atlasApi";

type FeedbackState = {
  type: "success" | "danger";
  message: string;
} | null;

type TemplateFormState = {
  nome_interno: string;
  nome_template_meta: string;
  idioma: string;
  categoria_meta: string;
  header_tipo: string;
  header_texto: string;
  body_texto: string;
  footer_texto: string;
  ativo: boolean;
  variaveis_json: WhatsappTemplateVariavel[];
};

type TemplateStructure = "header_only" | "footer_only" | "header_footer" | "none";
type TemplateOperationalFilter =
  | "todos"
  | "ativos"
  | "desativados"
  | "aprovados"
  | "deletados"
  | "rascunhos"
  | "em_revisao";

const EMPTY_VARIAVEL: WhatsappTemplateVariavel = {
  indice: 1,
  nome: "",
  descricao: "",
  exemplo: "",
};

const EXAMPLE_TEMPLATE = {
  nome_interno: "Lembrete de atendimento ativo",
  nome_template_meta: "lembrete_atendimento_ativo",
  idioma: "pt_BR",
  categoria_meta: "UTILITY",
  header_tipo: "TEXT",
  header_texto: "Grupo Acme",
  body_texto:
    "Ola {{1}}, seu atendimento foi atualizado. O protocolo {{2}} esta disponivel para consulta em nossa central.",
  footer_texto: "Grupo Acme",
  variaveis_json: [
    {
      indice: 1,
      nome: "nome_cliente",
      descricao: "Nome da pessoa que recebera a mensagem.",
      exemplo: "Gustavo",
    },
    {
      indice: 2,
      nome: "protocolo",
      descricao: "Identificador que sera exibido ao cliente.",
      exemplo: "123456",
    },
  ],
};

function buildInitialFormState(): TemplateFormState {
  return {
    nome_interno: "",
    nome_template_meta: "",
    idioma: "pt_BR",
    categoria_meta: "UTILITY",
    header_tipo: "TEXT",
    header_texto: "Grupo Acme",
    body_texto: "",
    footer_texto: "Grupo Acme",
    ativo: true,
    variaveis_json: [],
  };
}

function extractPlaceholderIndices(text: string) {
  const matches = text.matchAll(/\{\{\s*(\d+)\s*\}\}/g);
  const indices = new Set<number>();

  for (const match of matches) {
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > 0) {
      indices.add(value);
    }
  }

  return [...indices].sort((left, right) => left - right);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR");
}

function buildMetaTemplateName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function buildTemplatePreview(bodyText: string, variaveis: WhatsappTemplateVariavel[]) {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, rawIndex: string) => {
    const indice = Number(rawIndex);
    const variavel = variaveis.find((item) => item.indice === indice);
    const exemplo = variavel?.exemplo?.trim();
    return exemplo || `<variavel ${indice}>`;
  });
}

function hasHeader(structure: TemplateStructure) {
  return structure === "header_only" || structure === "header_footer";
}

function hasFooter(structure: TemplateStructure) {
  return structure === "footer_only" || structure === "header_footer";
}

function formatStatusLabel(status?: string | null) {
  const normalized = String(status || "").trim();
  if (!normalized) return "-";
  return normalized.replaceAll("_", " ");
}

function formatTemplateEventLabel(tipoEvento?: string | null) {
  const normalized = String(tipoEvento || "").trim().toUpperCase();
  if (!normalized) return "-";

  const labels: Record<string, string> = {
    TEMPLATE_CRIADO: "Template criado",
    TEMPLATE_ATUALIZADO: "Template atualizado",
    TEMPLATE_SUBMETIDO_META: "Submetido para Meta",
    TEMPLATE_SUBMISSAO_META_FALHOU: "Falha na submissao",
    TEMPLATE_STATUS_UPDATE: "Status atualizado",
    TEMPLATE_QUALITY_UPDATE: "Qualidade atualizada",
    TEMPLATE_COMPONENTS_UPDATE: "Componentes atualizados",
    TEMPLATE_CATEGORY_UPDATE: "Categoria atualizada",
    TEMPLATE_DELETADO: "Template deletado",
    TEMPLATE_EVENTO_META: "Evento da Meta",
  };

  return labels[normalized] || formatStatusLabel(normalized);
}

function normalizeStatusTone(status?: string | null) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "APROVADO") return "status-pill status-pill--success";
  if (normalized === "EM_REVISAO" || normalized === "SUBMETIDO") return "status-pill status-pill--warning";
  if (normalized === "REJEITADO" || normalized === "DESABILITADO") return "status-pill status-pill--danger";
  if (normalized === "RASCUNHO") return "status-pill status-pill--accent";
  return "status-pill status-pill--default";
}

function canSubmitTemplate(template: WhatsappTemplate) {
  return !template.id_template_meta && String(template.status_template || "").toUpperCase() === "RASCUNHO";
}

function canManageDraft(template: WhatsappTemplate) {
  return !template.id_template_meta && String(template.status_template || "").toUpperCase() === "RASCUNHO";
}

function canToggleTemplateActive(template: WhatsappTemplate) {
  return String(template.status_template || "").toUpperCase() === "APROVADO";
}

function inferMessageStructure(template: Pick<WhatsappTemplate, "header_texto" | "footer_texto">): TemplateStructure {
  const hasTemplateHeader = Boolean(template.header_texto?.trim());
  const hasTemplateFooter = Boolean(template.footer_texto?.trim());

  if (hasTemplateHeader && hasTemplateFooter) return "header_footer";
  if (hasTemplateHeader) return "header_only";
  if (hasTemplateFooter) return "footer_only";
  return "none";
}

export default function WhatsappTemplates() {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [templateSummary, setTemplateSummary] = useState({
    rascunho: 0,
    emRevisao: 0,
    aprovado: 0,
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [error, setError] = useState("");
  const [operationalFilter, setOperationalFilter] = useState<TemplateOperationalFilter>("ativos");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsappTemplate | null>(null);
  const [templatePendenteExclusao, setTemplatePendenteExclusao] = useState<WhatsappTemplate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [messageStructure, setMessageStructure] = useState<TemplateStructure>("header_footer");
  const [formState, setFormState] = useState<TemplateFormState>(buildInitialFormState);

  const detectedVariableIndices = useMemo(
    () => extractPlaceholderIndices(formState.body_texto),
    [formState.body_texto],
  );
  const templatePreview = useMemo(
    () => buildTemplatePreview(formState.body_texto, formState.variaveis_json),
    [formState.body_texto, formState.variaveis_json],
  );
  const showsHeader = hasHeader(messageStructure);
  const showsFooter = hasFooter(messageStructure);
  const isEditingTemplate = editingTemplateId !== null;

  useEffect(() => {
    void loadTemplates();
  }, [operationalFilter]);

  useEffect(() => {
    setFormState((current) => {
      const nextVariaveis = detectedVariableIndices.map((indice) => {
        const existing = current.variaveis_json.find((item) => item.indice === indice);
        return (
          existing || {
            ...EMPTY_VARIAVEL,
            indice,
          }
        );
      });

      const unchanged =
        nextVariaveis.length === current.variaveis_json.length &&
        nextVariaveis.every((item, index) => current.variaveis_json[index] === item);

      if (unchanged) {
        return current;
      }

      return {
        ...current,
        variaveis_json: nextVariaveis,
      };
    });
  }, [detectedVariableIndices]);

  async function loadTemplates(notify = false) {
    setLoading(true);
    setError("");
    if (notify) {
      setFeedback(null);
    }

    try {
      const [visibleData, draftData, reviewData, approvedData] = await Promise.all([
        listarWhatsappTemplates({
          filtro: operationalFilter,
        }),
        listarWhatsappTemplates({
          filtro: "rascunhos",
        }),
        listarWhatsappTemplates({
          filtro: "em_revisao",
        }),
        listarWhatsappTemplates({
          filtro: "aprovados",
        }),
      ]);
      setTemplates(visibleData.templates || []);
      setTemplateSummary({
        rascunho: draftData.total || draftData.templates?.length || 0,
        emRevisao: reviewData.total || reviewData.templates?.length || 0,
        aprovado: approvedData.total || approvedData.templates?.length || 0,
      });
      if (notify) {
        setFeedback({ type: "success", message: "Templates atualizados com sucesso." });
      }
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao carregar templates de WhatsApp.");
      setError(message);
      if (notify) {
        setFeedback({ type: "danger", message });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenDetails(template: WhatsappTemplate) {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedTemplate(null);
    setError("");

    try {
      const data = await detalharWhatsappTemplate(template.id_template);
      setSelectedTemplate(data.template);
    } catch (requestError) {
      setError(getApiError(requestError, "Falha ao carregar detalhes do template."));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function resetTemplateEditor() {
    setCreateOpen(false);
    setExampleOpen(false);
    setEditingTemplateId(null);
    setMessageStructure("header_footer");
    setFormState(buildInitialFormState());
  }

  function openCreateTemplateModal() {
    setDetailOpen(false);
    setSelectedTemplate(null);
    setError("");
    setFeedback(null);
    setEditingTemplateId(null);
    setExampleOpen(false);
    setMessageStructure("header_footer");
    setFormState(buildInitialFormState());
    setCreateOpen(true);
  }

  function handleEditDraft(template: WhatsappTemplate) {
    setFeedback(null);
    setError("");
    setEditingTemplateId(template.id_template);
    setExampleOpen(false);
    setMessageStructure(inferMessageStructure(template));
    setFormState({
      nome_interno: template.nome_interno || "",
      nome_template_meta: template.nome_template_meta || "",
      idioma: template.idioma || "pt_BR",
      categoria_meta: template.categoria_meta || "UTILITY",
      header_tipo: template.header_tipo || "TEXT",
      header_texto: template.header_texto || "",
      body_texto: template.body_texto || "",
      footer_texto: template.footer_texto || "",
      ativo: template.ativo ?? true,
      variaveis_json: template.variaveis_json || [],
    });
    setDetailOpen(false);
    setSelectedTemplate(null);
    setCreateOpen(true);
  }

  function handleRequestDeleteDraft(template: WhatsappTemplate) {
    if (!canManageDraft(template)) {
      setFeedback({ type: "danger", message: "So e permitido apagar templates em rascunho." });
      return;
    }

    setTemplatePendenteExclusao(template);
  }

  async function handleConfirmDeleteDraft() {
    const template = templatePendenteExclusao;
    if (!template) return;

    setDeletingId(template.id_template);
    setFeedback(null);
    setError("");

    try {
      const response = await excluirWhatsappTemplate(template.id_template);
      setTemplatePendenteExclusao(null);
      if (detailOpen && selectedTemplate?.id_template === template.id_template) {
        setDetailOpen(false);
        setSelectedTemplate(null);
      }
      await loadTemplates();
      setFeedback({ type: "success", message: response.mensagem || "Template excluido com sucesso." });
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao excluir template em rascunho.");
      setError(message);
      setFeedback({ type: "danger", message });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setFeedback(null);
    setError("");

    try {
      const variaveis = formState.variaveis_json
        .map((item) => ({
          indice: item.indice,
          nome: item.nome.trim(),
          descricao: item.descricao?.trim() || undefined,
          exemplo: item.exemplo?.trim() || undefined,
        }))
        .filter((item) => item.nome);

      const payload = {
        nome_interno: formState.nome_interno.trim(),
        nome_template_meta: formState.nome_template_meta.trim(),
        idioma: "pt_BR",
        categoria_meta: formState.categoria_meta,
        header_tipo: showsHeader ? "TEXT" : undefined,
        header_texto: showsHeader ? formState.header_texto.trim() || undefined : undefined,
        body_texto: formState.body_texto.trim(),
        footer_texto: showsFooter ? formState.footer_texto.trim() || undefined : undefined,
        ativo: formState.ativo,
        variaveis_json: variaveis.length ? variaveis : undefined,
      };

      const response = isEditingTemplate && editingTemplateId
        ? await atualizarWhatsappTemplate(editingTemplateId, payload)
        : await criarWhatsappTemplate(payload);
      const successMessage = response.mensagem || (isEditingTemplate ? "Template atualizado com sucesso." : "Template criado com sucesso.");
      const targetTemplateId = response.id_template;
      resetTemplateEditor();
      setFeedback({ type: "success", message: successMessage });
      await loadTemplates();
      await handleOpenDetails({
        id_template: targetTemplateId,
      } as WhatsappTemplate);
    } catch (requestError) {
      const message = getApiError(
        requestError,
        isEditingTemplate ? "Falha ao atualizar template de WhatsApp." : "Falha ao criar template de WhatsApp.",
      );
      setError(message);
      setFeedback({ type: "danger", message });
    } finally {
      setCreating(false);
    }
  }

  async function handleSubmitTemplate(template: WhatsappTemplate) {
    setSubmittingId(template.id_template);
    setFeedback(null);
    setError("");

    try {
      const response = await submeterWhatsappTemplateMeta(template.id_template);
      setFeedback({
        type: "success",
        message: `Template submetido com sucesso. Status atual: ${response.status_template}.`,
      });
      await loadTemplates();
      if (detailOpen && selectedTemplate?.id_template === template.id_template) {
        await handleOpenDetails(template);
      }
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao submeter template para a Meta.");
      setError(message);
      setFeedback({ type: "danger", message });
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleToggleTemplateActive(template: WhatsappTemplate) {
    if (!canToggleTemplateActive(template)) return;

    const nextAtivo = !template.ativo;
    setTogglingId(template.id_template);
    setFeedback(null);
    setError("");

    try {
      const response = await atualizarAtivoWhatsappTemplate(template.id_template, nextAtivo);
      setFeedback({
        type: "success",
        message: response.mensagem || `Template ${nextAtivo ? "ativado" : "desativado"} com sucesso.`,
      });
      await loadTemplates();
      if (detailOpen && selectedTemplate?.id_template === template.id_template) {
        await handleOpenDetails(template);
      }
    } catch (requestError) {
      const message = getApiError(requestError, "Falha ao alterar disponibilidade do template.");
      setError(message);
      setFeedback({ type: "danger", message });
    } finally {
      setTogglingId(null);
    }
  }

  function updateVariavel(index: number, field: keyof WhatsappTemplateVariavel, value: string) {
    setFormState((current) => ({
      ...current,
      variaveis_json: current.variaveis_json.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  return (
    <div className="stack-md whatsapp-templates-page">
      <FeedbackToastBridge
        feedback={feedback}
        errorMessage={error}
        successTitle="Templates WhatsApp"
        errorTitle="Falha em templates WhatsApp"
      />

      <PageHeader
        eyebrow="Operacoes / WhatsApp"
        title="Templates WhatsApp"
        description="Gerencie o catalogo de templates que sera enviado para a Meta e mantenha a operacao com governanca centralizada."
        actions={(
          <>
            <button className="button button--secondary" type="button" onClick={() => void loadTemplates(true)} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
            <button className="button" type="button" onClick={openCreateTemplateModal}>
              Novo template
            </button>
          </>
        )}
      />

      <section className="whatsapp-templates-summary">
        <article className="whatsapp-templates-summary__card">
          <span>Templates em tela</span>
          <strong>{templates.length}</strong>
          <p>Volume atual carregado com os filtros aplicados.</p>
        </article>
        <article className="whatsapp-templates-summary__card">
          <span>Rascunho</span>
          <strong>{templateSummary.rascunho}</strong>
          <p>Modelos ainda pendentes de submissao para a Meta.</p>
        </article>
        <article className="whatsapp-templates-summary__card">
          <span>Em revisao</span>
          <strong>{templateSummary.emRevisao}</strong>
          <p>Templates enviados e aguardando avaliacao externa.</p>
        </article>
        <article className="whatsapp-templates-summary__card whatsapp-templates-summary__card--success">
          <span>Aprovado</span>
          <strong>{templateSummary.aprovado}</strong>
          <p>Templates prontos para uso posterior no Copilot.</p>
        </article>
      </section>

      <section className="surface-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Filtro operacional</p>
            <h2>Refine o catalogo visivel</h2>
          </div>
        </div>
        <div className="inline-form">
            <label className="field field--grow">
              <span>Status rapido</span>
              <select
              value={operationalFilter}
              onChange={(event) => setOperationalFilter(event.target.value as TemplateOperationalFilter)}
              >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="desativados">Desativados</option>
              <option value="aprovados">Aprovados</option>
              <option value="deletados">Deletados</option>
              <option value="rascunhos">Rascunhos</option>
              <option value="em_revisao">Em revisao</option>
              </select>
            </label>
          </div>
      </section>

      {loading ? (
        <div className="page-loader">Carregando templates...</div>
      ) : (
        <DataTable
          title="Catalogo de templates"
          className="whatsapp-templates-table"
          exportFileName="whatsapp-templates.csv"
          searchPlaceholder="Buscar por nome interno, nome Meta ou status"
          data={templates}
          initialSortColumn="data_atualizacao"
          columns={[
            {
              id: "nome_template_meta",
              title: "Template",
              accessor: (row) => row.nome_template_meta,
              sortable: true,
              headerClassName: "whatsapp-templates-table__col-template",
              render: (row) => (
                <div className="template-table__identity">
                  <strong>{row.nome_template_meta}</strong>
                  <span>{row.nome_interno}</span>
                </div>
              ),
            },
            {
              id: "status_template",
              title: "Status",
              accessor: (row) => row.status_template,
              sortable: true,
              headerClassName: "whatsapp-templates-table__col-status",
              render: (row) => (
                <span className={normalizeStatusTone(row.status_template)}>
                  {formatStatusLabel(row.status_template)}
                </span>
              ),
            },
            {
              id: "categoria_meta",
              title: "Categoria",
              accessor: (row) => row.categoria_meta,
              sortable: true,
              headerClassName: "whatsapp-templates-table__col-categoria",
            },
            {
              id: "idioma",
              title: "Idioma",
              accessor: (row) => row.idioma,
              sortable: true,
              headerClassName: "whatsapp-templates-table__col-idioma",
            },
            {
              id: "data_atualizacao",
              title: "Atualizacao",
              accessor: (row) => Date.parse(row.data_atualizacao || "") || 0,
              sortable: true,
              headerClassName: "whatsapp-templates-table__col-data",
              render: (row) => formatDateTime(row.data_atualizacao),
            },
            {
              id: "acoes",
              title: "Acoes",
              accessor: (row) => row.id_template,
              align: "right",
              headerClassName: "whatsapp-templates-table__col-acoes",
              render: (row) => (
                <div
                  className={`table-actions template-table__actions${
                    canToggleTemplateActive(row) ? " template-table__actions--stacked" : ""
                  }`}
                >
                  <button className="button button--ghost-neutral" type="button" onClick={() => void handleOpenDetails(row)}>
                    Detalhes
                  </button>
                  {canToggleTemplateActive(row) ? (
                    <button
                      className="template-active-toggle"
                      type="button"
                      disabled={togglingId === row.id_template}
                      onClick={() => void handleToggleTemplateActive(row)}
                      aria-pressed={row.ativo}
                      title={row.ativo ? "Desativar template aprovado" : "Ativar template aprovado"}
                    >
                      <span className="template-active-toggle__meta">
                        <small>{togglingId === row.id_template ? "Atualizando..." : "Uso no Copilot:"}</small>
                      </span>
                      <span className={`template-active-toggle__track${row.ativo ? " is-active" : ""}`}>
                        <span className="template-active-toggle__thumb" />
                      </span>
                    </button>
                  ) : null}
                  {canSubmitTemplate(row) ? (
                    <button
                      className="button button--success"
                      type="button"
                      disabled={submittingId === row.id_template}
                      onClick={() => void handleSubmitTemplate(row)}
                    >
                      {submittingId === row.id_template ? "Submetendo..." : "Submeter"}
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={createOpen}
        className="modal--wide"
        title={isEditingTemplate ? "Editar rascunho WhatsApp" : "Novo template WhatsApp"}
        description={
          isEditingTemplate
            ? "Ajuste o rascunho local antes da submissao. As alteracoes seguem bloqueadas para templates ja enviados a Meta."
            : "Preencha os campos principais, mantenha o texto aderente as regras da Meta e defina as variaveis necessarias."
        }
        onClose={() => {
          if (!creating) {
            resetTemplateEditor();
          }
        }}
      >
        <form className="stack-md" onSubmit={handleSaveTemplate}>
          <section className="surface-card surface-card--compact whatsapp-template-guide">
            <div className="section-header">
              <div>
                <p className="eyebrow">Guia rapido</p>
                <h2>Como montar um template valido</h2>
              </div>
              <button
                className="button button--ghost-neutral"
                type="button"
                onClick={() => setExampleOpen((current) => !current)}
              >
                {exampleOpen ? "Ocultar exemplo" : "Ver exemplo de criacao"}
              </button>
            </div>

            <div className="whatsapp-template-guide__grid">
              <div className="result-box">
                <strong>Cabecalho</strong>
                <p>Campo curto que aparece acima da mensagem principal. Use para identificar a marca ou o contexto.</p>
              </div>
              <div className="result-box">
                <strong>Mensagem principal</strong>
                <p>Texto central enviado ao cliente. Aqui ficam o conteudo principal e as variaveis dinamicas.</p>
              </div>
              <div className="result-box">
                <strong>Rodape</strong>
                <p>Complemento institucional curto. Nao use variaveis no rodape.</p>
              </div>
              <div className="result-box">
                <strong>Variaveis</strong>
                <p>As variaveis sao trechos como {`{{1}}`} e {`{{2}}`}. Elas devem ser sequenciais e precisam ter exemplos claros.</p>
              </div>
            </div>

            <ul className="whatsapp-template-guide__list">
              <li>O idioma do cadastro fica fixo em pt_BR para padronizar o catalogo atual.</li>
              <li>Evite iniciar ou terminar a mensagem principal com variaveis.</li>
              <li>Use nomes tecnicos simples para o nome Meta, com letras minusculas e underline.</li>
            </ul>
          </section>

          {exampleOpen ? (
            <section className="surface-card surface-card--compact whatsapp-template-example">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Exemplo guiado</p>
                  <h2>Referencia pronta para consulta</h2>
                </div>
              </div>

              <div className="form-grid form-grid--two whatsapp-template-example__form">
                <label className="field">
                  <span>Nome interno</span>
                  <input value={EXAMPLE_TEMPLATE.nome_interno} disabled />
                </label>
                <label className="field">
                  <span>Nome tecnico da Meta</span>
                  <input value={EXAMPLE_TEMPLATE.nome_template_meta} disabled />
                </label>
                <label className="field">
                  <span>Idioma</span>
                  <input value={EXAMPLE_TEMPLATE.idioma} disabled />
                </label>
                <label className="field">
                  <span>Categoria</span>
                  <input value={EXAMPLE_TEMPLATE.categoria_meta} disabled />
                </label>
                <label className="field">
                  <span>Tipo do cabecalho</span>
                  <input value={EXAMPLE_TEMPLATE.header_tipo} disabled />
                </label>
                <label className="field">
                  <span>Texto do cabecalho</span>
                  <input value={EXAMPLE_TEMPLATE.header_texto} disabled />
                </label>
                <label className="field field--full">
                  <span>Mensagem principal</span>
                  <textarea rows={4} value={EXAMPLE_TEMPLATE.body_texto} disabled />
                </label>
                <label className="field field--full">
                  <span>Rodape</span>
                  <input value={EXAMPLE_TEMPLATE.footer_texto} disabled />
                </label>
              </div>

              <div className="stack-sm">
                <strong>Variaveis do exemplo</strong>
                <div className="whatsapp-template-example__variables">
                  {EXAMPLE_TEMPLATE.variaveis_json.map((variavel) => (
                    <div key={variavel.indice} className="result-box">
                      <strong>
                        {variavel.nome} ({`{{${variavel.indice}}}`})
                      </strong>
                      <p>{variavel.descricao}</p>
                      <p>Exemplo enviado para a Meta: {variavel.exemplo}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="surface-card surface-card--compact whatsapp-template-creation">
            <div className="section-header">
              <div>
                <p className="eyebrow">Criacao do template</p>
                <h2>Preencha a estrutura que sera enviada para aprovacao</h2>
              </div>
            </div>

            <div className="form-grid form-grid--two">
              <label className="field">
                <span>Nome interno</span>
                <input
                  value={formState.nome_interno}
                  onChange={(event) => {
                    const nextNomeInterno = event.target.value;
                    setFormState((current) => ({
                      ...current,
                      nome_interno: nextNomeInterno,
                      nome_template_meta: buildMetaTemplateName(nextNomeInterno),
                    }));
                  }}
                  placeholder="Ex.: cobranca campanha maio"
                  required
                />
                <small className="field-hint field-hint--placeholder">Identificacao interna para localizar o template no Atlas.</small>
              </label>
              <label className="field">
                <span>Nome tecnico da Meta</span>
                <input
                  value={formState.nome_template_meta}
                  disabled
                  placeholder="ex_cobranca_campanha_maio"
                  required
                />
                <small className="field-hint field-hint--placeholder">Gerado automaticamente a partir do nome interno com letras minusculas, numeros e underline.</small>
              </label>
              <label className="field">
                <span>Idioma</span>
                <input value="pt_BR" disabled />
                <small className="field-hint field-hint--placeholder">Padrao operacional atual para todos os templates deste modulo.</small>
              </label>
              <label className="field">
                <span>Categoria</span>
                <select
                  value={formState.categoria_meta}
                  onChange={(event) => setFormState((current) => ({ ...current, categoria_meta: event.target.value }))}
                >
                  <option value="UTILITY">UTILITY</option>
                  <option value="MARKETING">MARKETING</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
                <small className="field-hint">
                  {formState.categoria_meta === "UTILITY"
                    ? "Atualizacoes, avisos e comunicacoes de servico relacionadas a um atendimento ou processo existente."
                    : formState.categoria_meta === "MARKETING"
                      ? "Campanhas, ofertas e comunicacoes comerciais para relacionamento e divulgacao."
                      : "Mensagens de autenticacao, validacao de identidade ou envio de codigo."}
                </small>
              </label>
              <label className="field">
                <span>Estrutura da mensagem</span>
                <select
                  value={messageStructure}
                  onChange={(event) => setMessageStructure(event.target.value as TemplateStructure)}
                >
                  <option value="header_only">Somente cabecalho</option>
                  <option value="footer_only">Somente rodape</option>
                  <option value="header_footer">Com rodape e cabecalho</option>
                  <option value="none">Sem nada</option>
                </select>
                <small className="field-hint field-hint--placeholder">Escolha quais apoios visuais deseja usar na mensagem antes de preencher o conteudo.</small>
              </label>
              {showsHeader ? (
                <label className="field">
                  <span>Texto do cabecalho</span>
                  <input
                    value={formState.header_texto}
                    onChange={(event) => setFormState((current) => ({ ...current, header_texto: event.target.value }))}
                    placeholder="Grupo Acme"
                  />
                  <small className="field-hint field-hint--placeholder">Texto curto de contexto, marca ou identificacao da comunicacao.</small>
                </label>
              ) : (
                <div className="field" aria-hidden="true" />
              )}
              {showsFooter ? (
                <label className="field field--full">
                  <span>Rodape</span>
                  <input
                    value={formState.footer_texto}
                    onChange={(event) => setFormState((current) => ({ ...current, footer_texto: event.target.value }))}
                    placeholder="Grupo Acme"
                  />
                  <small className="field-hint field-hint--placeholder">Complemento institucional curto exibido ao final da mensagem.</small>
                </label>
              ) : null}
              <div className="field field--full whatsapp-template-composer">
                <div className="whatsapp-template-composer__grid">
                  <label className="field whatsapp-template-composer__editor">
                    <span>Mensagem principal</span>
                    <textarea
                      rows={7}
                      value={formState.body_texto}
                      onChange={(event) => setFormState((current) => ({ ...current, body_texto: event.target.value }))}
                      placeholder="Ola {{1}}, seu atendimento foi atualizado. O protocolo {{2}} esta disponivel em nossa central."
                      required
                    />
                    <small className="field-hint field-hint--placeholder">
                      Use variaveis sempre no formato {`{{1}}`}, {`{{2}}`}, {`{{3}}`}. Formatos como {"{}"} ou {`{{}}`} nao sao reconhecidos.
                    </small>
                  </label>

                  <div className="field whatsapp-template-preview">
                    <span>Previa do template</span>
                    <small className="field-hint field-hint--placeholder">
                      A previa usa os valores de exemplo preenchidos nas variaveis detectadas para simular como a mensagem ficara.
                    </small>

                    <div className="whatsapp-template-preview__card">
                      <div className="whatsapp-template-preview__header">
                        <span>Previa operacional</span>
                        <strong>WhatsApp</strong>
                      </div>

                      <div className="whatsapp-template-preview__bubble">
                        {showsHeader && formState.header_texto.trim() ? (
                          <p className="whatsapp-template-preview__eyebrow">{formState.header_texto.trim()}</p>
                        ) : null}

                        <p className="whatsapp-template-preview__body">
                          {templatePreview || "A mensagem principal aparecera aqui assim que voce comecar a preencher o template."}
                        </p>

                        {showsFooter && formState.footer_texto.trim() ? (
                          <p className="whatsapp-template-preview__footer">{formState.footer_texto.trim()}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="field field--full whatsapp-template-inline-variables">
                <span>Variaveis detectadas no texto</span>
                <div className="result-box whatsapp-template-variable-help whatsapp-template-variable-help--compact">
                  <strong>Leitura rapida</strong>
                  <p>Use {`{{1}}`}, {`{{2}}`} e {`{{3}}`} no texto. O nome da variavel e interno, e o valor de exemplo serve apenas para montar e validar o template.</p>
                  <p>
                    {detectedVariableIndices.length
                      ? `Encontramos ${detectedVariableIndices.length} variavel(is) no texto principal. Preencha os dados abaixo para cada indice detectado.`
                      : "Nenhuma variavel detectada ainda. Se precisar usar dados dinamicos, declare no texto principal usando o formato correto."}
                  </p>
                </div>

                {formState.variaveis_json.length ? (
                  <div className="stack-md">
                    {formState.variaveis_json.map((variavel, index) => (
                      <div key={variavel.indice} className="form-grid form-grid--three whatsapp-template-variable-row">
                        <label className="field">
                          <span>Indice</span>
                          <input value={variavel.indice} disabled />
                          <small className="field-hint field-hint--placeholder">Posicao usada no texto do template, como {`{{1}}`}.</small>
                        </label>
                        <label className="field">
                          <span>Nome da variavel</span>
                          <input
                            value={variavel.nome}
                            onChange={(event) => updateVariavel(index, "nome", event.target.value)}
                            placeholder="nome_cliente"
                            required
                          />
                          <small className="field-hint">Usado apenas para identificacao interna da variavel.</small>
                        </label>
                        <label className="field">
                          <span>Valor de exemplo</span>
                          <input
                            value={variavel.exemplo || ""}
                            onChange={(event) => updateVariavel(index, "exemplo", event.target.value)}
                            placeholder="Gustavo"
                            required
                          />
                          <small className="field-hint">Referencia tecnica para o cadastro do template. Nao e o valor final da mensagem.</small>
                        </label>
                        <label className="field field--full">
                          <span>Descricao operacional</span>
                          <input
                            value={variavel.descricao || ""}
                            onChange={(event) => updateVariavel(index, "descricao", event.target.value)}
                            placeholder="Explique onde essa variavel sera usada"
                            required
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state empty-state--inline">
                    Digite a mensagem principal com variaveis como {`{{1}}`} e {`{{2}}`} para liberar os campos de preenchimento.
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="table-actions">
            <button
              className="button button--ghost-neutral"
              type="button"
              disabled={creating}
              onClick={() => {
                setCreateOpen(false);
                setExampleOpen(false);
                setMessageStructure("header_footer");
                setFormState(buildInitialFormState());
              }}
            >
              Cancelar
            </button>
            <button className="button" type="submit" disabled={creating}>
              {creating ? (isEditingTemplate ? "Salvando..." : "Criando...") : (isEditingTemplate ? "Salvar rascunho" : "Criar template")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={detailOpen}
        title={selectedTemplate?.nome_template_meta || "Detalhes do template"}
        description="Acompanhe o conteudo consolidado, o status atual e o historico operacional do template."
        onClose={() => {
          if (!detailLoading && !submittingId && !deletingId) {
            setDetailOpen(false);
            setSelectedTemplate(null);
          }
        }}
      >
        {detailLoading || !selectedTemplate ? (
          <div className="page-loader">Carregando detalhes...</div>
        ) : (
          <div className="stack-md">
            <div className="info-grid">
              <div className="info-card">
                <span>Status atual</span>
                <strong>
                  <span className={normalizeStatusTone(selectedTemplate.status_template)}>
                    {formatStatusLabel(selectedTemplate.status_template)}
                  </span>
                </strong>
              </div>
              <div className="info-card">
                <span>ID Meta</span>
                <strong>{selectedTemplate.id_template_meta || "-"}</strong>
              </div>
              <div className="info-card">
                <span>Idioma</span>
                <strong>{selectedTemplate.idioma}</strong>
              </div>
              <div className="info-card">
                <span>Categoria</span>
                <strong>{selectedTemplate.categoria_meta}</strong>
              </div>
            </div>

            <section className="surface-card surface-card--compact">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Conteudo</p>
                  <h2>Template consolidado</h2>
                </div>
                <div className="table-actions">
                  {canToggleTemplateActive(selectedTemplate) ? (
                    <button
                      className="template-active-toggle template-active-toggle--detail"
                      type="button"
                      disabled={togglingId === selectedTemplate.id_template}
                      onClick={() => void handleToggleTemplateActive(selectedTemplate)}
                      aria-pressed={selectedTemplate.ativo}
                      title={selectedTemplate.ativo ? "Desativar template aprovado" : "Ativar template aprovado"}
                    >
                      <span className="template-active-toggle__meta">
                        <small>{togglingId === selectedTemplate.id_template ? "Atualizando..." : "Uso no Copilot:"}</small>
                      </span>
                      <span className={`template-active-toggle__track${selectedTemplate.ativo ? " is-active" : ""}`}>
                        <span className="template-active-toggle__thumb" />
                      </span>
                    </button>
                  ) : null}
                  {canManageDraft(selectedTemplate) ? (
                    <>
                      <button
                        className="button button--ghost-neutral"
                        type="button"
                        disabled={creating || deletingId === selectedTemplate.id_template}
                        onClick={() => handleEditDraft(selectedTemplate)}
                      >
                        Editar rascunho
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        disabled={creating || deletingId === selectedTemplate.id_template}
                        onClick={() => handleRequestDeleteDraft(selectedTemplate)}
                      >
                        {deletingId === selectedTemplate.id_template ? "Apagando..." : "Apagar rascunho"}
                      </button>
                    </>
                  ) : null}
                  {canSubmitTemplate(selectedTemplate) ? (
                    <button
                      className="button button--success"
                      type="button"
                      disabled={submittingId === selectedTemplate.id_template || deletingId === selectedTemplate.id_template}
                      onClick={() => void handleSubmitTemplate(selectedTemplate)}
                    >
                      {submittingId === selectedTemplate.id_template ? "Submetendo..." : "Submeter para Meta"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="stack-md">
                <div className="result-box">
                  <strong>Nome interno</strong>
                  <p>{selectedTemplate.nome_interno}</p>
                </div>
                <div className="result-box">
                  <strong>Cabecalho</strong>
                  <p>{selectedTemplate.header_texto || "-"}</p>
                </div>
                <div className="result-box">
                  <strong>Mensagem principal</strong>
                  <p>{selectedTemplate.body_texto}</p>
                </div>
                <div className="result-box">
                  <strong>Rodape</strong>
                  <p>{selectedTemplate.footer_texto || "-"}</p>
                </div>
              </div>
            </section>

            <section className="surface-card surface-card--compact">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Variaveis</p>
                  <h2>Entradas dinamicas</h2>
                </div>
              </div>

              {selectedTemplate.variaveis_json?.length ? (
                <DataTable
                  title="Variaveis do template"
                  className="whatsapp-template-detail-table"
                  data={selectedTemplate.variaveis_json}
                  pageSize={5}
                  exportFileName={`template-${selectedTemplate.id_template}-variaveis.csv`}
                  showExport={false}
                  columns={[
                    { id: "indice", title: "Indice", accessor: (row) => row.indice, sortable: true },
                    { id: "nome", title: "Nome", accessor: (row) => row.nome, sortable: true },
                    { id: "descricao", title: "Descricao", accessor: (row) => row.descricao || "-", sortable: true },
                    { id: "exemplo", title: "Exemplo", accessor: (row) => row.exemplo || "-", sortable: true },
                  ]}
                />
              ) : (
                <div className="empty-state">Este template nao possui variaveis cadastradas.</div>
              )}
            </section>

            <section className="surface-card surface-card--compact">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Historico</p>
                  <h2>Eventos do template</h2>
                </div>
              </div>

              {selectedTemplate.eventos?.length ? (
                <DataTable
                  title="Eventos registrados"
                  className="whatsapp-template-detail-table whatsapp-template-events-table"
                  data={selectedTemplate.eventos}
                  pageSize={5}
                  exportFileName={`template-${selectedTemplate.id_template}-eventos.csv`}
                  showExport={false}
                  columns={[
                    {
                      id: "data_evento",
                      title: "Data",
                      accessor: (row) => Date.parse(row.data_evento || "") || 0,
                      sortable: true,
                      headerClassName: "whatsapp-template-events-table__col-data",
                      render: (row) => formatDateTime(row.data_evento),
                    },
                    {
                      id: "tipo_evento",
                      title: "Evento",
                      accessor: (row) => formatTemplateEventLabel(row.tipo_evento),
                      sortable: true,
                      headerClassName: "whatsapp-template-events-table__col-evento",
                      render: (row) => (
                        <div className="whatsapp-template-events-table__event-label">
                          {formatTemplateEventLabel(row.tipo_evento)}
                        </div>
                      ),
                    },
                    {
                      id: "origem_evento",
                      title: "Origem",
                      accessor: (row) => row.origem_evento || "-",
                      sortable: true,
                      headerClassName: "whatsapp-template-events-table__col-origem",
                    },
                    {
                      id: "status_novo",
                      title: "Status novo",
                      accessor: (row) => row.status_novo || "-",
                      sortable: true,
                      headerClassName: "whatsapp-template-events-table__col-status",
                      render: (row) => (
                        row.status_novo ? (
                          <span className={normalizeStatusTone(row.status_novo)}>
                            {formatStatusLabel(row.status_novo)}
                          </span>
                        ) : "-"
                      ),
                    },
                    {
                      id: "usuario_responsavel",
                      title: "Responsavel",
                      accessor: (row) => row.usuario_responsavel || "-",
                      sortable: true,
                      headerClassName: "whatsapp-template-events-table__col-responsavel",
                    },
                  ]}
                />
              ) : (
                <div className="empty-state">Nenhum evento registrado para este template.</div>
              )}
            </section>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(templatePendenteExclusao)}
        title="Confirmar exclusao do rascunho"
        description="Revise a acao antes de remover o template. Essa exclusao vale apenas para rascunhos locais e nao pode ser desfeita."
        onClose={() => {
          if (!deletingId) {
            setTemplatePendenteExclusao(null);
          }
        }}
      >
        <div className="stack-md">
          <section className="surface-card surface-card--compact">
            <div className="stack-sm">
              <div className="result-box">
                <strong>Template selecionado</strong>
                <p>{templatePendenteExclusao?.nome_template_meta || "-"}</p>
              </div>
              <div className="result-box">
                <strong>Impacto da exclusao</strong>
                <p>O rascunho sera removido do Atlas/APISistemaAcme e deixara de aparecer na lista atual.</p>
              </div>
            </div>
          </section>

          <div className="table-actions">
            <button
              className="button button--ghost-neutral"
              type="button"
              disabled={Boolean(deletingId)}
              onClick={() => setTemplatePendenteExclusao(null)}
            >
              Cancelar
            </button>
            <button
              className="button button--danger"
              type="button"
              disabled={Boolean(deletingId)}
              onClick={() => void handleConfirmDeleteDraft()}
            >
              {deletingId ? "Apagando..." : "Confirmar exclusao"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
