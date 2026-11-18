import axiosInstance from "./axiosInstance";

export type SessionUser = {
  nm_login: string;
  nm_colaborador: string;
  nu_cpf_colaborador: string;
  nm_funcao: string;
  desc_funcao: string;
  centro_custo: string;
  email?: string | null;
  status: number;
  grupos: string[];
};

export type AgendaPendenciaAberta = {
  id: number;
  agenda_id: number;
  date: string;
  horario_entrada: string;
  horario_saida: string;
  carteira: string;
  motivo_visita: string;
  descricao: string;
  responsavel?: string | null;
  observacao?: string | null;
  status_pendencia: string;
  created_at?: string | null;
};

export type ArquivoImagem = {
  nome: string;
  extensao: string;
  pasta: string;
  caminho_arquivo: string;
  data_modificacao: string;
  url_publica?: string | null;
};

export type ArquivoCompartilhado = {
  nome: string;
  extensao: string;
  pasta: string;
  caminho_arquivo: string;
  data_modificacao: string;
  tamanho_bytes: number;
};

export type ItemCompartilhado = {
  nome: string;
  caminho: string;
  tipo: "pasta" | "arquivo";
  data_modificacao?: string | null;
  tamanho_bytes?: number | null;
};

export type ServidorBancoOption = {
  chave: string;
  label: string;
  host?: string | null;
  nome?: string | null;
};

export type BancoServidorOption = {
  nome: string;
  label: string;
};

export type TabelaBanco = {
  schema: string;
  tabela: string;
};

export type ColunaArquivoImportacaoBanco = {
  indice: number;
  nome: string;
};

export type ColunaTabelaImportacaoBanco = {
  nome: string;
  tipo: string;
  obrigatoria: boolean;
  aceita_nulo: boolean;
  importavel: boolean;
};

export type ColunaCorrespondenteImportacaoBanco = {
  origem: string;
  destino: string;
};

export type AnaliseImportacaoBanco = {
  status: string;
  modo_importacao?: string | null;
  schema_destino?: string | null;
  tabela_destino?: string | null;
  nome_arquivo: string;
  tipo_arquivo: string;
  delimitador?: string | null;
  abas_disponiveis: string[];
  aba_selecionada?: string | null;
  total_linhas: number;
  colunas_arquivo: ColunaArquivoImportacaoBanco[];
  colunas_tabela: ColunaTabelaImportacaoBanco[];
  colunas_correspondentes: ColunaCorrespondenteImportacaoBanco[];
  colunas_extras_arquivo: string[];
  colunas_faltantes_tabela: string[];
  colunas_nao_suportadas: string[];
  pode_importar: boolean;
  mensagem: string;
  amostra: Array<Record<string, string>>;
};

export type InspecaoImportacaoBanco = {
  status: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  delimitador?: string | null;
  abas_disponiveis: string[];
  aba_padrao?: string | null;
  total_colunas: number;
  total_linhas: number;
};

export type ImportacaoBancoResultado = {
  status: string;
  modo_importacao?: string | null;
  schema_destino?: string | null;
  tabela_destino?: string | null;
  mensagem: string;
  total_linhas_importadas: number;
  nome_arquivo: string;
  aba_selecionada?: string | null;
};

export type SmsFiltros = {
  cedentes: Array<{ id: number; nome: string }>;
  canais: string[];
  usuarios: string[];
  status: string[];
};

export type SmsLimiteCedente = {
  id: number;
  id_cedente: number;
  nome: string;
  volume_envio: number;
};

export type SmsLimiteTotal = {
  id: number;
  limite_total: number;
  ativo: boolean;
};

export type SmsResumoLimiteCedente = {
  id_cedente: number;
  nome: string;
  limite_semanal: number;
  total_enviado_semana: number;
  nao_utilizado: number;
  limite_efetivo: number;
  restante_semana: number;
  limite_mensal: number;
  total_enviado_mes: number;
  restante_mes: number;
};

export type SmsLimitesEnvio = {
  limite_total_semanal: SmsLimiteTotal | null;
  limite_total_mensal: SmsLimiteTotal | null;
  semanal: SmsLimiteCedente[];
  mensal: SmsLimiteCedente[];
  resumo_cedente: SmsResumoLimiteCedente[];
};

export type NumeroInfobip = {
  id: number;
  numero: string;
  status: string;
  data_consulta: string;
  id_cedente?: number | null;
  cedente: string;
  service_sid: string;
  fluxo: string;
  canal: string;
  numero_valido?: boolean | null;
  pais: string;
  formato_nacional: string;
  nome_exibicao: string;
  emissor_raw: string;
  status_registro: string;
  status_remetente: string;
  limite_mensagens: string;
  limite_mensagens_24h: number;
  qualidade_raw: string;
  provedor: string;
  waba: string;
  ativo: number;
  carteiras_permitidas: string;
  carteiras_permitidas_lista: string[];
};

export type CarteiraPermitidaInfobip = {
  id_cedente: number;
  carteira: string;
  valor: string;
};

export type NumerosInfobipResponse = {
  status: string;
  quantidade: number;
  numeros: NumeroInfobip[];
};

export type EmailFiltros = {
  carteiras: Array<{ id: string; nome: string }>;
  grupos: string[];
  canais: string[];
  status: string[];
};

export type CentroCusto = {
  id_centro_custo: string;
  centro_custo: string;
};

export type GrupoPortal = {
  id_grupo: number;
  nm_grupo: string;
};

export type UsuarioPermissaoPortal = {
  id_usuario: number;
  nm_login: string;
  nm_colaborador: string;
  nu_cpf_colaborador: string;
  nm_funcao: string;
  centro_custo: string;
  email?: string | null;
  status: string;
  grupos: string[];
};

export type ColaboradorCarteiraOperacional = {
  colaborador: string;
  cpf: string;
  funcao: string;
  id_centro_custo: string;
  centro_custo: string;
  centro_custo_2: string;
};

export type CargaExecucao = {
  id_carga: number;
  origem: string;
  remessa: string;
  arquivo: string;
  inicio: string;
  fim: string;
  status: string;
};

export type CargasResponse = {
  data_referencia: string;
  atualizado_em?: string | null;
  em_andamento: boolean;
  ultimo_erro?: string | null;
  resumo: Record<string, number>;
  status_disponiveis: string[];
  execucoes: CargaExecucao[];
};

export type CargaRecebimento = {
  id: number;
  id_cedente: number;
  nm_cedente: string;
  horario: string;
  qtd_arquivos: number;
  nm_arquivos: string;
  tamanho: string;
};

export type CargasRecebimentoResponse = {
  data_referencia: string;
  cedentes: Array<{ id: number; nome: string }>;
  resumo: {
    total_recebimentos: number;
    total_arquivos: number;
  };
  recebimentos: CargaRecebimento[];
};

