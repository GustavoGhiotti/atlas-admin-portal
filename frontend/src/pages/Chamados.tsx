import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { hasAnyGroup } from "@/lib/permissions";
import {
  atualizarChamado,
  baixarEvidenciaChamado,
  criarDemandaPlataforma,
  criarChamado,
  excluirChamado,
  getApiError,
  listarChamados,
  listarDemandasAreas,
  listarDemandasPlataformas,
  listarDemandasTiposSolicitacao,
  listarUsuariosPermissoesPortal,
  type Chamado,
  type DemandaArea,
  type DemandaPlataforma,
  type DemandaTipoSolicitacao,
  type ListaChamadosResponse,
  type UsuarioPermissaoPortal,
} from "@/services/atlasApi";

type FiltroStatus = "all" | Chamado["status"];
type DevQueueScope = "all" | "mine";
type ChamadosViewMode = "dev" | "requester";
type TipoSolicitacao = "transferencia_arquivo" | "carga" | "outro";
type AreaTipo = "" | "interna" | "externa";
type BooleanChoice = boolean | null;
type DevWorkflowStatus =
  | "aberto"
  | "em_avaliacao_time"
  | "definicao_prazo"
  | "aguardando_informacoes"
  | "em_andamento"
  | "fase_testes"
  | "pausado"
  | "fechado";

type FormChamado = {
  areaTipo: AreaTipo;
  areaId: string;
  areaNome: string;
  tipoSolicitacaoId: string;
  tipoSolicitacaoNome: string;
  tipoSolicitacao: TipoSolicitacao;
  titulo: string;
  descricao: string;
  possuiSenha: BooleanChoice;
  senhas: string[];
  possuiLink: BooleanChoice;
  links: string[];
  possuiUsuarios: BooleanChoice;
  usuarios: string[];
  possuiCaminhos: BooleanChoice;
  caminhos: string[];
  evidencia: File[];
};

type DevChamadoForm = {
  workflowStatus: DevWorkflowStatus;
  subStatus: string;
  prioridade: Chamado["prioridade"];
  assignedToLogin: string;
  assignedToName: string;
  plataforma: string;
  dueDate: string;
  passoAtual: string;
  impedimento: string;
};

type DevHistoryEntry = {
  data: string;
  autor: string;
  workflowStatus: DevWorkflowStatus;
  subStatus: string;
  prioridade: Chamado["prioridade"];
  assignedToLogin: string;
  assignedToName: string;
  plataforma: string;
  dueDate: string;
  passoAtual: string;
  impedimento: string;
};

type RequesterInteractionEntry = {
  data: string;
  autor: string;
  mensagem: string;
};

const INITIAL_FORM: FormChamado = {
  areaTipo: "",
  areaId: "",
  areaNome: "",
  tipoSolicitacaoId: "",
  tipoSolicitacaoNome: "",
  tipoSolicitacao: "outro",
  titulo: "",
  descricao: "",
  possuiSenha: null,
  senhas: [""],
  possuiLink: null,
  links: [""],
  possuiUsuarios: null,
  usuarios: [""],
  possuiCaminhos: null,
  caminhos: [""],
  evidencia: [],
};

const INITIAL_DEV_FORM: DevChamadoForm = {
  workflowStatus: "aberto",
  subStatus: "",
  prioridade: "medium",
  assignedToLogin: "",
  assignedToName: "",
  plataforma: "",
  dueDate: "",
  passoAtual: "",
  impedimento: "",
};

