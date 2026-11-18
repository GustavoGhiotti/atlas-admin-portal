export const GROUPS = {
  admin: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO"],
  digital: ["DIGITAL"],
  desbloqueio: [
    "ADMINISTRADORES DE SISTEMA",
    "DESENVOLVIMENTO",
    "DIGITAL",
    "GESTAO OPERACIONAL",
    "COORDENACAO OPERACIONAL",
    "SEGURANCA INFRAESTRUTURA",
    "MARKETING",
    "PLANEJAMENTO MIS DADOS",
    "RH",
    "ADMINISTRATIVO",
    "CONTROL DESK",
    "CRM",
    "DIRETORIA",
    "GERENCIA",
    "FINANCEIRO",
    "JURIDICO",
    "QUALIDADE",
    "SEGURANCA INFRAESTRUTURA"

  ],
  reguaMIS: ["PLANEJAMENTO MIS DADOS", "DESENVOLVIMENTO"],
  usuariosCarteira: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "COORDENACAO OPERACIONAL"],
  imagens: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "MARKETING", "SEGURANCA INFRAESTRUTURA"],
  agenda: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIRETORIA", "GERENCIA", "COORDENACAO OPERACIONAL"],
  smsDashboard: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS", "DIRETORIA", "GERENCIA"],
  sms: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS"],
  emailDashboard: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS", "DIRETORIA", "GERENCIA"],
  email: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS"],
  emailBloqueio: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "PLANEJAMENTO MIS DADOS", "CONTROL DESK",
    "JURIDICO",
    "DIGITAL"
  ],
  whatsapp: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS"],
  rcsDashboard: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS", "DIRETORIA", "GERENCIA"],
  rcs: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "PLANEJAMENTO MIS DADOS"],
  whatsappTemplates: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "MARKETING"],
  alteracoes: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "RH", "SEGURANCA INFRAESTRUTURA"],
  chamados: [
    "ADMINISTRADORES DE SISTEMA",
    "DESENVOLVIMENTO",
    "DIGITAL",
    "GESTAO OPERACIONAL",
    "COORDENACAO OPERACIONAL",
    "SEGURANCA INFRAESTRUTURA",
    "MARKETING",
    "PLANEJAMENTO MIS DADOS",
    "RH",
    "ADMINISTRATIVO",
    "CONTROL DESK",
    "CRM",
    "DIRETORIA",
    "GERENCIA",
    "FINANCEIRO",
    "JURIDICO",
    "QUALIDADE",
  ],
  cargas: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "PLANEJAMENTO MIS DADOS", "GESTAO OPERACIONAL", "COORDENACAO OPERACIONAL", "CRM", "DIRETORIA", "GERENCIA"],
  controleTarefas: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "PLANEJAMENTO MIS DADOS", "CRM"],
  arquivos: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "CRM", "PLANEJAMENTO MIS DADOS"],
  treinamentos: ["ADMINISTRADORES DE SISTEMA", "QUALIDADE"],
  // Espelham PORTALACORDO_GROUPS e PORTALACORDO_CONFIG_GROUPS em
  // src/infrastructure/dependencies/access_groups.py. Mudou aqui, muda la.
  // Quem configura tambem monitora; a gerencia so acompanha.
  portalAcordo: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "MARKETING", "GERENCIA"],
  portalAcordoConfig: ["ADMINISTRADORES DE SISTEMA", "DESENVOLVIMENTO", "DIGITAL", "MARKETING"],
};

export const ALLOWED_LOGINS = {
  treinamentos: ["ACFIORENTINI", "PISFREITAS"],
};

export function hasAnyGroup(userGroups: string[], allowedGroups: string[]) {
  return allowedGroups.some((group) => userGroups.includes(group));
}

export function hasRouteAccess(
  userGroups: string[],
  userLogin: string | undefined,
  allowedGroups?: string[],
  allowedLogins?: string[],
) {
  const hasAllowedGroup = !!allowedGroups?.length && hasAnyGroup(userGroups, allowedGroups);
  const normalizedLogin = (userLogin || "").toUpperCase();
  const hasAllowedLogin = !!allowedLogins?.length && allowedLogins.some((login) => normalizedLogin === login.toUpperCase());

  if (!allowedGroups?.length && !allowedLogins?.length) {
    return true;
  }

  return hasAllowedGroup || hasAllowedLogin;
}