export type TaskMonitorada = {
  id: number;
  nome: string;
  pasta?: string | null;
  task_path: string;
  task_name: string;
  status: string;
  proxima_execucao?: string | null;
  ultima_execucao?: string | null;
  ultimo_resultado_descricao?: string | null;
};

export type TaskHistorico = {
  id: number;
  acao: string;
  usuario: string;
  status: string;
  mensagem: string;
  dt_execucao: string;
};

export type ControleTarefasResponse = {
  resumo: {
    total: number;
    running: number;
    ready: number;
    disabled: number;
    unknown: number;
  };
  tarefas: TaskMonitorada[];
};

export type ProcessoAtivo = {
  server_name?: string | null;
  session_id: number;
  login_name: string;
  host_name?: string | null;
  program_name?: string | null;
  job_name?: string | null;
  job_step_id?: number | null;
  job_step_name?: string | null;
  job_step_command?: string | null;
  database_name?: string | null;
  status: string;
  command: string;
  start_time?: string | null;
  cpu_time: number;
  total_elapsed_time: number;
  reads: number;
  writes: number;
  blocking_session_id: number;
  sql_text?: string | null;
};

export type ProcessosResponse = {
  atualizado_em: string;
  total: number;
  processos: ProcessoAtivo[];
};

export type ReguaCarteiraApiResponse = {
  ID_CARTEIRA?: number | string;
  ID_Carteira?: number | string;
  id_carteira?: number | string;
  idCarteira?: number | string;
  NOME_CARTEIRA?: string;
  CARTEIRA?: string;
  nome_carteira?: string;
  nomeCarteira?: string;
  DIAS_ABERTURA?: number | string;
  dias_abertura?: number | string;
  diasAbertura?: number | string;
};

export type ListarReguaCarteirasResponse = {
  status: string;
  quantidade: number;
  carteiras: ReguaCarteiraApiResponse[];
};

export type AtualizarReguaCarteiraResponse = {
  status: string;
  mensagem: string;
  id_carteira?: number;
  dias_abertura?: number;
};

export type Chamado = {
  id: number;
  titulo: string;
  descricao: string;
  status: "open" | "in_progress" | "closed";
  prioridade: "low" | "medium" | "high" | "urgent";
  criado_em: string;
  atualizado_em: string;
  cpf_solicitante: string;
  solicitante: string;
  setor_solicitante: string;
  possui_evidencia: boolean;
  evidencia_nome: string;
  evidencia_mime: string;
  evidencia_tamanho: number;
};

export type DemandaArea = {
  id_area: number;
  tp_area: string;
  nm_area: string;
};

export type DemandaPlataforma = {
  id_plataforma: number;
  nm_plataforma: string;
};

export type DemandaTipoSolicitacao = {
  id_tipo_solicitacao: number;
  nm_tipo_solicitacao: string;
};

export type WhatsappTemplateVariavel = {
  indice: number;
  nome: string;
  descricao?: string | null;
  exemplo?: string | null;
};

export type WhatsappTemplateBotao = {
  type: string;
  text: string;
  url?: string | null;
  phone_number?: string | null;
  example?: string[] | null;
};

export type WhatsappTemplateEvento = {
  id_evento_template: number;
  id_template: number;
  tipo_evento: string;
  status_anterior?: string | null;
  status_novo?: string | null;
  quality_anterior?: string | null;
  quality_novo?: string | null;
  origem_evento?: string | null;
  descricao_evento?: string | null;
  payload_evento?: Record<string, unknown> | null;
  usuario_responsavel?: string | null;
  data_evento?: string | null;
};

export type WhatsappTemplate = {
  id_template: number;
  nome_interno: string;
  nome_template_meta: string;
  idioma: string;
  categoria_meta: string;
  status_template: string;
  quality_status?: string | null;
  ativo: boolean;
  header_tipo?: string | null;
  header_texto?: string | null;
  body_texto: string;
  footer_texto?: string | null;
  buttons_json?: WhatsappTemplateBotao[] | null;
  componentes_json?: Record<string, unknown> | null;
  variaveis_json?: WhatsappTemplateVariavel[] | null;
  id_template_meta?: string | null;
  ultimo_evento_meta?: string | null;
  ultimo_payload_meta?: Record<string, unknown> | null;
  criado_por?: string | null;
  origem_cadastro?: string | null;
  data_criacao?: string | null;
  data_atualizacao?: string | null;
  data_ultima_sincronia?: string | null;
  eventos?: WhatsappTemplateEvento[];
};

export type ListaChamadosResponse = {
  itens: Chamado[];
  resumo: {
    total: number;
    abertos: number;
    em_andamento: number;
    fechados: number;
  };
  modo_gestao: boolean;
};

export type UsuarioPermissaoEfetiva = {
  recurso: string;
  descricao: string;
  permitido: boolean;
  origem: string[];
};

export type UsuarioPermissoesEfetivasResponse = {
  usuario?: UsuarioPermissaoPortal;
  permissoes: UsuarioPermissaoEfetiva[];
};

export async function obterPermissoesEfetivasUsuarioPortal(idUsuario: number) {
  const { data } = await axiosInstance.get(`/gestao-usuarios/usuarios/${idUsuario}/permissoes-efetivas`, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    params: {
      _: Date.now(),
    },
  });
  if (typeof data === "string") {
    throw new Error("A API retornou HTML em vez de JSON. Verifique se o backend foi reiniciado e se a rota existe.");
  }

  const payload = data as
    | UsuarioPermissoesEfetivasResponse
    | UsuarioPermissaoEfetiva[]
    | {
        data?: UsuarioPermissoesEfetivasResponse;
        itens?: UsuarioPermissaoEfetiva[];
        permissoes_efetivas?: UsuarioPermissaoEfetiva[];
        permissoes?: UsuarioPermissaoEfetiva[];
        usuario?: UsuarioPermissaoPortal;
      };

  if (Array.isArray(payload)) {
    return { permissoes: payload } as UsuarioPermissoesEfetivasResponse;
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta invalida ao consultar permissoes efetivas.");
  }

  if ("data" in payload && payload.data) {
    return {
      usuario: payload.data.usuario,
      permissoes: payload.data.permissoes ?? [],
    };
  }

  return {
    usuario: payload.usuario,
    permissoes: payload.permissoes ?? payload.permissoes_efetivas ?? payload.itens ?? [],
  };
}

/** Erro de validação do FastAPI: `detail` vem como lista de objetos, não string. */
type DetalheValidacao = { loc?: unknown[]; msg?: string };

function descreverDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const mensagens = (detail as DetalheValidacao[])
      .map((item) => {
        const campo = Array.isArray(item?.loc) ? item.loc.filter((p) => p !== "body").join(".") : "";
        return campo && item?.msg ? `${campo}: ${item.msg}` : item?.msg || "";
      })
      .filter(Boolean);
    if (mensagens.length) return mensagens.join(" · ");
  }
  return "";
}