export default function ChamadosPage() {
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [response, setResponse] = useState<ListaChamadosResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [pageError, setPageError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FiltroStatus>("all");
  const [devQueueScope, setDevQueueScope] = useState<DevQueueScope>("all");
  const [viewMode, setViewMode] = useState<ChamadosViewMode>(
    hasAnyGroup(user?.grupos ?? [], ["DESENVOLVIMENTO"]) ? "dev" : "requester",
  );
  const [form, setForm] = useState<FormChamado>(INITIAL_FORM);
  const [editingChamadoId, setEditingChamadoId] = useState<number | null>(null);
  const [requesterInfoDraft, setRequesterInfoDraft] = useState("");
  const [devForm, setDevForm] = useState<DevChamadoForm>(INITIAL_DEV_FORM);
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [devUsers, setDevUsers] = useState<UsuarioPermissaoPortal[]>([]);
  const [demandaAreas, setDemandaAreas] = useState<DemandaArea[]>([]);
  const [demandaTiposSolicitacao, setDemandaTiposSolicitacao] = useState<DemandaTipoSolicitacao[]>([]);
  const [demandaPlataformas, setDemandaPlataformas] = useState<DemandaPlataforma[]>([]);
  const [catalogosLoading, setCatalogosLoading] = useState(false);
  const [plataformaSearch, setPlataformaSearch] = useState("");
  const [showPlataformaOptions, setShowPlataformaOptions] = useState(false);

  const chamados = response?.itens ?? [];
  const normalizedCpf = normalizeCpf(user?.nu_cpf_colaborador ?? "");
  const normalizedLogin = String(user?.nm_login || "").trim().toLowerCase();
  const canReceiveChamados = hasAnyGroup(user?.grupos ?? [], ["DESENVOLVIMENTO"]);
  const isDevView = canReceiveChamados && viewMode === "dev";
  const isSolicitanteView = !canReceiveChamados || viewMode === "requester";
  const chamadosBase = isDevView
    ? chamados.filter((item) =>
        devQueueScope === "mine"
          ? String(getChamadoAssignedTo(item).login || "").trim().toLowerCase() === normalizedLogin
          : true,
      )
    : chamados.filter((item) => normalizeCpf(item.cpf_solicitante) === normalizedCpf);
  const filtered = chamadosBase.filter((item) => {
    if (statusFilter !== "all" && getChamadoFilterStatus(item) !== statusFilter) {
      return false;
    }

    return true;
  });
  const chamadosVisiveisOrdenados = filtered
    .slice()
    .sort((first, second) => new Date(second.criado_em).getTime() - new Date(first.criado_em).getTime());
  const selectedChamado = chamadosVisiveisOrdenados.find((item) => item.id === selectedId) ?? null;
  const resumoChamado = selectedChamado ?? chamadosVisiveisOrdenados[0] ?? null;
  const resumoChamadoIndex = resumoChamado ? chamadosVisiveisOrdenados.findIndex((item) => item.id === resumoChamado.id) : -1;
  const selectedChamadoSolicitacao = selectedChamado ? parseChamadoSolicitacao(selectedChamado.descricao) : null;
  const selectedChamadoComplementarGroups = buildChamadoComplementarGroups(selectedChamadoSolicitacao);
  const selectedChamadoHasImageEvidence = !!selectedChamado?.evidencia_mime?.toLowerCase().startsWith("image/");
  const areasFiltradas = demandaAreas.filter((item) => normalizeCatalogValue(item.tp_area) === form.areaTipo);
  const plataformaSearchText = plataformaSearch.trim();
  const plataformasFiltradas = demandaPlataformas.filter((item) =>
    normalizeCatalogValue(item.nm_plataforma).includes(normalizeCatalogValue(plataformaSearchText)),
  );
  const plataformaExiste = demandaPlataformas.some((item) => normalizeCatalogValue(item.nm_plataforma) === normalizeCatalogValue(plataformaSearchText));
  const etapaAreaTipoOk = !!form.areaTipo;
  const etapaAreaOk = !!form.areaId;
  const etapaTipoSolicitacaoOk = !!form.tipoSolicitacaoId;
  const resumoTemAtualizacao = !!resumoChamado && (
    (resumoChamado.atualizado_em && resumoChamado.atualizado_em !== resumoChamado.criado_em) ||
    resumoChamado.status !== "open"
  );
  const navigationFocusState = location.state as { focusChamadoId?: number; openDetail?: boolean } | null;

  useEffect(() => {
    void loadPage();
    void loadCatalogosChamado();
  }, []);

  useEffect(() => {
    if (!canReceiveChamados) {
      setViewMode("requester");
    }
  }, [canReceiveChamados]);

  useEffect(() => {
    if (!chamadosVisiveisOrdenados.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !chamadosVisiveisOrdenados.some((item) => item.id === selectedId)) {
      setSelectedId(chamadosVisiveisOrdenados[0].id);
    }
  }, [chamadosVisiveisOrdenados, selectedId]);

  useEffect(() => {
    if (!navigationFocusState?.focusChamadoId || !navigationFocusState.openDetail) {
      return;
    }

    const targetChamado = chamados.find((item) => item.id === navigationFocusState.focusChamadoId);
    if (!targetChamado) {
      return;
    }

    setSelectedId(targetChamado.id);
    setShowDetailModal(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [navigationFocusState, chamados, navigate, location.pathname]);

  useEffect(() => {
    if (!selectedChamado) {
      setEvidenceUrl("");
      setShowDetailModal(false);
      return;
    }

    if (selectedChamado.possui_evidencia) {
      void loadEvidence(selectedChamado.id);
    } else {
      setEvidenceUrl("");
    }
  }, [selectedChamado?.id]);

  useEffect(() => {
    if (!selectedChamado || !isDevView) {
      setDevForm(INITIAL_DEV_FORM);
      setPlataformaSearch("");
      setEditingHistoryIndex(null);
      return;
    }

    const parsed = parseChamadoDevData(selectedChamado.descricao);
    setDevForm({
      workflowStatus: parsed.workflowStatus || deriveWorkflowStatusFromChamado(selectedChamado),
      subStatus: parsed.subStatus,
      prioridade: selectedChamado.prioridade,
      assignedToLogin: parsed.assignedToLogin,
      assignedToName: parsed.assignedToName,
      plataforma: parsed.plataforma,
      dueDate: parsed.dueDate,
      passoAtual: parsed.passoAtual,
      impedimento: parsed.impedimento,
    });
    setPlataformaSearch(parsed.plataforma);
    setEditingHistoryIndex(null);
  }, [selectedChamado?.id, isDevView]);

  useEffect(() => {
    setRequesterInfoDraft("");
  }, [selectedChamado?.id, isSolicitanteView]);

  useEffect(() => {
    if (!isDevView) {
      setDevUsers([]);
      return;
    }

    void loadDevUsers();
  }, [isDevView]);

  useEffect(() => {
    return () => {
      if (evidenceUrl) {
        URL.revokeObjectURL(evidenceUrl);
      }
    };
  }, [evidenceUrl]);

  async function loadPage(preserveSelection = true) {
    setLoading(true);
    setPageError("");
    try {
      const chamadosData = await listarChamados();
      setResponse(chamadosData);
      setSelectedId((current) => {
        if (!preserveSelection || !current) {
          return chamadosData.itens[0]?.id ?? null;
        }
        return chamadosData.itens.some((item) => item.id === current) ? current : chamadosData.itens[0]?.id ?? null;
      });
    } catch (error) {
      const message = getApiError(error, "Não foi possível carregar os chamados.");
      setPageError(message);
      toast.error("Falha ao carregar", message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvidence(chamadoId: number) {
    setEvidenceLoading(true);
    try {
      const blob = await baixarEvidenciaChamado(chamadoId);
      const url = URL.createObjectURL(blob);
      setEvidenceUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return url;
      });
    } catch (error) {
      setEvidenceUrl("");
      toast.error("Falha na evidência", getApiError(error, "Não foi possível carregar a evidência."));
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function loadDevUsers() {
    try {
      const users = await listarUsuariosPermissoesPortal();
      setDevUsers(
        users
          .filter((item) => item.status === "ATIVO" && hasAnyGroup(item.grupos ?? [], ["DESENVOLVIMENTO"]))
          .sort((first, second) => first.nm_colaborador.localeCompare(second.nm_colaborador, "pt-BR")),
      );
    } catch (error) {
      toast.error("Falha ao carregar equipe", getApiError(error, "Não foi possível carregar a equipe de desenvolvimento."));
    }
  }

  async function loadCatalogosChamado() {
    setCatalogosLoading(true);
    try {
      const [areasData, tiposData, plataformasData] = await Promise.all([
        listarDemandasAreas(),
        listarDemandasTiposSolicitacao(),
        listarDemandasPlataformas(),
      ]);
      setDemandaAreas(areasData.itens);
      setDemandaTiposSolicitacao(tiposData.itens);
      setDemandaPlataformas(plataformasData.itens);
    } catch (error) {
      toast.error("Falha ao carregar cadastros", getApiError(error, "Nao foi possivel carregar os cadastros do chamado."));
    } finally {
      setCatalogosLoading(false);
    }
  }

  function updateForm<K extends keyof FormChamado>(key: K, value: FormChamado[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateFormList(key: "senhas" | "usuarios" | "links" | "caminhos", index: number, value: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  }

  function appendFormListItem(key: "senhas" | "usuarios" | "links" | "caminhos") {
    setForm((current) => ({
      ...current,
      [key]: [...current[key], ""],
    }));
  }

  function removeFormListItem(key: "senhas" | "usuarios" | "links" | "caminhos", index: number) {
    setForm((current) => {
      const nextItems = current[key].filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        [key]: nextItems.length ? nextItems : [""],
      };
    });
  }

  function handleAreaTipoChange(areaTipo: AreaTipo) {
    setForm((current) => ({
      ...current,
      areaTipo,
      areaId: "",
      areaNome: "",
    }));
  }

  function handleAreaChange(areaId: string) {
    const selectedArea = demandaAreas.find((item) => String(item.id_area) === areaId);
    setForm((current) => ({
      ...current,
      areaId,
      areaNome: selectedArea?.nm_area || "",
    }));
  }

  function handleTipoSolicitacaoChange(tipoSolicitacaoId: string) {
    const selectedTipo = demandaTiposSolicitacao.find((item) => String(item.id_tipo_solicitacao) === tipoSolicitacaoId);
    const tipoSolicitacao = mapCatalogTipoSolicitacaoToBackend(selectedTipo?.nm_tipo_solicitacao || "");
    const requiresMandatoryPaths = tipoSolicitacao === "transferencia_arquivo" || tipoSolicitacao === "carga";
    setForm((current) => ({
      ...current,
      tipoSolicitacaoId,
      tipoSolicitacaoNome: selectedTipo?.nm_tipo_solicitacao || "",
      tipoSolicitacao,
      possuiUsuarios: tipoSolicitacao === "outro" ? null : current.possuiUsuarios,
      possuiSenha: tipoSolicitacao === "outro" ? null : current.possuiSenha,
      possuiLink: tipoSolicitacao === "outro" ? null : current.possuiLink,
      possuiCaminhos: requiresMandatoryPaths ? true : current.possuiCaminhos,
      caminhos:
        requiresMandatoryPaths
          ? current.caminhos.length
            ? current.caminhos
            : [""]
          : current.caminhos,
    }));
  }

  function updateDevForm<K extends keyof DevChamadoForm>(key: K, value: DevChamadoForm[K]) {
    setDevForm((current) => {
      if (key === "workflowStatus") {
        const nextWorkflowStatus = value as DevWorkflowStatus;
        return {
          ...current,
          workflowStatus: nextWorkflowStatus,
          dueDate: requiresDueDate(nextWorkflowStatus) ? current.dueDate : "",
          impedimento: requiresImpedimento(nextWorkflowStatus) ? current.impedimento : "",
        };
      }

      return { ...current, [key]: value };
    });
  }

  function handleAssignToCurrentUser() {
    setDevForm((current) => ({
      ...current,
      assignedToLogin: user?.nm_login || "",
      assignedToName: user?.nm_colaborador || user?.nm_login || "",
    }));
  }

  function handleAssignedChange(login: string) {
    const selectedUser = devUsers.find((item) => item.nm_login === login);
    setDevForm((current) => ({
      ...current,
      assignedToLogin: login,
      assignedToName: selectedUser?.nm_colaborador || "",
    }));
  }

  function handlePlataformaSearchChange(value: string) {
    setPlataformaSearch(value);
    updateDevForm("plataforma", value);
    setShowPlataformaOptions(true);
  }

  function handlePlataformaSelect(value: string) {
    setPlataformaSearch(value);
    updateDevForm("plataforma", value);
    setShowPlataformaOptions(false);
  }

  async function handleCriarPlataforma() {
    const nmPlataforma = plataformaSearchText;
    if (!nmPlataforma || plataformaExiste) {
      return;
    }

    setBusy("platform-create");
    try {
      const created = await criarDemandaPlataforma({ nm_plataforma: nmPlataforma });
      setDemandaPlataformas((current) =>
        [...current, created].sort((first, second) => first.nm_plataforma.localeCompare(second.nm_plataforma, "pt-BR")),
      );
      handlePlataformaSelect(created.nm_plataforma);
      toast.success("Plataforma criada", `${created.nm_plataforma} foi adicionada ao cadastro.`);
    } catch (error) {
      toast.error("Falha ao criar plataforma", getApiError(error, "Nao foi possivel criar a plataforma."));
    } finally {
      setBusy("");
    }
  }

  function handleEditHistoryChange(value: string) {
    if (!selectedChamado || value === "") {
      setEditingHistoryIndex(null);
      const parsed = selectedChamado ? parseChamadoDevData(selectedChamado.descricao) : INITIAL_DEV_FORM;
      setDevForm({
        workflowStatus: selectedChamado ? parsed.workflowStatus || deriveWorkflowStatusFromChamado(selectedChamado) : INITIAL_DEV_FORM.workflowStatus,
        subStatus: selectedChamado ? parsed.subStatus : INITIAL_DEV_FORM.subStatus,
        prioridade: selectedChamado?.prioridade || INITIAL_DEV_FORM.prioridade,
        assignedToLogin: selectedChamado ? parsed.assignedToLogin : INITIAL_DEV_FORM.assignedToLogin,
        assignedToName: selectedChamado ? parsed.assignedToName : INITIAL_DEV_FORM.assignedToName,
        plataforma: selectedChamado ? parsed.plataforma : INITIAL_DEV_FORM.plataforma,
        dueDate: selectedChamado ? parsed.dueDate : INITIAL_DEV_FORM.dueDate,
        passoAtual: selectedChamado ? parsed.passoAtual : INITIAL_DEV_FORM.passoAtual,
        impedimento: selectedChamado ? parsed.impedimento : INITIAL_DEV_FORM.impedimento,
      });
      setPlataformaSearch(selectedChamado ? parsed.plataforma : "");
      return;
    }

    const index = Number(value);
    const historico = selectedChamado ? parseChamadoHistorico(selectedChamado.descricao) : [];
    const entry = historico[index];
    if (!entry) {
      return;
    }

    setEditingHistoryIndex(index);
    setDevForm({
      workflowStatus: entry.workflowStatus,
      subStatus: entry.subStatus,
      prioridade: entry.prioridade,
      assignedToLogin: entry.assignedToLogin,
      assignedToName: entry.assignedToName,
      plataforma: entry.plataforma,
      dueDate: entry.dueDate,
      passoAtual: entry.passoAtual === "Nao informado" ? "" : entry.passoAtual,
      impedimento: entry.impedimento === "Sem impedimento registrado" ? "" : entry.impedimento,
    });
    setPlataformaSearch(entry.plataforma);
  }

  function openCreateChamado() {
    setEditingChamadoId(null);
    setForm(INITIAL_FORM);
    setShowCreate(true);
  }

  function openRequesterEdit() {
    if (!selectedChamado) {
      return;
    }
    setEditingChamadoId(selectedChamado.id);
    setForm(buildFormFromChamado(selectedChamado, demandaAreas, demandaTiposSolicitacao));
    setShowCreate(true);
  }

  function closeCreateChamado() {
    setShowCreate(false);
    setEditingChamadoId(null);
    setForm(INITIAL_FORM);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateChamadoForm(form);
    if (validationError) {
      toast.error("Informações obrigatórias", validationError);
      return;
    }

    if (editingChamadoId !== null) {
      setBusy("create");
      try {
        const updated = await atualizarChamado(editingChamadoId, {
          descricao: buildDescricaoSolicitacaoComAtendimento(selectedChamado?.descricao ?? "", form),
        });
        setResponse((current) => {
          if (!current) return current;
          return {
            ...current,
            itens: current.itens.map((item) => (item.id === updated.id ? updated : item)),
          };
        });
        setSelectedId(updated.id);
        toast.success("Chamado atualizado", `Chamado #${updated.id} atualizado com sucesso.`);
        closeCreateChamado();
        await loadPage(true);
      } catch (error) {
        toast.error("Falha ao atualizar", getApiError(error, "Não foi possível salvar a alteração do chamado."));
      } finally {
        setBusy("");
      }
      return;
    }

    setBusy("create");
    try {
      const created = await criarChamado({
        titulo: form.titulo,
        descricao: buildDescricaoSolicitacao(form),
        tipo_solicitacao: form.tipoSolicitacao,
        prioridade: "medium",
        evidencia: form.evidencia,
      });
      toast.success("Chamado criado", `Chamado #${created.id} registrado com sucesso.`);
      setForm(INITIAL_FORM);
      setShowCreate(false);
      await loadPage(false);
      setSelectedId(created.id);
    } catch (error) {
      toast.error("Falha ao criar", getApiError(error, "Não foi possível criar o chamado."));
    } finally {
      setBusy("");
    }
  }

  async function handleDevUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChamado) {
      return;
    }

    if (requiresImpedimento(devForm.workflowStatus) && !devForm.impedimento.trim()) {
      toast.error("Impedimento obrigatório", "Informe o impedimento para continuar com esse status.");
      return;
    }

    if (requiresDueDate(devForm.workflowStatus) && !devForm.dueDate) {
      toast.error("Prazo obrigatório", "Informe a data prevista de finalização para continuar com esse status.");
      return;
    }

    if (devForm.plataforma.trim() && !demandaPlataformas.some((item) => normalizeCatalogValue(item.nm_plataforma) === normalizeCatalogValue(devForm.plataforma))) {
      toast.error("Plataforma nao cadastrada", "Selecione uma plataforma existente ou crie a nova antes de salvar.");
      return;
    }

    setBusy("update");
    try {
      const updated = await atualizarChamado(selectedChamado.id, {
        status: mapWorkflowStatusToBackendStatus(devForm.workflowStatus),
        prioridade: devForm.prioridade,
        descricao: buildChamadoDescricaoAtualizada(
          selectedChamado.descricao,
          devForm,
          user?.nm_colaborador || user?.nm_login || "Time de desenvolvimento",
          editingHistoryIndex,
        ),
      });

      setResponse((current) => {
        if (!current) return current;
        return {
          ...current,
          itens: current.itens.map((item) => (item.id === updated.id ? updated : item)),
        };
      });
      setSelectedId(updated.id);
      setEditingHistoryIndex(null);
      toast.success("Chamado atualizado", `Chamado #${updated.id} atualizado com sucesso.`);
      await loadPage(true);
    } catch (error) {
      toast.error("Falha ao atualizar", getApiError(error, "Não foi possível atualizar o chamado."));
    } finally {
      setBusy("");
    }
  }

  async function handleRequesterInfoUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChamado) {
      return;
    }

    if (!requesterInfoDraft.trim()) {
      toast.error("Informações obrigatórias", "Informe os dados solicitados antes de enviar.");
      return;
    }

    setBusy("requester-info");
    try {
      const updated = await atualizarChamado(selectedChamado.id, {
        descricao: buildChamadoDescricaoWithRequesterInteraction(
          selectedChamado.descricao,
          requesterInfoDraft,
          user?.nm_colaborador || user?.nm_login || "Solicitante",
        ),
      });

      setResponse((current) => {
        if (!current) return current;
        return {
          ...current,
          itens: current.itens.map((item) => (item.id === updated.id ? updated : item)),
        };
      });
      setRequesterInfoDraft("");
      toast.success("Informações enviadas", `Chamado #${updated.id} atualizado com sucesso.`);
      await loadPage(true);
    } catch (error) {
      toast.error("Falha ao enviar", getApiError(error, "Não foi possível enviar as informações para o chamado."));
    } finally {
      setBusy("");
    }
  }

  async function handleRequesterDelete() {
    if (!selectedChamado) {
      return;
    }

    const confirmed = window.confirm(`Deseja excluir o chamado #${selectedChamado.id} (${selectedChamado.titulo})?`);
    if (!confirmed) {
      return;
    }

    setBusy("requester-delete");
    try {
      await excluirChamado(selectedChamado.id);
      setResponse((current) => {
        if (!current) return current;
        return {
          ...current,
          itens: current.itens.filter((item) => item.id !== selectedChamado.id),
        };
      });
      setShowDetailModal(false);
      setSelectedId((current) => (current === selectedChamado.id ? null : current));
      toast.success("Chamado excluido", `Chamado #${selectedChamado.id} removido com sucesso.`);
      await loadPage(false);
    } catch (error) {
      toast.error("Falha ao excluir", getApiError(error, "Não foi possível excluir o chamado."));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="stack-md chamadev-page">
      <section className="surface-card chamadev-hero">
        <div className="chamadev-hero__grid">
          <div className="chamadev-hero__intro">
            <p className="eyebrow">Operacoes / Atlas</p>
            <div className="chamadev-hero__title-row">
              <h1>ChamaDev</h1>
              {canReceiveChamados ? (
                <div className="chamadev-view-switch">
                  <span>Visualização</span>
                  <div className="chamadev-quick-filters" role="tablist" aria-label="Alternar visualização do ChamaDev">
                    {[
                      { value: "dev" as ChamadosViewMode, label: "Time dev" },
                      { value: "requester" as ChamadosViewMode, label: "Solicitante" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        className={`chamadev-quick-filters__item${viewMode === item.value ? " chamadev-quick-filters__item--active" : ""}`}
                        type="button"
                        onClick={() => setViewMode(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="chamadev-hero__description">
              {canReceiveChamados && isDevView
                ? "Triagem e acompanhamento das demandas com foco em leitura rapida, prioridade e resolucao."
                : "Abra demandas com contexto claro, acompanhe retornos sem ruído e mantenha suas solicitacoes organizadas em um fluxo unico."}
            </p>
            <div
              className="chamadev-hero__actions chamadev-hero__actions--inline chamadev-hero__actions--centered"
            >
              <div className="chamadev-quick-filters" role="tablist" aria-label="Filtros de chamados">
                {[
                  { value: "all" as FiltroStatus, label: "Todos", count: chamadosBase.length },
                  { value: "open" as FiltroStatus, label: "Abertos", count: chamadosBase.filter((item) => getChamadoFilterStatus(item) === "open").length },
                  { value: "in_progress" as FiltroStatus, label: "Em Andamento", count: chamadosBase.filter((item) => getChamadoFilterStatus(item) === "in_progress").length },
                  { value: "closed" as FiltroStatus, label: "Fechados", count: chamadosBase.filter((item) => getChamadoFilterStatus(item) === "closed").length },
                ].map((item) => (
                  <button
                    key={item.value}
                    className={`chamadev-quick-filters__item${statusFilter === item.value ? " chamadev-quick-filters__item--active" : ""}`}
                    type="button"
                    onClick={() => setStatusFilter(item.value)}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="chamadev-hero__toolbar">
            <article className="chamadev-summary-card">
                <div className="chamadev-summary-card__header">
                  <button
                    className="icon-button chamadev-summary-card__nav"
                    type="button"
                    aria-label="Chamado anterior"
                    disabled={resumoChamadoIndex <= 0}
                    onClick={() => setSelectedId(chamadosVisiveisOrdenados[resumoChamadoIndex - 1]?.id ?? null)}
                  >
                    ←
                  </button>
                  <div>
                    <p className="eyebrow">{isDevView ? "Fila de atendimento" : "Acompanhamento rapido"}</p>
                    <h2>{resumoChamado ? resumoChamado.titulo : isDevView ? "Nenhum chamado em foco" : "Nenhum chamado selecionado"}</h2>
                  </div>
                  <button
                    className="icon-button chamadev-summary-card__nav"
                    type="button"
                    aria-label="Proximo chamado"
                    disabled={resumoChamadoIndex >= chamadosVisiveisOrdenados.length - 1}
                    onClick={() => setSelectedId(chamadosVisiveisOrdenados[resumoChamadoIndex + 1]?.id ?? null)}
                  >
                    →
                  </button>
                </div>
                <div className="chamadev-summary-card__meta">
                  <div>
                    <span>{isDevView ? "Solicitante" : "Aberto em"}</span>
                    <strong>{resumoChamado ? (isDevView ? resumoChamado.solicitante : formatDate(resumoChamado.criado_em)) : "-"}</strong>
                  </div>
                  {isDevView ? (
                    <div>
                      <span>Solicitado em</span>
                      <strong>{resumoChamado ? formatDateTimeShort(resumoChamado.criado_em) : "-"}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Status</span>
                    <strong>
                      {resumoChamado ? (
                        <span className={`status-pill status-pill--${getChamadoDisplayStatusTone(resumoChamado)}`}>
                          {getChamadoDisplayStatusLabel(resumoChamado)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </strong>
                  </div>
                  {isDevView && resumoChamado && shouldDisplayPriority(resumoChamado) ? (
                    <div>
                      <span>Prioridade</span>
                      <strong>
                        <span className={`status-pill status-pill--${priorityTone(resumoChamado.prioridade)}`}>{priorityLabel(resumoChamado.prioridade)}</span>
                      </strong>
                    </div>
                  ) : resumoChamado?.status === "closed" ? (
                    <div>
                      <span>Finalizado em</span>
                      <strong>{formatDate(resumoChamado.atualizado_em || resumoChamado.criado_em)}</strong>
                    </div>
                  ) : null}
                </div>
                <div className="chamadev-summary-card__actions">
                  <button
                    className="button"
                    type="button"
                    disabled={!resumoChamado}
                    onClick={() => {
                      if (!resumoChamado) return;
                      setSelectedId(resumoChamado.id);
                      setShowDetailModal(true);
                    }}
                  >
                    {resumoChamado ? "Visualizar" : "Abrir"}
                  </button>
                  {isDevView ? (
                    <button className="button button--secondary" type="button" onClick={() => void loadPage(true)} disabled={loading}>
                      {loading ? "Atualizando..." : "Atualizar fila"}
                    </button>
                  ) : null}
                </div>
              </article>
          </div>
        </div>

      </section>

      {showCreate && isSolicitanteView ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCreateChamado}>
          <div className="modal chamados-create-modal" role="dialog" aria-modal="true" aria-labelledby="chamado-create-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div className="chamados-modal__header-main">
                <p className="eyebrow">{editingChamadoId !== null ? "Editar chamado" : "Novo registro"}</p>
              </div>
              <button className="alteracoes-modal__close" type="button" aria-label="Fechar novo chamado" onClick={closeCreateChamado}>
                <span>×</span>
              </button>
            </div>
            <div className="modal__body">
              <form className="form-grid form-grid--two chamadev-create-form" onSubmit={handleCreate}>
              <div className="field field--full chamadev-create-steps" aria-label="Etapas do chamado">
                <span className={`chamadev-create-steps__item${etapaAreaTipoOk ? " chamadev-create-steps__item--done" : " chamadev-create-steps__item--active"}`}>1. Tipo da area</span>
                <span className={`chamadev-create-steps__item${etapaAreaOk ? " chamadev-create-steps__item--done" : etapaAreaTipoOk ? " chamadev-create-steps__item--active" : ""}`}>2. Area</span>
                <span className={`chamadev-create-steps__item${etapaTipoSolicitacaoOk ? " chamadev-create-steps__item--done" : etapaAreaOk ? " chamadev-create-steps__item--active" : ""}`}>3. Solicitacao</span>
              </div>
              <label className="field">
                <span>Tipo da area</span>
                <select value={form.areaTipo} onChange={(event) => handleAreaTipoChange(event.target.value as AreaTipo)} disabled={catalogosLoading}>
                  <option value="">Selecione</option>
                  <option value="interna">Interna</option>
                  <option value="externa">Externa</option>
                </select>
              </label>
              {etapaAreaTipoOk ? (
                <label className="field">
                  <span>Area</span>
                  <select value={form.areaId} onChange={(event) => handleAreaChange(event.target.value)} disabled={catalogosLoading || !areasFiltradas.length}>
                    <option value="">{areasFiltradas.length ? "Selecione" : "Nenhuma area encontrada"}</option>
                    {areasFiltradas.map((area) => (
                      <option key={area.id_area} value={area.id_area}>
                        {area.nm_area}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {etapaAreaOk ? (
                <>
              <label className="field">
                <span>Tipo de solicitação</span>
                <select value={form.tipoSolicitacaoId} onChange={(event) => handleTipoSolicitacaoChange(event.target.value)} disabled={catalogosLoading || !demandaTiposSolicitacao.length}>
                  <option value="">{demandaTiposSolicitacao.length ? "Selecione" : "Nenhum tipo encontrado"}</option>
                  {demandaTiposSolicitacao.map((tipo) => (
                    <option key={tipo.id_tipo_solicitacao} value={tipo.id_tipo_solicitacao}>
                      {tipo.nm_tipo_solicitacao}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Título</span>
                <input value={form.titulo} onChange={(event) => updateForm("titulo", event.target.value)} placeholder={getTituloPlaceholder(form.tipoSolicitacao)} />
              </label>
              <label className="field field--full">
                <span>Descrição</span>
                <textarea rows={7} value={form.descricao} onChange={(event) => updateForm("descricao", event.target.value)} placeholder={getDescricaoPlaceholder(form.tipoSolicitacao)} />
              </label>
              {form.tipoSolicitacao !== "outro" ? (
              <div className="field field--full chamadev-guided-fields">
                  <span>Informações complementares</span>
                <div className="chamadev-guided-fields__grid">
                    {form.tipoSolicitacao === "transferencia_arquivo" || form.tipoSolicitacao === "carga" ? (
                      <>
                        <div className="field chamadev-guided-fields__checkbox chamadev-guided-fields__checkbox--static">
                          <span className="field-label-with-help field-help-wrap chamadev-guided-fields__label">
                            Caminhos obrigatórios
                            <HelpBadge text={form.tipoSolicitacao === "carga" ? "Para carga, informe os caminhos, pastas ou localizações usadas no processo." : "Para transferência de arquivo, informe os caminhos de origem e destino usados no processo."} />
                          </span>
                          <p className="muted chamadev-guided-fields__static-copy">
                            Neste tipo de solicitação, os caminhos são obrigatórios e já fazem parte do registro.
                          </p>
                        </div>
                        <div className="field chamadev-guided-fields__multi">
                          <span>Caminhos</span>
                          <div className="chamadev-guided-fields__stack">
                            {form.caminhos.map((caminho, index) => (
                              <div key={`caminho-transferencia-${index}`} className="chamadev-guided-fields__row">
                                <input
                                  value={caminho}
                                  onChange={(event) => updateFormList("caminhos", index, event.target.value)}
                                  placeholder={`Informe caminho ${index + 1}`}
                                />
                                {form.caminhos.length > 1 ? (
                                  <button className="button button--ghost-neutral" type="button" onClick={() => removeFormListItem("caminhos", index)}>
                                    Remover
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                          <button className="button button--ghost-neutral" type="button" onClick={() => appendFormListItem("caminhos")}>
                            + Adicionar caminho
                          </button>
                        </div>
                      </>
                    ) : null}
                    <label className="field chamadev-guided-fields__checkbox">
                      <span className="field-label-with-help field-help-wrap chamadev-guided-fields__label">
                        Possui usuários?
                        <HelpBadge text="Insira o usuário de acesso para SFTP, site ou para o que for necessário nesta solicitação." />
                      </span>
                      <div className="chamadev-boolean-group" role="radiogroup" aria-label="Possui usuários">
                        <label className={`chamadev-boolean-option${form.possuiUsuarios ? " chamadev-boolean-option--active" : ""}`}>
                          <input
                            type="radio"
                            name="possuiUsuarios"
                            checked={form.possuiUsuarios === true}
                            onChange={() => {
                              updateForm("possuiUsuarios", true);
                              if (!form.usuarios.length) {
                                updateForm("usuarios", [""]);
                              }
                            }}
                          />
                          <span>Sim</span>
                        </label>
                        <label className={`chamadev-boolean-option${form.possuiUsuarios === false ? " chamadev-boolean-option--active" : ""}`}>
                          <input
                            type="radio"
                            name="possuiUsuarios"
                            checked={form.possuiUsuarios === false}
                            onChange={() => {
                              updateForm("possuiUsuarios", false);
                              updateForm("usuarios", [""]);
                            }}
                          />
                          <span>Nao</span>
                        </label>
                      </div>
                    </label>
                    {form.possuiUsuarios ? (
                      <div className="field chamadev-guided-fields__multi">
                          <span>Usuários</span>
                        <div className="chamadev-guided-fields__stack">
                          {form.usuarios.map((usuario, index) => (
                            <div key={`usuario-${index}`} className="chamadev-guided-fields__row">
                              <input
                                value={usuario}
                                onChange={(event) => updateFormList("usuarios", index, event.target.value)}
                                  placeholder={`Informe usuário ${index + 1}`}
                              />
                              {form.usuarios.length > 1 ? (
                                <button className="button button--ghost-neutral" type="button" onClick={() => removeFormListItem("usuarios", index)}>
                                  Remover
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <button className="button button--ghost-neutral" type="button" onClick={() => appendFormListItem("usuarios")}>
                            + Adicionar usuário
                        </button>
                      </div>
                    ) : null}
                    <label className="field chamadev-guided-fields__checkbox">
                      <span className="field-label-with-help field-help-wrap chamadev-guided-fields__label">
                        Possui senha?
                        <HelpBadge text="Se existir senha relacionada ao acesso informado, registre aqui para que o time consiga validar e seguir com a solicitação." />
                      </span>
                      <div className="chamadev-boolean-group" role="radiogroup" aria-label="Possui senha">
                        <label className={`chamadev-boolean-option${form.possuiSenha ? " chamadev-boolean-option--active" : ""}`}>
                          <input
                            type="radio"
                            name="possuiSenha"
                            checked={form.possuiSenha === true}
                            onChange={() => {
                              updateForm("possuiSenha", true);
                              if (!form.senhas.length) {
                                updateForm("senhas", [""]);
                              }
                            }}
                          />
                          <span>Sim</span>
                        </label>
                        <label className={`chamadev-boolean-option${form.possuiSenha === false ? " chamadev-boolean-option--active" : ""}`}>
                          <input
                            type="radio"
                            name="possuiSenha"
                            checked={form.possuiSenha === false}
                            onChange={() => {
                              updateForm("possuiSenha", false);
                              updateForm("senhas", [""]);
                            }}
                          />
                          <span>Nao</span>
                        </label>
                      </div>
                    </label>
                    {form.possuiSenha ? (
                      <div className="field chamadev-guided-fields__multi">
                        <span>Senha</span>
                        <div className="chamadev-guided-fields__stack">
                          {form.senhas.map((senha, index) => (
                            <div key={`senha-${index}`} className="chamadev-guided-fields__row">
                              <input
                                value={senha}
                                onChange={(event) => updateFormList("senhas", index, event.target.value)}
                                placeholder={`Informe a senha ${index + 1}`}
                                required={form.possuiSenha && index === 0}
                              />
                              {form.senhas.length > 1 ? (
                                <button className="button button--ghost-neutral" type="button" onClick={() => removeFormListItem("senhas", index)}>
                                  Remover
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <button className="button button--ghost-neutral" type="button" onClick={() => appendFormListItem("senhas")}>
                          + Adicionar senha
                        </button>
                      </div>
                    ) : null}
                    <label className="field chamadev-guided-fields__checkbox">
                      <span className="field-label-with-help field-help-wrap chamadev-guided-fields__label">
                        Possui link?
                        <HelpBadge text="Inclua o link da página, ambiente, pasta ou recurso relacionado a esta solicitação, quando houver." />
                      </span>
                      <div className="chamadev-boolean-group" role="radiogroup" aria-label="Possui link">
                        <label className={`chamadev-boolean-option${form.possuiLink ? " chamadev-boolean-option--active" : ""}`}>
                          <input
                            type="radio"
                            name="possuiLink"
                            checked={form.possuiLink === true}
                            onChange={() => updateForm("possuiLink", true)}
                          />
                          <span>Sim</span>
                        </label>
                        <label className={`chamadev-boolean-option${form.possuiLink === false ? " chamadev-boolean-option--active" : ""}`}>
                          <input
                            type="radio"
                            name="possuiLink"
                            checked={form.possuiLink === false}
                            onChange={() => {
                              updateForm("possuiLink", false);
                              updateForm("links", [""]);
                            }}
                          />
                          <span>Nao</span>
                        </label>
                      </div>
                    </label>
                    {form.possuiLink ? (
                      <div className="field chamadev-guided-fields__multi">
                        <span>Link</span>
                        <div className="chamadev-guided-fields__stack">
                          {form.links.map((link, index) => (
                            <div key={`link-${index}`} className="chamadev-guided-fields__row">
                              <input
                                value={link}
                                onChange={(event) => updateFormList("links", index, event.target.value)}
                                placeholder={`Cole aqui o link ${index + 1}`}
                              />
                              {form.links.length > 1 ? (
                                <button className="button button--ghost-neutral" type="button" onClick={() => removeFormListItem("links", index)}>
                                  Remover
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <button className="button button--ghost-neutral" type="button" onClick={() => appendFormListItem("links")}>
                          + Adicionar link
                        </button>
                      </div>
                    ) : null}
                    {form.tipoSolicitacao !== "transferencia_arquivo" && form.tipoSolicitacao !== "carga" ? (
                      <>
                        <label className="field chamadev-guided-fields__checkbox">
                          <span className="field-label-with-help field-help-wrap chamadev-guided-fields__label">
                            Possui caminhos?
                            <HelpBadge text="Informe caminhos de pasta, rede, servidor ou localizacoes usadas no processo para orientar melhor o atendimento." />
                          </span>
                          <div className="chamadev-boolean-group" role="radiogroup" aria-label="Possui caminhos">
                            <label className={`chamadev-boolean-option${form.possuiCaminhos ? " chamadev-boolean-option--active" : ""}`}>
                              <input
                                type="radio"
                                name="possuiCaminhos"
                                checked={form.possuiCaminhos === true}
                                onChange={() => updateForm("possuiCaminhos", true)}
                              />
                              <span>Sim</span>
                            </label>
                            <label className={`chamadev-boolean-option${form.possuiCaminhos === false ? " chamadev-boolean-option--active" : ""}`}>
                              <input
                                type="radio"
                                name="possuiCaminhos"
                                checked={form.possuiCaminhos === false}
                                onChange={() => {
                                  updateForm("possuiCaminhos", false);
                                  updateForm("caminhos", [""]);
                                }}
                              />
                              <span>Nao</span>
                            </label>
                          </div>
                        </label>
                        {form.possuiCaminhos ? (
                          <div className="field chamadev-guided-fields__multi">
                            <span>Caminhos</span>
                            <div className="chamadev-guided-fields__stack">
                              {form.caminhos.map((caminho, index) => (
                                <div key={`caminho-${index}`} className="chamadev-guided-fields__row">
                                  <input
                                    value={caminho}
                                    onChange={(event) => updateFormList("caminhos", index, event.target.value)}
                                    placeholder={`Informe caminho ${index + 1}`}
                                  />
                                  {form.caminhos.length > 1 ? (
                                    <button className="button button--ghost-neutral" type="button" onClick={() => removeFormListItem("caminhos", index)}>
                                      Remover
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                            <button className="button button--ghost-neutral" type="button" onClick={() => appendFormListItem("caminhos")}>
                              + Adicionar caminho
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                </div>
              </div>
              ) : null}
              {editingChamadoId === null ? (
                <label className="field field--full chamadev-create-form__file-field">
                  <span>Evidência</span>
                  <input
                    type="file"
                    multiple
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      updateForm("evidencia", Array.from(event.target.files ?? []))
                    }
                  />
                </label>
              ) : null}
              <div className="chamadev-create-form__footer field--full">
                <div className="page-header__actions chamadev-create-card__actions">
                  <button className="button" type="submit" disabled={busy === "create"}>
                    {busy === "create"
                      ? editingChamadoId !== null
                        ? "Salvando..."
                        : "Criando..."
                      : editingChamadoId !== null
                        ? "Salvar alteração"
                        : "Registrar chamado"}
                  </button>
                </div>
              </div>
                </>
              ) : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <section className="surface-card surface-card--compact">Carregando chamados...</section>
      ) : pageError ? (
        <section className="surface-card surface-card--compact">
          <div className="alert alert--danger">{pageError}</div>
        </section>
      ) : (
        <section className="chamados-layout chamados-layout--single">
          <div className="surface-card chamados-list-panel">
            <div className="chamados-list-panel__header">
              <div className="chamados-list-panel__header-main">
                <p className="eyebrow">{isDevView ? "Fila de atendimento" : "Meus chamados"}</p>
                <p className="muted chamados-list-panel__description">
                  {isDevView
                    ? "Receba, priorize e acompanhe os chamados enviados para o time de desenvolvimento."
                    : "Acompanhe seus chamados e consulte rapidamente o status de cada um."}
                </p>
              </div>
              <div className="page-header__actions chamados-list-panel__actions">
                {isDevView ? (
                  <div className="chamadev-quick-filters" role="tablist" aria-label="Escopo da fila">
                    {[
                      { value: "all" as DevQueueScope, label: "Todos chamados" },
                      { value: "mine" as DevQueueScope, label: "Meus chamados" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        className={`chamadev-quick-filters__item${devQueueScope === item.value ? " chamadev-quick-filters__item--active" : ""}`}
                        type="button"
                        onClick={() => setDevQueueScope(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {isSolicitanteView ? (
                  <button className="button" type="button" onClick={() => (showCreate ? closeCreateChamado() : openCreateChamado())} disabled={!isSolicitanteView}>
                    {showCreate ? "Fechar formulario" : "Novo chamado"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="chamados-list">
              {filtered.length ? (
                chamadosVisiveisOrdenados.map((item) => (
                  <button
                    key={item.id}
                    className={`chamado-card${selectedId === item.id ? " chamado-card--active" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setShowDetailModal(true);
                    }}
                  >
                    <div className="chamado-card__top">
                      <strong className="chamado-card__title">{item.titulo}</strong>
                      <div className="chamado-card__badges">
                        {isDevView && shouldDisplayPriority(item) ? (
                          <span className={`status-pill status-pill--${priorityTone(item.prioridade)}`}>{priorityLabel(item.prioridade)}</span>
                        ) : null}
                        <span className={`status-pill status-pill--${getChamadoDisplayStatusTone(item)}`}>
                          {getChamadoDisplayStatusLabel(item)}
                        </span>
                      </div>
                    </div>
                    <div className="chamado-card__summary">
                      <span className="chamado-card__summary-label">Resumo da solicitação:</span>
                      <p className="chamado-card__description">{parseChamadoSolicitacao(item.descricao).textoPrincipal || item.descricao}</p>
                    </div>
                    <div className="chamado-card__meta">
                      <span>Solicitante: {item.solicitante}</span>
                      <span>Setor: {item.setor_solicitante || "Não informado"}</span>
                      <span>Horário da solicitação: {formatDateTimeShort(item.criado_em)}</span>
                    </div>
                    <div className="chamado-card__footer">
                      <span>Responsável: {getChamadoAssignedTo(item).name || "Não atribuído"}</span>
                      {isDevView ? <span>Plataforma: {getChamadoPlatform(item) || "Não definida"}</span> : null}
                      <span>{isDevView ? `Última movimentação: ${formatDate(item.atualizado_em || item.criado_em)}` : `Última atualização: ${formatDateWithYear(item.atualizado_em || item.criado_em)}`}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-state">Nenhum chamado encontrado para os filtros aplicados.</div>
              )}
            </div>
          </div>

        </section>
      )}

      {showDetailModal && selectedChamado ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowDetailModal(false)}>
          <div className="modal chamados-modal" role="dialog" aria-modal="true" aria-labelledby="chamado-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <div className="chamados-modal__header-main">
                <p className="eyebrow">Detalhe</p>
                <h2 id="chamado-modal-title">{selectedChamado.titulo}</h2>
                <div className="chamados-modal__header-meta">
                  <span>Solicitante: {selectedChamado.solicitante}</span>
                  <span>Setor: {selectedChamado.setor_solicitante || "Não informado"}</span>
                  <span>Responsável: {getChamadoAssignedTo(selectedChamado).name || "Não atribuído"}</span>
                  {isDevView ? <span>Plataforma: {getChamadoPlatform(selectedChamado) || "Não definida"}</span> : null}
                  <span>Solicitado em: {formatDate(selectedChamado.criado_em)}</span>
                </div>
              </div>
              <div className="chamados-modal__header-actions">
                <div className="chamadev-detail__badges chamados-modal__header-badges">
                  <span className={`status-pill status-pill--${getChamadoDisplayStatusTone(selectedChamado)}`}>
                    {getChamadoDisplayStatusLabel(selectedChamado)}
                  </span>
                  {isDevView && shouldDisplayPriority(selectedChamado) ? (
                    <span className={`status-pill status-pill--${priorityTone(selectedChamado.prioridade)}`}>{priorityLabel(selectedChamado.prioridade)}</span>
                  ) : null}
                </div>
                <button className="alteracoes-modal__close" type="button" aria-label="Fechar detalhes" onClick={() => setShowDetailModal(false)}>
                  <span>×</span>
                </button>
              </div>
            </div>

            <div className="modal__body">
              <div className={`chamados-modal__layout${isSolicitanteView ? " chamados-modal__layout--single" : ""}`}>
                <div className="chamados-modal__main">
                  <div className="surface-card surface-card--compact chamados-description-card chamados-modal__panel">
                    <div className="section-header chamados-description-card__header">
                      <div>
                        <p className="eyebrow">
                          Solicitação
                          {getChamadoTipoSolicitacaoDisplay(selectedChamadoSolicitacao) ? (
                            <span className="chamados-description-card__eyebrow-type">
                              {" - "}
                              {getChamadoTipoSolicitacaoDisplay(selectedChamadoSolicitacao)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {isSolicitanteView && getChamadoWorkflowStatus(selectedChamado) === "aberto" ? (
                        <div className="page-header__actions chamados-description-card__actions">
                          <button className="button button--secondary" type="button" onClick={openRequesterEdit}>
                            Editar chamado
                          </button>
                          <button
                            className="button button--danger"
                            type="button"
                            onClick={() => void handleRequesterDelete()}
                            disabled={busy === "requester-delete"}
                          >
                            {busy === "requester-delete" ? "Excluindo..." : "Excluir chamado"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="chamados-description-card__content">
                      <div className="chamados-description-card__box">
                        <span className="chamados-description-card__box-label">Texto enviado</span>
                        <p className="muted chamados-description">{selectedChamadoSolicitacao?.textoPrincipal || "-"}</p>
                      </div>
                      {selectedChamadoComplementarGroups.length ? (
                        <div className="chamados-description-card__box">
                          <span className="chamados-description-card__box-label">Informações complementares</span>
                          <div className="chamados-description-card__complementares">
                            {selectedChamadoComplementarGroups.map((group) => (
                              <div key={group.label} className="chamados-description-card__complementar-group">
                                <strong className="chamados-description-card__complementar-title">{group.label}:</strong>
                                <div className="chamados-description-card__complementar-items">
                                  {group.items.map((item) => (
                                    <span key={`${group.label}-${item}`} className="chamados-description-card__complementar-item">
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="chamados-timeline-card chamados-modal__panel">
                    <div className="section-header">
                      <div>
                        <p className="eyebrow">Andamento</p>
                      </div>
                    </div>
                    <div className="chamados-timeline">
                      {buildChamadoTimelineDisplay(selectedChamado).map((entry, index) => (
                        <article key={`${entry.data}-${index}`} className="chamados-timeline__item chamados-timeline__item--done">
                          <span className="chamados-timeline__dot" />
                          <div className="chamados-timeline__content">
                            <div className="chamados-timeline__heading">
                              <strong>{entry.titulo}</strong>
                              {isDevView && entry.editIndex !== null ? (
                                <button
                                  className="button button--ghost-neutral chamados-timeline__edit"
                                  type="button"
                                  onClick={() => handleEditHistoryChange(String(entry.editIndex))}
                                >
                                  Editar
                                </button>
                              ) : null}
                            </div>
                            <p>{entry.descricao}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  {isSolicitanteView && getChamadoWorkflowStatus(selectedChamado) === "aguardando_informacoes" ? (
                    <div className="surface-card surface-card--compact chamados-modal__panel">
                      <div className="section-header">
                        <div>
                          <p className="eyebrow">Retorno</p>
                        </div>
                      </div>
                      <form className="stack-sm" onSubmit={handleRequesterInfoUpdate}>
                        <label className="field chamados-modal__field">
                          <span>Informações para continuidade</span>
                          <textarea
                            rows={6}
                            value={requesterInfoDraft}
                            onChange={(event) => setRequesterInfoDraft(event.target.value)}
                            placeholder="Descreva aqui as informações solicitadas para o chamado continuar."
                          />
                        </label>
                        <div className="page-header__actions chamados-modal__actions">
                          <button className="button" type="submit" disabled={busy === "requester-info"}>
                            {busy === "requester-info" ? "Enviando..." : "Enviar informações"}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : null}

                  {selectedChamado.possui_evidencia ? (
                    <div className="chamados-evidence chamados-modal__panel">
                      <div className="section-header">
                        <div>
                          <p className="eyebrow">Anexo</p>
                          <h2>Evidência</h2>
                        </div>
                        {evidenceUrl ? (
                          <div className="page-header__actions chamados-evidence__actions">
                            <a
                              className="button button--secondary"
                              href={evidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={selectedChamado.evidencia_nome || "anexo"}
                            >
                              {selectedChamadoHasImageEvidence ? "Abrir anexo" : "Baixar anexo"}
                            </a>
                          </div>
                        ) : null}
                      </div>
                      {evidenceLoading ? (
                        <div className="page-loader">Carregando evidência...</div>
                      ) : evidenceUrl ? (
                        <div className="chamados-evidence-card">
                          {selectedChamadoHasImageEvidence ? (
                            <img className="chamados-evidence-image" src={evidenceUrl} alt={selectedChamado.evidencia_nome || "Evidência do chamado"} />
                          ) : (
                            <div className="chamados-evidence-file">
                              <strong>{selectedChamado.evidencia_nome || "Arquivo anexado"}</strong>
                              <span className="muted">{selectedChamado.evidencia_mime || "Arquivo"}</span>
                              {selectedChamado.evidencia_tamanho ? (
                                <span className="muted">{formatFileSize(selectedChamado.evidencia_tamanho)}</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="empty-state">O anexo existe, mas não foi possível exibi-lo agora.</div>
                      )}
                    </div>
                  ) : null}
                </div>

                {isDevView ? (
                  <aside className="chamados-modal__sidebar">
                    <form className="chamados-modal__properties chamados-modal__panel" onSubmit={handleDevUpdate}>
                      <div className="section-header">
                        <div>
                          <p className="eyebrow">Controle</p>
                        </div>
                      </div>
                      <div className="chamados-modal__property-list">
                        {parseChamadoHistorico(selectedChamado.descricao).length ? (
                          <label className="field chamados-modal__field">
                            <span>Editar andamento</span>
                            <select value={editingHistoryIndex ?? ""} onChange={(event) => handleEditHistoryChange(event.target.value)}>
                              <option value="">Novo registro</option>
                              {parseChamadoHistorico(selectedChamado.descricao)
                                .slice()
                                .reverse()
                                .map((entry, reverseIndex, reversedItems) => {
                                  const originalIndex = reversedItems.length - 1 - reverseIndex;
                                  return (
                                    <option key={`${entry.data}-${originalIndex}`} value={originalIndex}>
                                      {workflowStatusLabel(entry.workflowStatus)} - {formatDate(entry.data)}
                                    </option>
                                  );
                                })}
                            </select>
                          </label>
                        ) : null}
                        <label className="field chamados-modal__field">
                          <span>Status</span>
                          <select value={devForm.workflowStatus} onChange={(event) => updateDevForm("workflowStatus", event.target.value as DevWorkflowStatus)}>
                            <option value="aberto">Aberto</option>
                            <option value="em_andamento">Em andamento</option>
                            <option value="fase_testes">Fase de testes</option>
                            <option value="fechado">Fechado</option>
                            <option value="pausado">Pausado</option>
                            <option value="em_avaliacao_time">Em avaliação do time</option>
                            <option value="definicao_prazo">Definição de prazo</option>
                            <option value="aguardando_informacoes">Aguardando informações</option>
                          </select>
                        </label>
                        <label className="field chamados-modal__field">
                          <span>Sub status (opcional)</span>
                          <input
                            value={devForm.subStatus}
                            onChange={(event) => updateDevForm("subStatus", event.target.value)}
                            placeholder="Ex.: Aguardando SFTP, Em validação com o cliente"
                          />
                        </label>
                        {shouldShowPriorityField(devForm.workflowStatus) ? (
                          <label className="field chamados-modal__field">
                            <span>Prioridade</span>
                            <select value={devForm.prioridade} onChange={(event) => updateDevForm("prioridade", event.target.value as Chamado["prioridade"])}>
                              <option value="low">Baixa</option>
                              <option value="medium">Média</option>
                              <option value="high">Alta</option>
                              <option value="urgent">Urgente</option>
                            </select>
                          </label>
                        ) : null}
                        {requiresDueDate(devForm.workflowStatus) ? (
                          <label className="field chamados-modal__field">
                            <span>Data prevista de finalização</span>
                            <input type="date" value={devForm.dueDate} onChange={(event) => updateDevForm("dueDate", event.target.value)} />
                          </label>
                        ) : null}
                        <label className="field chamados-modal__field">
                          <span>Responsável</span>
                          <select value={devForm.assignedToLogin} onChange={(event) => handleAssignedChange(event.target.value)}>
                            <option value="">Não atribuído</option>
                            {devUsers.map((item) => (
                              <option key={item.id_usuario} value={item.nm_login}>
                                {item.nm_colaborador}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="field chamados-modal__field chamadev-platform-combobox">
                          <span>Plataforma</span>
                          <input
                            value={plataformaSearch}
                            onBlur={() => window.setTimeout(() => setShowPlataformaOptions(false), 120)}
                            onChange={(event) => handlePlataformaSearchChange(event.target.value)}
                            onFocus={() => setShowPlataformaOptions(true)}
                            placeholder="Pesquise a plataforma"
                          />
                          {showPlataformaOptions ? (
                            <div className="chamadev-platform-combobox__menu" role="listbox">
                              {plataformasFiltradas.length ? (
                                plataformasFiltradas.map((item) => (
                                  <button
                                    key={item.id_plataforma}
                                    className="chamadev-platform-combobox__option"
                                    type="button"
                                    onClick={() => handlePlataformaSelect(item.nm_plataforma)}
                                  >
                                    {item.nm_plataforma}
                                  </button>
                                ))
                              ) : (
                                <span className="chamadev-platform-combobox__empty">Nenhuma plataforma encontrada</span>
                              )}
                              {plataformaSearchText && !plataformaExiste ? (
                                <button
                                  className="chamadev-platform-combobox__create"
                                  type="button"
                                  disabled={busy === "platform-create"}
                                  onClick={() => void handleCriarPlataforma()}
                                >
                                  {busy === "platform-create" ? "Criando..." : `Criar "${plataformaSearchText}"`}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="page-header__actions chamados-modal__actions">
                          <button className="button button--secondary" type="button" onClick={handleAssignToCurrentUser}>
                            Pegar para mim
                          </button>
                        </div>
                          <label className="field chamados-modal__field">
                            <span>Passo atual (opcional)</span>
                            <textarea
                              rows={4}
                              value={devForm.passoAtual}
                            onChange={(event) => updateDevForm("passoAtual", event.target.value)}
                            placeholder="Descreva em que etapa o atendimento esta agora."
                          />
                        </label>
                        {requiresImpedimento(devForm.workflowStatus) ? (
                          <label className="field chamados-modal__field">
                            <span>Impedimento</span>
                            <textarea
                              rows={4}
                              value={devForm.impedimento}
                              onChange={(event) => updateDevForm("impedimento", event.target.value)}
                              placeholder={
                                devForm.workflowStatus === "pausado"
                                  ? "Registre o motivo da pausa para o atendimento."
                                  : "Informe quais dados ou retornos ainda estao pendentes para continuar."
                              }
                            />
                          </label>
                        ) : null}
                        <div className="page-header__actions chamados-modal__actions">
                          {editingHistoryIndex !== null ? (
                            <button className="button button--ghost-neutral" type="button" onClick={() => handleEditHistoryChange("")}>
                              Novo andamento
                            </button>
                          ) : null}
                          <button className="button" type="submit" disabled={busy === "update"}>
                            {busy === "update" ? "Salvando..." : editingHistoryIndex !== null ? "Salvar edicao" : "Salvar atualizacao"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </aside>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function normalizeCpf(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeCatalogValue(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mapCatalogTipoSolicitacaoToBackend(value: string): TipoSolicitacao {
  const normalized = normalizeCatalogValue(value).replace(/[^a-z0-9]+/g, "_");
  if (normalized.includes("transferencia") && normalized.includes("arquivo")) {
    return "transferencia_arquivo";
  }
  if (normalized.includes("carga")) {
    return "carga";
  }
  return "outro";
}

function getAreaTipoLabel(value: AreaTipo) {
  switch (value) {
    case "interna":
      return "Interna";
    case "externa":
      return "Externa";
    default:
      return "";
  }
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateWithYear(value: string) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTimeShort(value: string) {
  return formatDate(value);
}

function formatDateOnly(value: string) {
  if (!value) return "-";
  const plainDateMatch = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plainDateMatch) {
    const [, year, month, day] = plainDateMatch;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function parseChamadoDate(value: string) {
  if (!value) return 0;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatFileSize(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function getTituloPlaceholder(tipo: TipoSolicitacao) {
  switch (tipo) {
    case "transferencia_arquivo":
      return "Ex.: Transferência do arquivo retorno_clientes.csv para a pasta da cobrança";
    case "carga":
      return "Ex.: Executar carga de contratos da carteira XPTO";
    case "outro":
      return "Ex.: Ajuste na visão de acompanhamento do chamado";
  }
}

function getDescricaoPlaceholder(tipo: TipoSolicitacao) {
  switch (tipo) {
    case "transferencia_arquivo":
      return "Informe origem, destino, nome do arquivo, horário esperado e o impacto caso a transferência não aconteça.";
    case "carga":
      return "Descreva a carga, qual ambiente deve receber, a referência de data e o resultado esperado após a execução.";
    case "outro":
      return "Descreva o problema, em que tela acontece, qual impacto gera e qual resultado você espera.";
  }
}

function buildDescricaoSolicitacao(form: FormChamado) {
  const areaInfo = [`Tipo de area: ${getAreaTipoLabel(form.areaTipo)}`, `Area: ${form.areaNome.trim()}`]
    .filter((item) => !item.endsWith(": "))
    .join("\n");
  const tipoLabel = form.tipoSolicitacaoNome.trim() || getTipoSolicitacaoLabel(form.tipoSolicitacao);
  if (form.tipoSolicitacao === "outro") {
    return [areaInfo, `Tipo de solicitacao: ${tipoLabel}`, form.descricao.trim()].filter(Boolean).join("\n\n");
  }

  const detalhesComplementares = [
    `Possui usuarios: ${formatBooleanChoice(form.possuiUsuarios)}`,
    ...(form.possuiUsuarios
      ? form.usuarios
          .map((usuario) => usuario.trim())
          .filter(Boolean)
          .map((usuario, index) => `Usuario ${index + 1}: ${usuario}`)
      : []),
    `Possui senha: ${formatBooleanChoice(form.possuiSenha)}`,
    ...(form.possuiSenha
      ? form.senhas
          .map((senha) => senha.trim())
          .filter(Boolean)
          .map((senha, index) => `Senha ${index + 1}: ${senha}`)
      : []),
    `Possui link: ${formatBooleanChoice(form.possuiLink)}`,
    ...(form.possuiLink
      ? form.links
          .map((link) => link.trim())
          .filter(Boolean)
          .map((link, index) => `Link ${index + 1}: ${link}`)
      : []),
    `Possui caminhos: ${formatBooleanChoice(form.possuiCaminhos)}`,
    ...(form.possuiCaminhos
      ? form.caminhos
          .map((caminho) => caminho.trim())
          .filter(Boolean)
          .map((caminho, index) => `Caminho ${index + 1}: ${caminho}`)
      : []),
  ]
    .filter(Boolean)
    .join("\n");

  return [areaInfo, `Tipo de solicitacao: ${tipoLabel}`, form.descricao.trim(), detalhesComplementares].filter(Boolean).join("\n\n");
}

// Reconstroi o formulario de solicitacao a partir da descricao ja salva, para o
// solicitante conseguir reeditar todos os campos (area, tipo, listas, etc.).
function buildFormFromChamado(
  chamado: Chamado,
  areas: DemandaArea[],
  tipos: DemandaTipoSolicitacao[],
): FormChamado {
  const solicitacao = parseChamadoSolicitacao(chamado.descricao);

  const areaTipoRaw = normalizeCatalogValue(
    (solicitacao.area.find((line) => /^tipo de area:/i.test(line)) || "").replace(/^tipo de area:\s*/i, ""),
  );
  const areaTipo: AreaTipo = areaTipoRaw === "interna" ? "interna" : areaTipoRaw === "externa" ? "externa" : "";
  const areaNome = (solicitacao.area.find((line) => /^area:/i.test(line)) || "").replace(/^area:\s*/i, "").trim();
  const areaMatch = areas.find((item) => normalizeCatalogValue(item.nm_area) === normalizeCatalogValue(areaNome));

  const tipoNome = String(solicitacao.tipoSolicitacao || "").replace(/^tipo de solicitacao:\s*/i, "").trim();
  const tipoMatch = tipos.find((item) => normalizeCatalogValue(item.nm_tipo_solicitacao) === normalizeCatalogValue(tipoNome));
  const tipoSolicitacao = mapCatalogTipoSolicitacaoToBackend(tipoMatch?.nm_tipo_solicitacao || tipoNome);

  const getLista = (prefix: string) =>
    solicitacao.complementares
      .filter((line) => new RegExp(`^${prefix}\\s+\\d+:`, "i").test(line))
      .map((line) => line.replace(new RegExp(`^${prefix}\\s+\\d+:\\s*`, "i"), "").trim())
      .filter(Boolean);
  const getPossui = (label: string, lista: string[]): BooleanChoice => {
    const line = solicitacao.complementares.find((item) => new RegExp(`^possui ${label}:`, "i").test(item));
    if (line) {
      return /sim/i.test(line);
    }
    return lista.length > 0;
  };

  const usuarios = getLista("usuario");
  const senhas = getLista("senha");
  const links = getLista("link");
  const caminhos = getLista("caminho");

  return {
    ...INITIAL_FORM,
    areaTipo,
    areaId: areaMatch ? String(areaMatch.id_area) : "",
    areaNome: areaMatch?.nm_area || areaNome,
    tipoSolicitacaoId: tipoMatch ? String(tipoMatch.id_tipo_solicitacao) : "",
    tipoSolicitacaoNome: tipoMatch?.nm_tipo_solicitacao || tipoNome,
    tipoSolicitacao,
    titulo: chamado.titulo,
    descricao: solicitacao.textoPrincipal,
    possuiUsuarios: getPossui("usuarios", usuarios),
    usuarios: usuarios.length ? usuarios : [""],
    possuiSenha: getPossui("senha", senhas),
    senhas: senhas.length ? senhas : [""],
    possuiLink: getPossui("link", links),
    links: links.length ? links : [""],
    possuiCaminhos: getPossui("caminhos", caminhos),
    caminhos: caminhos.length ? caminhos : [""],
    evidencia: [],
  };
}

// Gera a nova descricao a partir do formulario mantendo intactos os blocos de
// atendimento do dev, historico e interacoes do solicitante que ja existiam.
function buildDescricaoSolicitacaoComAtendimento(descricaoAtual: string, form: FormChamado) {
  const novoResumo = buildDescricaoSolicitacao(form);
  const marcadores = ["\n\n[CONTROLE_ATENDIMENTO]", "\n\n[HISTORICO_ATENDIMENTO]", "\n\n[INTERACOES_SOLICITANTE]"];
  let corte = -1;
  for (const marcador of marcadores) {
    const indice = descricaoAtual.indexOf(marcador);
    if (indice !== -1 && (corte === -1 || indice < corte)) {
      corte = indice;
    }
  }
  const cauda = corte === -1 ? "" : descricaoAtual.slice(corte);
  return `${novoResumo}${cauda}`;
}

type ChamadoSolicitacaoView = {
  area: string[];
  tipoSolicitacao: string;
  textoPrincipal: string;
  complementares: string[];
};

type ChamadoComplementarGroup = {
  label: string;
  items: string[];
};

function getChamadoResumoSolicitacao(descricao: string) {
  return descricao.split("\n\n[CONTROLE_ATENDIMENTO]")[0].trim();
}

function isChamadoAreaLine(value: string) {
  return /^tipo de area:/i.test(value) || /^area:/i.test(value);
}

function parseChamadoSolicitacao(descricao: string): ChamadoSolicitacaoView {
  const resumo = getChamadoResumoSolicitacao(descricao);
  const sections = resumo
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const tipoSolicitacao = sections.find((item) => item.toLowerCase().startsWith("tipo de solicitacao:")) || "";
  const area = sections
    .flatMap((section) => section.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((line) => isChamadoAreaLine(line));
  const complementares = sections
    .flatMap((section) => section.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter(
      (line) =>
        line.toLowerCase().startsWith("possui ") ||
        /^(usuario|senha|link|caminho)\s+\d+:/i.test(line),
    );
  const textoPrincipal = sections
    .filter(
      (item) =>
        item !== tipoSolicitacao &&
        !item.split("\n").every((line) => isChamadoAreaLine(line.trim())) &&
        !item
          .split("\n")
          .every(
            (line) =>
              line.trim().toLowerCase().startsWith("possui ") ||
              /^(usuario|senha|link|caminho)\s+\d+:/i.test(line.trim()),
          ),
    )
    .join("\n\n");

  return {
    area,
    tipoSolicitacao,
    textoPrincipal,
    complementares,
  };
}

function getChamadoTipoSolicitacaoDisplay(solicitacao: ChamadoSolicitacaoView | null) {
  const raw = String(solicitacao?.tipoSolicitacao || "").replace(/^Tipo de solicitacao:\s*/i, "").trim();
  switch (raw.toLowerCase()) {
    case "transferencia de arquivo":
      return "Transferência de arquivo";
    default:
      return raw;
  }
}

function formatComplementarDisplayItem(item: string) {
  return item
    .replace(/^Tipo de area:/i, "Tipo de área:")
    .replace(/^Area:/i, "Área:")
    .replace(/^Possui usuarios:/i, "Possui usuários:")
    .replace(/^Usuario(\s+\d+:)/i, "Usuário$1")
    .replace(/\bNao\b/g, "Não");
}

function buildChamadoComplementarGroups(solicitacao: ChamadoSolicitacaoView | null): ChamadoComplementarGroup[] {
  if (!solicitacao || (!solicitacao.area.length && !solicitacao.complementares.length)) {
    return [];
  }

  const groups: ChamadoComplementarGroup[] = [];
  if (solicitacao.area.length) {
    groups.push({ label: "Area", items: solicitacao.area.map(formatComplementarDisplayItem) });
  }
  const pushGroup = (label: string, predicate: (item: string) => boolean) => {
    const items = solicitacao.complementares.filter(predicate).map(formatComplementarDisplayItem);
    if (items.length) {
      groups.push({ label, items });
    }
  };

  pushGroup("Usuários", (item) => /^usuario\s+\d+:/i.test(item) || /^possui usuarios:/i.test(item));
  pushGroup("Senhas", (item) => /^senha\s+\d+:/i.test(item) || /^possui senha:/i.test(item));
  pushGroup("Links", (item) => /^link\s+\d+:/i.test(item) || /^possui link:/i.test(item));
  pushGroup("Caminhos", (item) => /^caminho\s+\d+:/i.test(item) || /^possui caminhos:/i.test(item));

  return groups;
}


function buildChamadoDescricaoWithRequesterInteraction(descricao: string, mensagem: string, autor: string) {
  const interactionLine = serializeRequesterInteraction({
    data: new Date().toISOString(),
    autor,
    mensagem: mensagem.trim(),
  });
  const marker = "\n\n[INTERACOES_SOLICITANTE]\n";

  if (descricao.includes(marker)) {
    return `${descricao}\n${interactionLine}`;
  }

  return `${descricao}${marker}${interactionLine}`;
}

function buildInteracoesSolicitanteBlock(descricao: string) {
  const interacoes = parseRequesterInteractions(descricao);
  if (!interacoes.length) {
    return "";
  }
  return `\n\n[INTERACOES_SOLICITANTE]\n${interacoes.map(serializeRequesterInteraction).join("\n")}`;
}

function parseChamadoDevData(descricao: string) {
  const marker = "\n\n[CONTROLE_ATENDIMENTO]\n";
  const [, rawDevBlock = ""] = descricao.split(marker);
  const devBlock = rawDevBlock.split("\n\n[HISTORICO_ATENDIMENTO]")[0];

  const workflowStatusMatch = devBlock.match(/Status atendimento:\s*(.+)/);
  const subStatusMatch = devBlock.match(/Sub status:\s*(.+)/);
  const assignedToLoginMatch = devBlock.match(/Responsavel login:\s*(.+)/);
  const assignedToNameMatch = devBlock.match(/Responsavel nome:\s*(.+)/);
  const plataformaMatch = devBlock.match(/Plataforma:\s*(.+)/);
  const dueDateMatch = devBlock.match(/Data prevista:\s*(.+)/);
  const passoAtualMatch = devBlock.match(/Passo atual:\s*([\s\S]*?)(?:\nImpedimento:|$)/);
  const impedimentoMatch = devBlock.match(/Impedimento:\s*([\s\S]*?)$/);

  return {
    workflowStatus: normalizeWorkflowStatus(workflowStatusMatch?.[1] || ""),
    subStatus: String(subStatusMatch?.[1] || "").trim(),
    assignedToLogin: String(assignedToLoginMatch?.[1] || "").trim(),
    assignedToName: String(assignedToNameMatch?.[1] || "").trim(),
    plataforma: String(plataformaMatch?.[1] || "").trim(),
    dueDate: String(dueDateMatch?.[1] || "").trim(),
    passoAtual: normalizeOptionalField(passoAtualMatch?.[1]),
    impedimento: normalizeOptionalField(impedimentoMatch?.[1]),
  };
}

function parseChamadoHistorico(descricao: string) {
  const marker = "\n\n[HISTORICO_ATENDIMENTO]\n";
  const [, rawHistory = ""] = descricao.split(marker);

  return rawHistory
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [data, autor, workflowStatus, prioridade, assignedToLogin, assignedToName, dueDate, passoAtual, impedimento, plataforma, subStatus] = line.split("||");
      const normalizedStatus = normalizeWorkflowStatus(workflowStatus || "");
      if (!data || !normalizedStatus || !prioridade) {
        return null;
      }

      return {
        data,
        autor: decodeHistoryValue(autor) || "Time de desenvolvimento",
        workflowStatus: normalizedStatus,
        subStatus: decodeHistoryValue(subStatus),
        prioridade: normalizePriority(prioridade),
        assignedToLogin: decodeHistoryValue(assignedToLogin),
        assignedToName: decodeHistoryValue(assignedToName),
        plataforma: decodeHistoryValue(plataforma),
        dueDate: decodeHistoryValue(dueDate),
        passoAtual: decodeHistoryValue(passoAtual),
        impedimento: decodeHistoryValue(impedimento),
      } as DevHistoryEntry;
    })
    .filter((item): item is DevHistoryEntry => !!item);
}

function parseRequesterInteractions(descricao: string) {
  const marker = "\n\n[INTERACOES_SOLICITANTE]\n";
  const [, rawInteractions = ""] = descricao.split(marker);

  return rawInteractions
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [data, autor, mensagem] = line.split("||");
      if (!data || !mensagem) {
        return null;
      }

      return {
        data,
        autor: decodeHistoryValue(autor) || "Solicitante",
        mensagem: decodeHistoryValue(mensagem),
      } as RequesterInteractionEntry;
    })
    .filter((item): item is RequesterInteractionEntry => !!item);
}

function buildChamadoDescricaoAtualizada(
  descricaoAtual: string,
  devForm: DevChamadoForm,
  autor: string,
  editingHistoryIndex: number | null,
) {
  const resumoSolicitacao = getChamadoResumoSolicitacao(descricaoAtual);
  const historicoAtual = parseChamadoHistorico(descricaoAtual);
  const registroExistente = editingHistoryIndex !== null ? historicoAtual[editingHistoryIndex] : null;
  const registroAtualizado: DevHistoryEntry = {
    data: registroExistente?.data || new Date().toISOString(),
    autor: registroExistente?.autor || autor,
    workflowStatus: devForm.workflowStatus,
    subStatus: devForm.subStatus.trim(),
    prioridade: devForm.prioridade,
    assignedToLogin: devForm.assignedToLogin.trim(),
    assignedToName: devForm.assignedToName.trim(),
    plataforma: devForm.plataforma.trim(),
    dueDate: devForm.dueDate.trim(),
    passoAtual: devForm.passoAtual.trim(),
    impedimento: devForm.impedimento.trim(),
  };
  const controle = [
    "[CONTROLE_ATENDIMENTO]",
    `Status atendimento: ${devForm.workflowStatus}`,
    ...(devForm.subStatus.trim() ? [`Sub status: ${devForm.subStatus.trim()}`] : []),
    ...(devForm.assignedToLogin.trim() ? [`Responsavel login: ${devForm.assignedToLogin.trim()}`] : []),
    ...(devForm.assignedToName.trim() ? [`Responsavel nome: ${devForm.assignedToName.trim()}`] : []),
    ...(devForm.plataforma.trim() ? [`Plataforma: ${devForm.plataforma.trim()}`] : []),
    ...(devForm.dueDate.trim() ? [`Data prevista: ${devForm.dueDate.trim()}`] : []),
    ...(devForm.passoAtual.trim() ? [`Passo atual: ${devForm.passoAtual.trim()}`] : []),
    ...(devForm.impedimento.trim() ? [`Impedimento: ${devForm.impedimento.trim()}`] : []),
  ].join("\n");
  const proximoHistorico =
    editingHistoryIndex !== null
      ? historicoAtual.map((entry, index) => (index === editingHistoryIndex ? registroAtualizado : entry))
      : [...historicoAtual, registroAtualizado];
  const historico = ["[HISTORICO_ATENDIMENTO]", ...proximoHistorico.map(serializeHistoryEntry)].join("\n");
  const interacoesSolicitante = buildInteracoesSolicitanteBlock(descricaoAtual);

  return `${resumoSolicitacao}\n\n${controle}\n\n${historico}${interacoesSolicitante}`;
}

function getChamadoWorkflowStatus(chamado: Chamado): DevWorkflowStatus {
  return parseChamadoDevData(chamado.descricao).workflowStatus || deriveWorkflowStatusFromChamado(chamado);
}

function getChamadoFilterStatus(chamado: Chamado): Chamado["status"] {
  const workflowStatus = getChamadoWorkflowStatus(chamado);

  if (workflowStatus === "aberto") {
    return "open";
  }

  if (workflowStatus === "fechado") {
    return "closed";
  }

  return "in_progress";
}

function shouldUseWorkflowDisplay(chamado: Chamado) {
  return !!parseChamadoDevData(chamado.descricao).workflowStatus || parseChamadoHistorico(chamado.descricao).length > 0;
}

function getChamadoDisplayStatusLabel(chamado: Chamado) {
  return shouldUseWorkflowDisplay(chamado)
    ? workflowStatusLabel(getChamadoWorkflowStatus(chamado))
    : statusLabel(chamado.status);
}

function getChamadoDisplayStatusTone(chamado: Chamado) {
  return shouldUseWorkflowDisplay(chamado)
    ? workflowStatusTone(getChamadoWorkflowStatus(chamado))
    : statusTone(chamado.status);
}

function shouldDisplayPriority(chamado: Chamado) {
  return parseChamadoHistorico(chamado.descricao).length > 0 && shouldShowPriorityField(getChamadoWorkflowStatus(chamado));
}

function getChamadoAssignedTo(chamado: Chamado) {
  const parsed = parseChamadoDevData(chamado.descricao);
  return {
    login: parsed.assignedToLogin,
    name: parsed.assignedToName,
  };
}

function getChamadoPlatform(chamado: Chamado) {
  return parseChamadoDevData(chamado.descricao).plataforma;
}

function buildDevTimeline(chamado: Chamado) {
  const historico = parseChamadoHistorico(chamado.descricao);
  const timeline = [
    {
      titulo: "Chamado registrado",
      descricao: formatDate(chamado.criado_em),
      data: chamado.criado_em,
      editIndex: null as number | null,
    },
  ];

  return timeline.concat(
    historico
      .slice()
      .reverse()
      .map((entry, reverseIndex, reversedItems) => {
        const originalIndex = reversedItems.length - 1 - reverseIndex;
        const passoAtual = normalizeOptionalField(entry.passoAtual);
        const impedimento = normalizeOptionalField(entry.impedimento);
        const samePerson =
          entry.assignedToName &&
          entry.autor &&
          entry.assignedToName.trim().toLowerCase() === entry.autor.trim().toLowerCase();
        return {
        titulo: buildTimelineStatusTitle(entry),
        descricao: [
          formatDate(entry.data),
          entry.assignedToName ? `Responsável: ${entry.assignedToName}` : "",
          entry.plataforma ? `Plataforma: ${entry.plataforma}` : "",
          entry.autor && !samePerson ? `Atualizado por: ${entry.autor}` : "",
          entry.dueDate ? `Finalização prevista: ${formatDateOnly(entry.dueDate)}` : "",
          passoAtual ? `Passo atual: ${passoAtual}` : "",
          impedimento ? `Impedimento: ${impedimento}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        data: entry.data,
        editIndex: originalIndex,
      };
      }),
  );
}

function buildDevTimelineDisplay(chamado: Chamado) {
  const historico = parseChamadoHistorico(chamado.descricao);
  const timeline = [
    {
      titulo: "Chamado registrado",
      descricao: formatDate(chamado.criado_em),
      data: chamado.criado_em,
      editIndex: null as number | null,
    },
  ];

  return timeline.concat(
    historico
      .map((entry, index) => {
        const passoAtual = normalizeOptionalField(entry.passoAtual);
        const impedimento = normalizeOptionalField(entry.impedimento);
        const samePerson =
          entry.assignedToName &&
          entry.autor &&
          entry.assignedToName.trim().toLowerCase() === entry.autor.trim().toLowerCase();
        const metaInline = [
          entry.assignedToName ? `Responsável: ${entry.assignedToName}` : "",
          entry.plataforma ? `Plataforma: ${entry.plataforma}` : "",
          entry.autor && !samePerson ? `Atualizado por: ${entry.autor}` : "",
          entry.dueDate ? `Finalização prevista: ${formatDateOnly(entry.dueDate)}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const descricao = [
          formatDate(entry.data),
          metaInline,
          passoAtual ? `Passo atual: ${passoAtual}` : "",
          impedimento ? `Impedimento: ${impedimento}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        return {
          titulo: buildTimelineStatusTitle(entry),
          descricao,
          data: entry.data,
          editIndex: index,
        };
      }),
  );
}

function buildChamadoTimelineDisplay(chamado: Chamado) {
  const timeline = buildDevTimelineDisplay(chamado).map((entry) => ({
    ...entry,
    timestamp: parseChamadoDate(entry.data),
  }));

  const requesterEntries = parseRequesterInteractions(chamado.descricao).map((entry) => ({
    titulo: "Resposta do solicitante",
    descricao: [formatDate(entry.data), `Autor: ${entry.autor}`, entry.mensagem].filter(Boolean).join("\n"),
    data: entry.data,
    editIndex: null as number | null,
    timestamp: parseChamadoDate(entry.data),
  }));

  return [...timeline, ...requesterEntries]
    .sort((first, second) => first.timestamp - second.timestamp)
    .map(({ timestamp: _timestamp, ...entry }) => entry);
}

function buildTimelineStatusTitle(entry: DevHistoryEntry) {
  const base = !shouldShowPriorityField(entry.workflowStatus)
    ? workflowStatusLabel(entry.workflowStatus)
    : `${workflowStatusLabel(entry.workflowStatus)} · ${priorityLabel(entry.prioridade)}`;

  return entry.subStatus ? `${base} · ${entry.subStatus}` : base;
}

function deriveWorkflowStatusFromChamado(chamado: Chamado): DevWorkflowStatus {
  switch (chamado.status) {
    case "open":
      return "aberto";
    case "in_progress":
      return "em_andamento";
    case "closed":
      return "fechado";
  }
}

function normalizeWorkflowStatus(value: string): DevWorkflowStatus | null {
  switch (String(value || "").trim().toLowerCase()) {
    case "aberto":
      return "aberto";
    case "em_andamento":
      return "em_andamento";
    case "fase_testes":
      return "fase_testes";
    case "fechado":
      return "fechado";
    case "pausado":
      return "pausado";
    case "em_avaliacao_time":
      return "em_avaliacao_time";
    case "definicao_prazo":
      return "definicao_prazo";
    case "aguardando_informacoes":
      return "aguardando_informacoes";
    default:
      return null;
  }
}

function normalizePriority(value: string): Chamado["prioridade"] {
  switch (String(value || "").trim().toLowerCase()) {
    case "low":
      return "low";
    case "high":
      return "high";
    case "urgent":
      return "urgent";
    default:
      return "medium";
  }
}

function workflowStatusLabel(value: DevWorkflowStatus) {
  switch (value) {
    case "aberto":
      return "Aberto";
    case "em_andamento":
      return "Em andamento";
    case "fase_testes":
      return "Fase de testes";
    case "fechado":
      return "Fechado";
    case "pausado":
      return "Pausado";
    case "em_avaliacao_time":
      return "Em avaliação do time";
    case "definicao_prazo":
      return "Definição de prazo";
    case "aguardando_informacoes":
      return "Aguardando informações";
  }
}

function workflowStatusTone(value: DevWorkflowStatus) {
  switch (value) {
    case "aberto":
      return "warning";
    case "em_andamento":
      return "accent";
    case "fase_testes":
      return "accent";
    case "fechado":
      return "success";
    case "pausado":
      return "danger";
    case "em_avaliacao_time":
      return "accent";
    case "definicao_prazo":
      return "warning";
    case "aguardando_informacoes":
      return "warning";
  }
}

function mapWorkflowStatusToBackendStatus(value: DevWorkflowStatus): Chamado["status"] {
  switch (value) {
    case "fechado":
      return "closed";
    case "em_andamento":
    case "fase_testes":
    case "pausado":
      return "in_progress";
    case "aberto":
    case "em_avaliacao_time":
    case "definicao_prazo":
    case "aguardando_informacoes":
      return "open";
  }
}

function requiresImpedimento(value: DevWorkflowStatus) {
  return value === "pausado" || value === "aguardando_informacoes";
}

function requiresDueDate(value: DevWorkflowStatus) {
  return value === "definicao_prazo";
}

function shouldShowPriorityField(value: DevWorkflowStatus) {
  return value !== "em_avaliacao_time";
}

function encodeHistoryValue(value: string) {
  // encodeURIComponent ja converte quebras de linha (%0A) e o separador "|" (%7C),
  // entao preservamos os paragrafos originais sem quebrar o esquema de serializacao.
  return encodeURIComponent(String(value || "").replace(/\r\n/g, "\n").trim());
}

function decodeHistoryValue(value?: string) {
  return decodeURIComponent(value || "").trim();
}

function normalizeOptionalField(value?: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized === "Nao informado") return "";
  if (normalized === "Não informado") return "";
  if (normalized === "Sem impedimento registrado") return "";
  return normalized;
}

function serializeHistoryEntry(entry: DevHistoryEntry) {
  return [
    entry.data,
    encodeHistoryValue(entry.autor),
    entry.workflowStatus,
    entry.prioridade,
    encodeHistoryValue(entry.assignedToLogin),
    encodeHistoryValue(entry.assignedToName),
    encodeHistoryValue(entry.dueDate),
    encodeHistoryValue(entry.passoAtual),
    encodeHistoryValue(entry.impedimento),
    encodeHistoryValue(entry.plataforma),
    encodeHistoryValue(entry.subStatus),
  ].join("||");
}

function serializeRequesterInteraction(entry: RequesterInteractionEntry) {
  return [entry.data, encodeHistoryValue(entry.autor), encodeHistoryValue(entry.mensagem)].join("||");
}

function getTipoSolicitacaoLabel(tipo: TipoSolicitacao) {
  switch (tipo) {
    case "transferencia_arquivo":
      return "Transferência de arquivo";
    case "carga":
      return "Carga";
    case "outro":
      return "Diversos";
  }
}

function statusLabel(value: Chamado["status"]) {
  switch (value) {
    case "open":
      return "Aberto";
    case "in_progress":
      return "Em andamento";
    case "closed":
      return "Fechado";
  }
}

function statusTone(value: Chamado["status"]) {
  switch (value) {
    case "open":
      return "warning";
    case "in_progress":
      return "accent";
    case "closed":
      return "success";
  }
}

function priorityLabel(value: Chamado["prioridade"]) {
  switch (value) {
    case "low":
      return "Baixa";
    case "medium":
      return "Média";
    case "high":
      return "Alta";
    case "urgent":
      return "Urgente";
  }
}

function priorityTone(value: Chamado["prioridade"]) {
  switch (value) {
    case "low":
      return "success";
    case "medium":
      return "accent";
    case "high":
      return "warning";
    case "urgent":
      return "danger";
  }
}

function validateChamadoForm(form: FormChamado) {
  if (!form.areaTipo) {
    return "Selecione se a area e interna ou externa antes de registrar.";
  }

  if (!form.areaId || !form.areaNome.trim()) {
    return "Selecione a area responsavel antes de registrar.";
  }

  if (!form.tipoSolicitacaoId || !form.tipoSolicitacaoNome.trim()) {
    return "Selecione o tipo de solicitacao antes de registrar.";
  }

  if (!form.titulo.trim()) {
    return "Preencha o título do chamado antes de registrar.";
  }

  if (!form.descricao.trim()) {
    return "Preencha a descrição do chamado antes de registrar.";
  }

  if (form.tipoSolicitacao === "outro") {
    return "";
  }

  const requiredChoices: Array<[BooleanChoice, string]> = [
    [form.possuiUsuarios, "Informe se a solicitação possui usuários."],
    [form.possuiSenha, "Informe se a solicitação possui senhas."],
    [form.possuiLink, "Informe se a solicitação possui links."],
    ...(form.tipoSolicitacao === "transferencia_arquivo" || form.tipoSolicitacao === "carga" ? [] : [[form.possuiCaminhos, "Informe se a solicitação possui caminhos."] as const]),
  ];

  const missingChoice = requiredChoices.find(([value]) => value === null);
  if (missingChoice) {
    return `${missingChoice[1]} Marque Sim ou Não antes de registrar.`;
  }

  if (form.possuiUsuarios && !form.usuarios.some((item) => item.trim())) {
    return "Preencha ao menos um usuário antes de registrar o chamado.";
  }

  if (form.possuiSenha && !form.senhas.some((item) => item.trim())) {
    return "Preencha ao menos uma senha antes de registrar o chamado.";
  }

  if (form.possuiLink && !form.links.some((item) => item.trim())) {
    return "Preencha ao menos um link antes de registrar o chamado.";
  }

  if ((form.tipoSolicitacao === "transferencia_arquivo" || form.tipoSolicitacao === "carga" || form.possuiCaminhos) && !form.caminhos.some((item) => item.trim())) {
    return "Preencha ao menos um caminho antes de registrar o chamado.";
  }

  return "";
}

function formatBooleanChoice(value: BooleanChoice) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "Não informado";
}

type HelpBadgeProps = {
  text: string;
};

function HelpBadge({ text }: HelpBadgeProps) {
  return (
    <>
      <span className="field-help" aria-hidden="true">
        !
      </span>
      <span className="field-help-popover" role="tooltip">
        {text}
      </span>
    </>
  );
}