export function getApiError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { mensagem?: string; detail?: unknown } } }).response;
    // Precisa devolver string sempre: um 422 do FastAPI traz `detail` como array, e
    // devolvê-lo cru faz o React receber um objeto como filho e derrubar a tela toda.
    return response?.data?.mensagem || descreverDetail(response?.data?.detail) || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export async function loginPortal(username: string, password: string) {
  const { data } = await axiosInstance.post("/auth/login", { username, password });
  return data as { token: string; usuario: SessionUser; mensagem: string; status: string };
}

export async function obterSessao() {
  const { data } = await axiosInstance.get("/auth/me");
  return data as { status: string; usuario: SessionUser };
}

export async function recuperarSenha(cpf: string) {
  const { data } = await axiosInstance.post("/auth/password-reset", { cpf });
  return data as {
    status: string;
    mensagem: string;
    email_destino: string;
  };
}

export async function consultarRecuperacaoSenha(cpf: string) {
  const { data } = await axiosInstance.post("/auth/password-reset/lookup", { cpf });
  return data as {
    status: string;
    mensagem: string;
    nm_login: string;
    email: string;
  };
}

export async function consultarUsuarioLogin(cpf: string) {
  const { data } = await axiosInstance.post("/auth/user-lookup", { cpf });
  return data as {
    status: string;
    mensagem: string;
    nm_login: string;
    email?: string | null;
  };
}

export async function confirmarRecuperacaoSenha(payload: {
  cpf: string;
  token: string;
  nova_senha: string;
  confirmacao_nova_senha: string;
}) {
  const { data } = await axiosInstance.post("/auth/password-reset/confirm", payload);
  return data as { status: string; mensagem: string };
}

export async function alterarSenha(novaSenha: string, confirmacaoNovaSenha: string) {
  const { data } = await axiosInstance.post("/auth/change-password", {
    nova_senha: novaSenha,
    confirmacao_nova_senha: confirmacaoNovaSenha,
  });
  return data as { status: string; mensagem: string };
}

export async function alterarEmail(email: string) {
  const { data } = await axiosInstance.post("/auth/change-email", { email });
  return data as { status: string; mensagem: string; email: string };
}

export async function concluirPrimeiroAcesso(payload: {
  email: string;
  nova_senha: string;
  confirmacao_nova_senha: string;
}) {
  const { data } = await axiosInstance.post("/auth/first-access", payload);
  return data as { status: string; mensagem: string; email: string };
}

export async function listarImagens() {
  const { data } = await axiosInstance.get("/banco-imagens");
  return data as { status: string; quantidade: number; arquivos: ArquivoImagem[] };
}

export async function uploadImagens(files: File[], pastaDestino = "") {
  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file));
  formData.append("pasta_destino", pastaDestino);
  const { data } = await axiosInstance.post("/banco-imagens/upload", formData);
  return data as { status: string; mensagem: string; arquivos: ArquivoImagem[] };
}

export async function excluirImagem(caminhoArquivo: string) {
  const { data } = await axiosInstance.delete(`/banco-imagens/${encodeURIComponent(caminhoArquivo)}`);
  return data as { status: string; mensagem: string; arquivos: ArquivoImagem[] };
}

export async function moverImagem(caminhoArquivo: string, pastaDestino = "") {
  const formData = new FormData();
  formData.append("pasta_destino", pastaDestino);
  const { data } = await axiosInstance.post(`/banco-imagens/${encodeURIComponent(caminhoArquivo)}/mover`, formData);
  return data as { status: string; mensagem: string; arquivos: ArquivoImagem[] };
}

export async function listarArquivosCompartilhados(caminho = "") {
  const query = caminho ? `?caminho=${encodeURIComponent(caminho)}` : "";
  const { data } = await axiosInstance.get(`/arquivos${query}`);
  return data as { status: string; quantidade: number; caminho_consultado: string; arquivos: ArquivoCompartilhado[] };
}

export async function navegarArquivosCompartilhados(caminho = "") {
  const query = caminho ? `?caminho=${encodeURIComponent(caminho)}` : "";
  const { data } = await axiosInstance.get(`/arquivos/navegar${query}`);
  return data as { status: string; caminho_atual: string; itens: ItemCompartilhado[] };
}

export async function uploadArquivosCompartilhados(files: File[], pastaDestino = "") {
  const formData = new FormData();
  files.forEach((file) => formData.append("arquivos", file));
  formData.append("pasta_destino", pastaDestino);
  const { data } = await axiosInstance.post("/arquivos/upload", formData);
  return data as { status: string; mensagem: string; caminho_destino: string; arquivos: ArquivoCompartilhado[] };
}

export async function baixarArquivoCompartilhado(caminhoArquivo: string) {
  const response = await axiosInstance.get(`/arquivos/download?caminho_arquivo=${encodeURIComponent(caminhoArquivo)}`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function listarConfiguracaoImportacaoBanco() {
  const { data } = await axiosInstance.get("/importacao-banco/config");
  return data as {
    status: string;
    servidores: ServidorBancoOption[];
    bancos: ServidorBancoOption[];
    formatos_permitidos: string[];
  };
}

export async function listarBancosImportacaoBanco(servidor: string) {
  const params = new URLSearchParams({ servidor });
  const { data } = await axiosInstance.get(`/importacao-banco/bancos?${params.toString()}`);
  return data as { status: string; quantidade: number; bancos: BancoServidorOption[] };
}

export async function listarTabelasImportacaoBanco(servidor: string, banco: string) {
  const params = new URLSearchParams({ servidor, banco });
  const { data } = await axiosInstance.get(`/importacao-banco/tabelas?${params.toString()}`);
  return data as { status: string; quantidade: number; tabelas: TabelaBanco[] };
}

export async function inspecionarDocumentoImportacaoBanco(arquivo: File) {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  const { data } = await axiosInstance.post("/importacao-banco/inspecionar", formData);
  return data as InspecaoImportacaoBanco;
}

export async function analisarDocumentoImportacaoBanco(payload: {
  arquivo: File;
  servidor: string;
  banco: string;
  schema_nome: string;
  tabela_nome: string;
  aba_nome?: string;
}) {
  const formData = new FormData();
  formData.append("arquivo", payload.arquivo);
  formData.append("servidor", payload.servidor);
  formData.append("banco", payload.banco);
  formData.append("schema_nome", payload.schema_nome);
  formData.append("tabela_nome", payload.tabela_nome);
  if (payload.aba_nome) {
    formData.append("aba_nome", payload.aba_nome);
  }
  const { data } = await axiosInstance.post("/importacao-banco/analisar", formData);
  return data as AnaliseImportacaoBanco;
}

export async function analisarDocumentoImportacaoBancoBulk(payload: {
  arquivo: File;
  servidor: string;
  banco: string;
  aba_nome?: string;
}) {
  const formData = new FormData();
  formData.append("arquivo", payload.arquivo);
  formData.append("servidor", payload.servidor);
  formData.append("banco", payload.banco);
  if (payload.aba_nome) {
    formData.append("aba_nome", payload.aba_nome);
  }
  const { data } = await axiosInstance.post("/importacao-banco/analisar-bulk", formData);
  return data as AnaliseImportacaoBanco;
}

export async function importarDocumentoImportacaoBanco(payload: {
  arquivo: File;
  servidor: string;
  banco: string;
  schema_nome: string;
  tabela_nome: string;
  aba_nome?: string;
}) {
  const formData = new FormData();
  formData.append("arquivo", payload.arquivo);
  formData.append("servidor", payload.servidor);
  formData.append("banco", payload.banco);
  formData.append("schema_nome", payload.schema_nome);
  formData.append("tabela_nome", payload.tabela_nome);
  if (payload.aba_nome) {
    formData.append("aba_nome", payload.aba_nome);
  }
  const { data } = await axiosInstance.post("/importacao-banco/importar", formData);
  return data as ImportacaoBancoResultado;
}

export async function importarDocumentoImportacaoBancoBulk(payload: {
  arquivo: File;
  servidor: string;
  banco: string;
  aba_nome?: string;
}) {
  const formData = new FormData();
  formData.append("arquivo", payload.arquivo);
  formData.append("servidor", payload.servidor);
  formData.append("banco", payload.banco);
  if (payload.aba_nome) {
    formData.append("aba_nome", payload.aba_nome);
  }
  const { data } = await axiosInstance.post("/importacao-banco/importar-bulk", formData);
  return data as ImportacaoBancoResultado;
}

export async function pesquisarUsuario(cpfUsuario: string) {
  const { data } = await axiosInstance.post("/desbloqueio-usuario/pesquisar", { cpf_usuario: cpfUsuario });
  return data;
}

export async function desbloquearUsuario(cpfUsuario: string) {
  const { data } = await axiosInstance.post("/desbloqueio-usuario/executar", { cpf_usuario: cpfUsuario });
  return data;
}

export async function listarSmsFiltros(signal?: AbortSignal) {
  const { data } = await axiosInstance.get("/sms/infobip/filtros", { signal });
  return data as SmsFiltros;
}

export async function consultarSmsDashboard(params: URLSearchParams, signal?: AbortSignal, includeDetails = false) {
  const query = new URLSearchParams(params);
  if (includeDetails) {
    query.set("include_details", "true");
  }
  const { data } = await axiosInstance.get(`/sms/infobip/dashboard?${query.toString()}`, { signal });
  return data;
}

export async function enviarSmsTeste(payload: {
  id_cedente: number;
  canal: string;
  num_cliente: string;
  mensagem_template: string;
  variaveis_json?: string;
}) {
  const { data } = await axiosInstance.post("/sms/infobip/envio-teste", payload);
  return data;
}

export async function consultarSmsTeste(idCliente: number) {
  const { data } = await axiosInstance.get(`/sms/infobip/envio-teste/controle/${idCliente}`);
  return data;
}

export async function listarSmsLimitesEnvio() {
  const { data } = await axiosInstance.get("/sms/infobip/limites-envio");
  return data as SmsLimitesEnvio;
}

export async function atualizarSmsLimiteSemanal(idRegistro: number, volumeEnvio: number) {
  const { data } = await axiosInstance.put(`/sms/infobip/limites-envio/semanal/${idRegistro}`, {
    volume_envio: volumeEnvio,
  });
  return data as SmsLimiteCedente;
}

export async function atualizarSmsLimiteMensal(idRegistro: number, volumeEnvio: number) {
  const { data } = await axiosInstance.put(`/sms/infobip/limites-envio/mensal/${idRegistro}`, {
    volume_envio: volumeEnvio,
  });
  return data as SmsLimiteCedente;
}

export async function atualizarSmsLimiteTotalSemanal(idRegistro: number, limiteTotal: number) {
  const { data } = await axiosInstance.put(`/sms/infobip/limites-envio/total/semanal/${idRegistro}`, {
    limite_total: limiteTotal,
  });
  return data as SmsLimiteTotal;
}

export async function atualizarSmsLimiteTotalMensal(idRegistro: number, limiteTotal: number) {
  const { data } = await axiosInstance.put(`/sms/infobip/limites-envio/total/mensal/${idRegistro}`, {
    limite_total: limiteTotal,
  });
  return data as SmsLimiteTotal;
}

export async function listarRcsFiltros(signal?: AbortSignal) {
  const { data } = await axiosInstance.get("/rcs/infobip/filtros", { signal });
  return data as SmsFiltros;
}

export async function consultarRcsDashboard(params: URLSearchParams, signal?: AbortSignal, includeDetails = false) {
  const query = new URLSearchParams(params);
  if (includeDetails) query.set("include_details", "true");
  const { data } = await axiosInstance.get(`/rcs/infobip/dashboard?${query.toString()}`, { signal });
  return data;
}

export async function enviarRcsTeste(payload: { id_cedente: number; canal: string; num_cliente: string; mensagem_template: string; variaveis_json?: string }) {
  const { data } = await axiosInstance.post("/rcs/infobip/envio-teste", payload);
  return data;
}

export async function consultarRcsTeste(idCliente: number) {
  const { data } = await axiosInstance.get(`/rcs/infobip/envio-teste/controle/${idCliente}`);
  return data;
}

export async function listarRcsLimitesEnvio() {
  const { data } = await axiosInstance.get("/rcs/infobip/limites-envio");
  return data as SmsLimitesEnvio;
}

export async function atualizarRcsLimiteSemanal(idRegistro: number, volumeEnvio: number) {
  const { data } = await axiosInstance.put(`/rcs/infobip/limites-envio/semanal/${idRegistro}`, { volume_envio: volumeEnvio });
  return data as SmsLimiteCedente;
}

export async function atualizarRcsLimiteMensal(idRegistro: number, volumeEnvio: number) {
  const { data } = await axiosInstance.put(`/rcs/infobip/limites-envio/mensal/${idRegistro}`, { volume_envio: volumeEnvio });
  return data as SmsLimiteCedente;
}

export async function atualizarRcsLimiteTotalSemanal(idRegistro: number, limiteTotal: number) {
  const { data } = await axiosInstance.put(`/rcs/infobip/limites-envio/total/semanal/${idRegistro}`, { limite_total: limiteTotal });
  return data as SmsLimiteTotal;
}

export async function atualizarRcsLimiteTotalMensal(idRegistro: number, limiteTotal: number) {
  const { data } = await axiosInstance.put(`/rcs/infobip/limites-envio/total/mensal/${idRegistro}`, { limite_total: limiteTotal });
  return data as SmsLimiteTotal;
}

export async function listarNumerosInfobip() {
  const { data } = await axiosInstance.get("/whatsapp/infobip/numeros");
  return data as NumerosInfobipResponse;
}

export async function listarCarteirasPermitidasInfobip() {
  const { data } = await axiosInstance.get("/whatsapp/infobip/numeros/carteiras");
  return data as { status: string; quantidade: number; carteiras: CarteiraPermitidaInfobip[] };
}

export async function atualizarNumeroInfobip(
  idRegistro: number,
  payload: { ativo: number; carteiras_permitidas: string[] },
) {
  const { data } = await axiosInstance.put(`/whatsapp/infobip/numeros/${idRegistro}`, payload);
  return data as { status: string; mensagem: string; numero: NumeroInfobip };
}

export async function listarEmailFiltros() {
  const { data } = await axiosInstance.get("/email/sendgrid/filtros");
  return data as EmailFiltros;
}

export async function consultarEmailDashboard(params: URLSearchParams, includeDetails = false) {
  const query = new URLSearchParams(params);
  if (includeDetails) {
    query.set("include_details", "true");
  }
  const { data } = await axiosInstance.get(`/email/sendgrid/dashboard?${query.toString()}`);
  return data;
}

export async function enviarEmailTeste(payload: {
  carteira: string;
  grupo: string;
  canal: string;
  email_cliente: string;
  email_empresa: string;
  id_template: string;
  variaveis_json?: string;
}) {
  const { data } = await axiosInstance.post("/email/sendgrid/envio-teste", payload);
  return data;
}

export async function consultarEmailTeste(idCliente: number) {
  const { data } = await axiosInstance.get(`/email/sendgrid/envio-teste/controle/${idCliente}`);
  return data;
}

export async function bloquearEmailsSendgrid(emails: string[]) {
  const { data } = await axiosInstance.post("/email/sendgrid/suppresion", emails);
  return data;
}

export async function consultarWhatsappDashboard(provider: string, params: URLSearchParams) {
  const { data } = await axiosInstance.get(`/whatsapp/${provider}/dashboard?${params.toString()}`);
  return data;
}

export async function listarWhatsappTemplates(params?: {
  filtro?: string;
}) {
  const query = new URLSearchParams();
  if (params?.filtro) {
    query.set("filtro", params.filtro);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const { data } = await axiosInstance.get(`/whatsapp/templates${suffix}`);
  return data as { ok?: boolean; total: number; templates: WhatsappTemplate[] };
}

export async function detalharWhatsappTemplate(idTemplate: number) {
  const { data } = await axiosInstance.get(`/whatsapp/templates/${idTemplate}`);
  return data as { ok?: boolean; template: WhatsappTemplate };
}

export async function criarWhatsappTemplate(payload: {
  nome_interno: string;
  nome_template_meta: string;
  idioma: string;
  categoria_meta: string;
  header_tipo?: string | null;
  header_texto?: string | null;
  body_texto: string;
  footer_texto?: string | null;
  variaveis_json?: WhatsappTemplateVariavel[];
  ativo?: boolean;
}) {
  const { data } = await axiosInstance.post("/whatsapp/templates", payload);
  return data as { ok?: boolean; id_template: number; mensagem: string };
}

export async function atualizarWhatsappTemplate(
  idTemplate: number,
  payload: {
    nome_interno: string;
    nome_template_meta: string;
    idioma: string;
    categoria_meta: string;
    header_tipo?: string | null;
    header_texto?: string | null;
    body_texto: string;
    footer_texto?: string | null;
    variaveis_json?: WhatsappTemplateVariavel[];
    ativo?: boolean;
  },
) {
  const { data } = await axiosInstance.put(`/whatsapp/templates/${idTemplate}`, payload);
  return data as { ok?: boolean; id_template: number; mensagem: string };
}

export async function excluirWhatsappTemplate(idTemplate: number) {
  const { data } = await axiosInstance.delete(`/whatsapp/templates/${idTemplate}`);
  return data as { ok?: boolean; id_template: number; mensagem: string };
}

export async function atualizarAtivoWhatsappTemplate(idTemplate: number, ativo: boolean) {
  const { data } = await axiosInstance.patch(`/whatsapp/templates/${idTemplate}/ativo`, { ativo });
  return data as { ok?: boolean; id_template: number; ativo: boolean; mensagem?: string };
}

export async function submeterWhatsappTemplateMeta(idTemplate: number) {
  const { data } = await axiosInstance.post(`/whatsapp/templates/${idTemplate}/submeter-meta`, {});
  return data as {
    ok?: boolean;
    id_template: number;
    id_template_meta?: string | null;
    status_template: string;
    resposta_meta?: Record<string, unknown>;
  };
}

export async function listarCentrosCusto() {
  const { data } = await axiosInstance.get("/alteracoes-colaboradores/centros-custo");
  return data as CentroCusto[];
}

export async function obterConfiguracaoAlteracoesColaboradores() {
  const { data } = await axiosInstance.get("/alteracoes-colaboradores/config");
  return data as { cadastro_centro_custo_temporario_habilitado: boolean };
}

export async function criarCentroCustoTemporario(payload: { id_centro_custo: string; centro_custo: string; responsavel: string }) {
  const { data } = await axiosInstance.post("/alteracoes-colaboradores/centros-custo/temporario", payload);
  return data as { id_centro_custo: string; centro_custo: string; mensagem: string };
}

export async function listarFuncoes() {
  const { data } = await axiosInstance.get("/alteracoes-colaboradores/centros-custo/funcoes");
  return data as string[];
}

export async function consultarStatusSincronia() {
  const { data } = await axiosInstance.get("/alteracoes-colaboradores/sincronia/status");
  return data as { status: number };
}

export async function atualizarStatusSincronia(status: number) {
  const { data } = await axiosInstance.put("/alteracoes-colaboradores/sincronia/status", { status });
  return data;
}

export async function buscarColaborador(cpf: string) {
  const { data } = await axiosInstance.get(`/alteracoes-colaboradores/colaborador/${cpf}`);
  return data;
}

export async function atualizarColaborador(cpf: string, payload: Record<string, unknown>) {
  const { data } = await axiosInstance.put(`/alteracoes-colaboradores/colaborador/${cpf}`, payload);
  return data;
}

export async function atualizarColaboradorLote(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.put("/alteracoes-colaboradores/colaborador/lote", payload);
  return data;
}

export async function listarColaboradoresCarteiraVega() {
  const { data } = await axiosInstance.get("/usuarios-operacional/vega");
  return data as ColaboradorCarteiraOperacional[];
}

export async function listarCentrosCustoOperacional() {
  const { data } = await axiosInstance.get("/usuarios-operacional/vega/centros-custo");
  return data as CentroCusto[];
}

export async function atualizarCentroCusto2Operacional(
  cpf: string,
  payload: { centro_custo_2: string; responsavel: string },
) {
  const { data } = await axiosInstance.put(`/usuarios-operacional/vega/${cpf}/centro-custo-2`, payload);
  return data as { mensagem: string };
}

export async function listarGruposPortal() {
  const { data } = await axiosInstance.get("/gestao-usuarios/grupos");
  return data as GrupoPortal[];
}

export async function registrarUsuarioPortal(payload: {
  nm_login: string;
  nome_colaborador: string;
  cpf_colaborador: string;
  email_colaborador: string;
  senha_colaborador: string;
  confirmacao_senha: string;
  id_grupo: string;
}) {
  const { data } = await axiosInstance.post("/gestao-usuarios/usuarios", payload);
  return data as { status: string; mensagem: string };
}

export async function listarUsuariosPermissoesPortal() {
  const { data } = await axiosInstance.get("/gestao-usuarios/usuarios/permissoes");
  return data as UsuarioPermissaoPortal[];
}

export async function atualizarPermissoesUsuarioPortal(
  idUsuario: number,
  payload: { email_usuario: string; permissoes_usuario: string[] },
) {
  const { data } = await axiosInstance.put(`/gestao-usuarios/usuarios/${idUsuario}/permissoes`, payload);
  return data as { status: string; mensagem: string };
}

export async function excluirUsuarioPortal(idUsuario: number) {
  const { data } = await axiosInstance.delete(`/gestao-usuarios/usuarios/${idUsuario}`);
  return data as { status: string; mensagem: string };
}

export async function listarCargas(params?: URLSearchParams) {
  const query = params?.toString();
  const { data } = await axiosInstance.get(query ? `/cargas?${query}` : "/cargas");
  return data as CargasResponse;
}

export async function atualizarCargas(dataReferencia?: string) {
  const query = dataReferencia ? `?data=${encodeURIComponent(dataReferencia)}` : "";
  const { data } = await axiosInstance.post(`/cargas/refresh${query}`);
  return data as { status: string; mensagem: string };
}

export async function listarRecebimentoCargas(params?: URLSearchParams) {
  const query = params?.toString();
  const { data } = await axiosInstance.get(query ? `/cargas/recebimento?${query}` : "/cargas/recebimento");
  return data as CargasRecebimentoResponse;
}

export async function listarControleTarefas() {
  const { data } = await axiosInstance.get("/controle-tarefas");
  return data as ControleTarefasResponse;
}

export async function listarProcessos(params?: { login?: string; somenteUsuario?: boolean }) {
  const query = new URLSearchParams();
  if (params?.login) {
    query.set("login", params.login);
  }
  if (params?.somenteUsuario !== undefined) {
    query.set("somente_usuario", String(params.somenteUsuario));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const { data } = await axiosInstance.get(`/processos${suffix}`);
  return data as ProcessosResponse;
}

export async function listarReguaMisCarteiras() {
  const { data } = await axiosInstance.get("/regua-mis/carteiras");
  return data as ListarReguaCarteirasResponse;
}

export async function atualizarReguaMisCarteira(carteira: string, diasAbertura: number) {
  const { data } = await axiosInstance.put(`/regua-mis/carteiras/${encodeURIComponent(carteira)}`, {
    dias_abertura: diasAbertura,
  });
  return data as AtualizarReguaCarteiraResponse;
}

export async function listarDashboardTreinamento(params: URLSearchParams) {
  const { data } = await axiosInstance.get(`/treinamentos/dashboard?${params.toString()}`);
  return data;
}
export async function exportarDashboardTreinamento(params: URLSearchParams) {
  const response = await axiosInstance.get(`/treinamentos/dashboard/exportar?${params.toString()}`, { responseType: "blob" });
  return response.data as Blob;
}
export async function listarAdmissoesTreinamento(params: URLSearchParams) {
  const { data } = await axiosInstance.get(`/treinamentos/admissoes?${params.toString()}`);
  return data;
}
export async function criarAdmissao(payload: Record<string, unknown>) { const { data } = await axiosInstance.post("/treinamentos/admissoes", payload); return data; }
export async function atualizarAdmissao(id: number, payload: Record<string, unknown>) { const { data } = await axiosInstance.put(`/treinamentos/admissoes/${id}`, payload); return data; }
export async function criarAdmissoesLote(payload: Record<string, unknown>[]) { const { data } = await axiosInstance.post("/treinamentos/admissoes/lote", payload); return data; }
export async function analisarPlanilhaAdmissoes(arquivo: File) { const form = new FormData(); form.append("arquivo", arquivo); const { data } = await axiosInstance.post("/treinamentos/admissoes/importacao/analisar", form); return data; }
export async function excluirAdmissao(id: number) { const { data } = await axiosInstance.delete(`/treinamentos/admissoes/${id}`); return data; }
export async function listarTreinamentos(params: URLSearchParams) { const { data } = await axiosInstance.get(`/treinamentos?${params.toString()}`); return data; }
export async function criarTreinamento(payload: Record<string, unknown>) { const { data } = await axiosInstance.post("/treinamentos", payload); return data; }
export async function atualizarTreinamento(id: number, payload: Record<string, unknown>) { const { data } = await axiosInstance.put(`/treinamentos/${id}`, payload); return data; }
export async function criarTreinamentosLote(payload: Record<string, unknown>[]) { const { data } = await axiosInstance.post("/treinamentos/lote", payload); return data; }
export async function analisarPlanilhaTreinamentos(arquivo: File) { const form = new FormData(); form.append("arquivo", arquivo); const { data } = await axiosInstance.post("/treinamentos/importacao/analisar", form); return data; }
export async function excluirTreinamento(id: number) { const { data } = await axiosInstance.delete(`/treinamentos/${id}`); return data; }
export async function listarAgendaTreinamentos(params: URLSearchParams) { const { data } = await axiosInstance.get(`/treinamentos/agenda?${params.toString()}`); return data; }
export async function listarOpcoesAgendaTreinamentos(params?: URLSearchParams) { const query=params?.toString(); const { data } = await axiosInstance.get(`/treinamentos/agenda/opcoes${query?`?${query}`:""}`); return data; }
export async function listarOpcoesAgendaDia2Treinamentos(params?: URLSearchParams) { const query=params?.toString(); const { data } = await axiosInstance.get(`/treinamentos/agenda/opcoes-dia2${query?`?${query}`:""}`); return data; }
export async function listarCarteirasTreinamentos() { const { data } = await axiosInstance.get("/treinamentos/carteiras"); return data; }
export async function listarHistoricoOperador(params: URLSearchParams) { const { data } = await axiosInstance.get(`/treinamentos/operador?${params.toString()}`); return data; }
export async function listarResponsaveisQualidade() { const { data } = await axiosInstance.get("/treinamentos/responsaveis-qualidade"); return data; }
export async function criarAgendaTreinamento(payload: Record<string, unknown>) { const { data } = await axiosInstance.post("/treinamentos/agenda", payload); return data; }
export async function atualizarAgendaTreinamento(id: number, payload: Record<string, unknown>) { const { data } = await axiosInstance.put(`/treinamentos/agenda/${id}`, payload); return data; }
export async function excluirAgendaTreinamento(id: number) { const { data } = await axiosInstance.delete(`/treinamentos/agenda/${id}`); return data; }
export async function listarDashboardMonitoriasVega(ano: number, mes: number) { const { data } = await axiosInstance.get(`/treinamentos/monitorias-vega/dashboard?ano=${ano}&mes=${mes}`); return data; }
export async function listarAnosMonitoriasVega() { const { data } = await axiosInstance.get("/treinamentos/monitorias-vega/anos"); return data; }
export async function exportarMonitoriasVega(ano: number) { const response = await axiosInstance.get(`/treinamentos/monitorias-vega/exportar?ano=${ano}`, { responseType: "blob" }); return response.data as Blob; }
export async function salvarMonitoriasVegaLote(payload: Record<string, unknown>[]) { const { data } = await axiosInstance.post("/treinamentos/monitorias-vega/lote", payload); return data; }
export async function analisarPlanilhaMonitoriasVega(arquivo: File) { const form = new FormData(); form.append("arquivo", arquivo); const { data } = await axiosInstance.post("/treinamentos/monitorias-vega/importacao/analisar", form); return data; }

export async function executarAcaoControleTarefa(
  taskId: number,
  taskPath: string,
  taskName: string,
  acao: "executar" | "finalizar" | "habilitar" | "desabilitar",
) {
  const { data } = await axiosInstance.post(`/controle-tarefas/acao/${acao}`, {
    task_id: taskId,
    task_path: taskPath,
    task_name: taskName,
  });
  return data as { status: string; mensagem: string };
}

export async function listarChamados() {
  const { data } = await axiosInstance.get("/chamados");
  return data as ListaChamadosResponse;
}

export async function listarDemandasAreas() {
  const { data } = await axiosInstance.get("/chamados/areas");
  return data as { itens: DemandaArea[]; total: number };
}

export async function listarDemandasPlataformas() {
  const { data } = await axiosInstance.get("/chamados/plataformas");
  return data as { itens: DemandaPlataforma[]; total: number };
}

export async function criarDemandaPlataforma(payload: { nm_plataforma: string }) {
  const { data } = await axiosInstance.post("/chamados/plataformas", payload);
  return data as DemandaPlataforma;
}

export async function listarDemandasTiposSolicitacao() {
  const { data } = await axiosInstance.get("/chamados/tipos-solicitacao");
  return data as { itens: DemandaTipoSolicitacao[]; total: number };
}

export async function listarAgendaPendenciasAbertas() {
  const { data } = await axiosInstance.get("/agenda/pendencias-abertas");
  return data as AgendaPendenciaAberta[];
}

export async function criarChamado(payload: {
  titulo: string;
  descricao: string;
  tipo_solicitacao: "transferencia_arquivo" | "carga" | "outro";
  prioridade: Chamado["prioridade"];
  evidencia?: File[];
}) {
  const formData = new FormData();
  formData.append("titulo", payload.titulo);
  formData.append("descricao", payload.descricao);
  formData.append("tipo_solicitacao", payload.tipo_solicitacao);
  formData.append("prioridade", payload.prioridade);
  for (const evidencia of payload.evidencia ?? []) {
    formData.append("evidencia", evidencia);
  }
  const { data } = await axiosInstance.post("/chamados", formData);
  return data as Chamado;
}

export async function atualizarChamado(
  chamadoId: number,
  payload: Partial<Pick<Chamado, "status" | "prioridade" | "descricao">>,
) {
  const { data } = await axiosInstance.patch(`/chamados/${chamadoId}`, payload);
  return data as Chamado;
}

export async function excluirChamado(chamadoId: number) {
  await axiosInstance.delete(`/chamados/${chamadoId}`);
}

export async function baixarEvidenciaChamado(chamadoId: number) {
  const response = await axiosInstance.get(`/chamados/${chamadoId}/evidencia`, { responseType: "blob" });
  return response.data as Blob;
}

export async function listarHistoricoControleTarefa(taskPath: string, taskName: string) {
  const params = new URLSearchParams({
    task_path: taskPath,
    task_name: taskName,
  });
  const { data } = await axiosInstance.get(`/controle-tarefas/historico?${params.toString()}`);
  return data as { historico: TaskHistorico[] };
}

export type PortalAcordoFiltros = {
  carteiras: string[];
  categorias: string[];
  canais: string[];
  periodo_disponivel: {
    primeiro_evento: string | null;
    ultimo_evento: string | null;
    total_eventos: number;
  };
};

export type PortalAcordoEtapa = {
  etapa: string;
  categorias: string[];
  dispositivos: number;
  cpfs_unicos: number;
  eventos: number;
  pct_da_primeira: number;
  pct_da_anterior: number | null;
};

export type PortalAcordoDashboard = {
  origem: string;
  periodo: { inicio: string; fim: string };
  resumo: {
    total_eventos: number;
    cpfs_unicos: number;
    dispositivos: number;
    eventos_desconhecidos: number;
    eventos_sem_catalogo: number;
    eventos_erro: number;
    cedente_sem_alias: number;
    cedente_sem_grupo: number;
    cedente_ausente: number;
    carteira_por_contexto: number;
    taxa_erro_pct: number;
    dias_com_dados: number;
  };
  eventos_por_dia: Array<{ periodo: string; total_eventos: number; cpfs_unicos: number }>;
  cedentes_sem_grupo: Array<{ cedente: string; total: number }>;
  por_categoria: Array<{ categoria: string; total: number; dispositivos: number; cpfs_unicos: number }>;
  jornada: PortalAcordoEtapa[];
  top_eventos: Array<{ evento: string; nome: string; categoria: string; total: number }>;
  por_carteira: Array<{ carteira: string; total: number; cpfs_unicos: number }>;
  nao_catalogados: Array<{ evento_original: string; total: number; primeiro: string; ultimo: string }>;
  origens_trafego: Array<{ canal: string; total: number; dispositivos: number }>;
  alertas: Array<{ tipo: string; mensagem: string }>;
};

export async function listarPortalAcordoFiltros(origem: string, signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`/portalacordo/monitoramento/filtros?origem=${encodeURIComponent(origem)}`, { signal });
  return data as PortalAcordoFiltros;
}

export async function consultarPortalAcordoDashboard(params: URLSearchParams, signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`/portalacordo/monitoramento/dashboard?${params.toString()}`, { signal });
  return data as PortalAcordoDashboard;
}

export type PortalAcordoCarteira = {
  id: number;
  codigo: string;
  nome: string;
  id_cedente: number | null;
  ativo: boolean;
  atualizado_em: string;
  qtd_landing: number;
  qtd_numero: number;
  qtd_mailing: number;
  qtd_alias: number;
};

export type PortalAcordoLanding = {
  id: number;
  slug: string;
  nome_cliente: string;
  ativo: boolean;
  ordem: number;
  imagem_logo: string;
  imagem_fundo: string;
  logo_class: string | null;
  atualizado_em: string;
  carteira: string | null;
  carteira_nome: string | null;
  carteira_ativa: boolean | null;
  mailing_prefixo: string | null;
  whatsapp_efetivo: string | null;
  whatsapp_origem: string;
  qtd_faq_ativa: number;
  exibir_na_home: boolean;
  logo_class_home: string | null;
  titulo: string | null;
  subtitulo: string | null;
  numero_whatsapp: string | null;
};

export type PortalAcordoFaq = { id: number; ordem: number; pergunta: string; resposta: string; ativo: boolean };

export type PortalAcordoMailing = {
  id: number;
  carteira: string;
  carteira_nome: string;
  prefixo: string;
  campanha: string | null;
  observacao: string | null;
  ativo: boolean;
  atualizado_em: string;
  qtd_alias: number;
  arquivo_exemplo: string;
};

export type PortalAcordoNumero = {
  id: number;
  canal: string;
  escopo: string;
  carteira: string | null;
  carteira_nome: string | null;
  numero: string;
  rotulo: string | null;
  prioridade: number;
  ativo: boolean;
  atualizado_em: string;
};

export type PortalAcordoAlias = {
  id: number;
  alias: string;
  carteira: string;
  carteira_nome: string;
  tipo_match: string;
  prioridade: number;
  ativo: boolean;
  atualizado_em: string;
};

export type PortalAcordoAuditoria = {
  id: number;
  entidade: string;
  id_entidade: number | null;
  acao: string;
  dados_antes: string | null;
  dados_depois: string | null;
  ator: string;
  origem_ip: string | null;
  criado_em: string;
};

export type PortalAcordoEscrita = { status: string; mensagem: string; aviso: string };

const CFG = "/portalacordo/config";

export async function listarPortalAcordoCarteiras(signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`${CFG}/carteiras`, { signal });
  return data.itens as PortalAcordoCarteira[];
}

export async function listarPortalAcordoLandings(signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`${CFG}/landing-pages`, { signal });
  return data.itens as PortalAcordoLanding[];
}

export async function listarPortalAcordoFaq(slug: string, signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`${CFG}/landing-pages/${encodeURIComponent(slug)}/faq`, { signal });
  return data.itens as PortalAcordoFaq[];
}

export async function listarPortalAcordoMailings(signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`${CFG}/mailings`, { signal });
  return data.itens as PortalAcordoMailing[];
}

export async function listarPortalAcordoNumeros(signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`${CFG}/numeros-contato`, { signal });
  return data.itens as PortalAcordoNumero[];
}

export async function listarPortalAcordoAliases(signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`${CFG}/aliases`, { signal });
  return data.itens as PortalAcordoAlias[];
}

export type PortalAcordoImagem = {
  caminho: string;
  usos: number;
  /** "banco de imagens" = enviada pelo Atlas, publica sem deploy do portal. */
  origem: string;
  /** URL publica do share, so para a miniatura no Atlas. null = arquivo do bundle. */
  url_preview: string | null;
};

export async function listarPortalAcordoImagens(signal?: AbortSignal) {
  const { data } = await axiosInstance.get(`${CFG}/imagens`, { signal });
  return data.itens as PortalAcordoImagem[];
}

export async function listarPortalAcordoAuditoria(entidade?: string, signal?: AbortSignal) {
  const query = entidade ? `?entidade=${encodeURIComponent(entidade)}` : "";
  const { data } = await axiosInstance.get(`${CFG}/auditoria${query}`, { signal });
  return data.itens as PortalAcordoAuditoria[];
}

export async function salvarPortalAcordoCarteira(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.post(`${CFG}/carteiras`, payload);
  return data as PortalAcordoEscrita;
}

export async function salvarPortalAcordoAlias(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.post(`${CFG}/aliases`, payload);
  return data as PortalAcordoEscrita;
}

export async function salvarPortalAcordoMailing(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.post(`${CFG}/mailings`, payload);
  return data as PortalAcordoEscrita;
}

export async function salvarPortalAcordoNumero(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.post(`${CFG}/numeros-contato`, payload);
  return data as PortalAcordoEscrita;
}

export async function salvarPortalAcordoLanding(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.post(`${CFG}/landing-pages`, payload);
  return data as PortalAcordoEscrita;
}

// Exclusao definitiva: apaga a linha e, por cascata da FK, o FAQ inteiro. O que
// sobra e a copia de tudo em cfg.TB_CFG_AUDITORIA, visivel na aba Auditoria.
export async function excluirPortalAcordoLanding(slug: string) {
  const { data } = await axiosInstance.delete(`${CFG}/landing-pages/${encodeURIComponent(slug)}`);
  return data as PortalAcordoEscrita;
}

// PATCH /landing-pages/{slug}/situacao continua no backend: e a operacao leve para
// publicar/despublicar e mostrar-na-home. A tela deixou de usa-la quando os botoes
// da linha sairam da tabela - hoje esses dois campos sao editados no modal, que manda
// o registro inteiro. Sem cliente no front, a funcao virou codigo morto e saiu daqui.

// ============================================================================
// Transferencia (robo de organizacao de arquivos - TB_ARQUIVO_MAPA em DB_SFTP)
// Tela dirigida por metadados: as colunas vem do backend, entao uma coluna nova
// no robo aparece aqui sem alterar este arquivo.
// ============================================================================

export type TransferenciaTipoCampo =
  | "texto"
  | "textolongo"
  | "numero"
  | "decimal"
  | "toggle"
  | "data"
  | "datahora"
  | "cedente";

export type TransferenciaColuna = {
  nome: string;
  label: string;
  tipo: TransferenciaTipoCampo;
  obrigatorio: boolean;
  somente_leitura: boolean;
  nullable: boolean;
  max_length: number | null;
  valor_padrao: boolean | null;
};

export type TransferenciaCedente = {
  id_cedente: number;
  nm_cedente: string;
};

export type TransferenciaMetadados = {
  colunas: TransferenciaColuna[];
  cedentes: TransferenciaCedente[];
};

export type TransferenciaMapa = Record<string, unknown> & {
  nm_cedente?: string | null;
};

export async function obterTransferenciaMetadados(signal?: AbortSignal) {
  const { data } = await axiosInstance.get("/transferencias/metadados", { signal });
  return data as TransferenciaMetadados;
}

export async function listarTransferenciaMapas(signal?: AbortSignal) {
  const { data } = await axiosInstance.get("/transferencias/mapas", { signal });
  return data.itens as TransferenciaMapa[];
}

export async function salvarTransferenciaMapa(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.post("/transferencias/mapas", payload);
  return data as { status: string; mensagem: string };
}

export async function alterarTransferenciaMapaAtivo(idMapa: number, ativo: boolean) {
  const { data } = await axiosInstance.patch(`/transferencias/mapas/${idMapa}/ativo`, { ativo });
  return data as { status: string; mensagem: string };
}
