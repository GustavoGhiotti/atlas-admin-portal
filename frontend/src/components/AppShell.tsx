import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import CommandSearch from "@/components/ui/CommandSearch";
import AuthFooter from "@/components/ui/AuthFooter";
import { useAuth } from "@/contexts/AuthContext";
import { navigationSections, type NavigationItem } from "@/lib/navigation";
import { GROUPS, hasAnyGroup, hasRouteAccess } from "@/lib/permissions";
import { listarAgendaPendenciasAbertas, listarChamados, type Chamado } from "@/services/atlasApi";
import grupoAcmeLogo from "@/assets/grupo-acme-logo.png";

type ShellChamadoAlert = {
  id: string;
  chamadoId?: number;
  route?: string;
  title: string;
  message: string;
};

function parseChamadoDate(value?: string | null) {
  if (!value) return 0;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getNewestOpenDevChamado(chamados: Chamado[]) {
  return chamados.reduce<{ item: Chamado | null; timestamp: number }>(
    (current, item) => {
      if (item.status !== "open") {
        return current;
      }
      const timestamp = parseChamadoDate(item.criado_em);
      if (timestamp > current.timestamp) {
        return { item, timestamp };
      }
      return current;
    },
    { item: null, timestamp: 0 },
  );
}

function getNewestRequesterUpdate(chamados: Chamado[]) {
  return chamados.reduce<{ item: Chamado | null; timestamp: number }>(
    (current, item) => {
      const createdAt = parseChamadoDate(item.criado_em);
      const updatedAt = parseChamadoDate(item.atualizado_em);
      if (updatedAt > createdAt && updatedAt > current.timestamp) {
        return { item, timestamp: updatedAt };
      }
      return current;
    },
    { item: null, timestamp: 0 },
  );
}

function NavIcon({ icon }: { icon: NavigationItem["icon"] }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (icon) {
    case "home":
      return (
        <svg {...commonProps}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10.5V20h13V10.5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...commonProps}>
          <path d="M12 3.5 19 6v5.8c0 4.1-2.8 7.9-7 9.2-4.2-1.3-7-5.1-7-9.2V6l7-2.5Z" />
          <path d="m9.5 12 1.7 1.7 3.6-3.7" />
        </svg>
      );
    case "unlock":
      return (
        <svg {...commonProps}>
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8.5a4 4 0 0 1 7.4-2.1" />
        </svg>
      );
    case "users":
      return (
        <svg {...commonProps}>
          <path d="M16.5 19a4.5 4.5 0 0 0-9 0" />
          <circle cx="12" cy="9" r="3" />
          <path d="M20 18a3.5 3.5 0 0 0-3-3.5" />
          <path d="M17 6.5a2.5 2.5 0 0 1 0 5" />
        </svg>
      );
    case "image":
      return (
        <svg {...commonProps}>
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m20.5 16-4.5-4.5-5 5-2-2L3.5 20" />
        </svg>
      );
    case "sms":
      return (
        <svg {...commonProps}>
          <rect x="3.5" y="5" width="17" height="12" rx="2" />
          <path d="m6.5 8 5.5 4 5.5-4" />
          <path d="M8 19h8" />
        </svg>
      );
    case "email":
      return (
        <svg {...commonProps}>
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <path d="m5.5 7 6.5 5 6.5-5" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...commonProps}>
          <path d="M12 20a8 8 0 1 0-4.3-1.3L5 20l1.4-2.5A8 8 0 0 0 12 20Z" />
          <path d="M9.2 9.3c.3-.7.7-.7 1-.7.2 0 .5 0 .7.5.2.4.7 1.6.7 1.7.1.2.1.4 0 .6-.1.2-.2.3-.4.5l-.3.3c-.1.1-.2.3-.1.5.1.2.6 1 1.4 1.6.9.8 1.7 1 1.9 1.1.2.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1.2.1 1.4.7 1.7.8.2.1.4.2.4.4 0 .2-.1 1-.7 1.4-.4.3-.9.5-1.5.5-.4 0-.9-.1-1.4-.3-.9-.4-2-.9-3.3-2.1-1-.9-1.8-2-2.2-2.8-.4-.9-.4-1.8 0-2.5Z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" />
        </svg>
      );
    case "robot":
      return (
        <svg {...commonProps}>
          <rect x="6" y="8" width="12" height="9" rx="2" />
          <path d="M12 4v4" />
          <path d="M9 4h6" />
          <circle cx="10" cy="12" r="1" />
          <circle cx="14" cy="12" r="1" />
          <path d="M9 15h6" />
          <path d="M4 11.5h2" />
          <path d="M18 11.5h2" />
          <path d="M9 17v2" />
          <path d="M15 17v2" />
        </svg>
      );
    case "folder":
      return (
        <svg {...commonProps}>
          <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3l1.8 2H18A2.5 2.5 0 0 1 20.5 9.5v7A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
          <path d="M3.5 9h17" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...commonProps}>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V10a1.5 1.5 0 0 0 0 3v2.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 15.5V13a1.5 1.5 0 0 0 0-3Z" />
          <path d="M12 8.5v7" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...commonProps}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3" />
          <path d="M16 3.5v3" />
          <path d="M4 9h16" />
          <path d="M8 13h2" />
          <path d="M12 13h2" />
          <path d="M16 13h1" />
          <path d="M8 16h2" />
          <path d="M12 16h2" />
        </svg>
      );
    case "activity":
      return (
        <svg {...commonProps}>
          <path d="M3 12h3.5l2.5-7 4 14 2.5-7H21" />
        </svg>
      );
    case "loader":
      return (
        <svg {...commonProps}>
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M4.6 4.6 6.7 6.7" />
          <path d="M17.3 17.3l2.1 2.1" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <path d="M4.6 19.4l2.1-2.1" />
          <path d="M17.3 6.7l2.1-2.1" />
        </svg>
      );
  }
}

function isRouteActive(itemTo: string, pathname: string) {
  if (itemTo === "/") {
    return pathname === "/";
  }
  return pathname === itemTo;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [chamadoAlert, setChamadoAlert] = useState<ShellChamadoAlert | null>(
    null,
  );
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const hasItemAccess = (item: NavigationItem) => {
    return hasRouteAccess(
      user?.grupos ?? [],
      user?.nm_login,
      item.groups,
      item.logins,
    );
  };

  const commandItems = useMemo(
    () =>
      navigationSections.flatMap((section) =>
        section.items.filter((item) => hasItemAccess(item)),
      ),
    [user?.grupos, user?.nm_login],
  );

  const sidebarItems = useMemo(
    () => commandItems.filter((item) => item.sidebar),
    [commandItems],
  );
  const sidebarEntries = useMemo(() => {
    const entries: Array<
      | { type: "item"; item: NavigationItem }
      | {
          type: "group";
          title: string;
          icon: NavigationItem["icon"];
          items: NavigationItem[];
        }
    > = [];
    let trailingItem: { type: "item"; item: NavigationItem } | null = null;

    const groups = new Map<
      string,
      { icon: NavigationItem["icon"]; items: NavigationItem[] }
    >();

    for (const item of sidebarItems) {
      if (!item.sidebarGroup) {
        if (item.to === "/chamados") {
          trailingItem = { type: "item", item };
        } else {
          entries.push({ type: "item", item });
        }
        continue;
      }

      const currentGroup = groups.get(item.sidebarGroup);
      if (currentGroup) {
        currentGroup.items.push(item);
      } else {
        groups.set(item.sidebarGroup, { icon: item.icon, items: [item] });
      }
    }

    for (const [title, group] of groups.entries()) {
      entries.push({
        type: "group",
        title,
        icon: group.icon,
        items: group.items,
      });
    }
    if (trailingItem) {
      entries.push(trailingItem);
    }

    return entries;
  }, [sidebarItems]);
  const isAdmin = hasAnyGroup(user?.grupos ?? [], GROUPS.admin);
  const canAccessChamados = hasRouteAccess(
    user?.grupos ?? [],
    user?.nm_login,
    GROUPS.chamados,
  );
  const isDevChamadosUser = hasAnyGroup(user?.grupos ?? [], [
    "DESENVOLVIMENTO",
  ]);
  const chamadoAlertStorageKey = useMemo(() => {
    if (!user?.nm_login) return "";
    return `atlas.chamados.alert.v1.${user.nm_login}.${isDevChamadosUser ? "dev" : "solicitante"}`;
  }, [user?.nm_login, isDevChamadosUser]);
  const chamadoAlertSessionKey = useMemo(() => {
    if (!user?.nm_login) return "";
    return `atlas.chamados.alert.session.v1.${user.nm_login}.${isDevChamadosUser ? "dev" : "solicitante"}`;
  }, [user?.nm_login, isDevChamadosUser]);
  const agendaPendingAlertSessionKey = useMemo(() => {
    if (!user?.nm_login) return "";
    return `atlas.agenda.pendencias.session.v1.${user.nm_login}`;
  }, [user?.nm_login]);

  const userMenuItems = useMemo(
    () =>
      [
        { label: "Perfil", to: "/perfil", icon: "shield" as const },
        ...(isAdmin
          ? [
              {
                label: "Atlas - Permissões de usuários",
                to: "/permissoes",
                icon: "settings" as const,
              },
              {
                label: "Atlas - Criação manual de usuários",
                to: "/usuarios/criacao-manual",
                icon: "users" as const,
              },
            ]
          : []),
      ] satisfies Array<{
        label: string;
        to: string;
        icon: NavigationItem["icon"];
        external?: boolean;
      }>,
    [isAdmin],
  );

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      let changed = false;

      for (const entry of sidebarEntries) {
        if (entry.type !== "group") continue;
        const hasActiveItem = entry.items.some((item) =>
          isRouteActive(item.to, location.pathname),
        );
        if (hasActiveItem && !next[entry.title]) {
          next[entry.title] = true;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [location.pathname, sidebarEntries]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.nm_login || !canAccessChamados || !chamadoAlertStorageKey) {
      setChamadoAlert(null);
      return;
    }

    let cancelled = false;

    async function checkChamadosAlerts() {
      try {
        const response = await listarChamados();
        if (cancelled) return;

        const event = isDevChamadosUser
          ? getNewestOpenDevChamado(response.itens)
          : getNewestRequesterUpdate(response.itens);
        if (!event.item || !event.timestamp) {
          if (isDevChamadosUser && chamadoAlertSessionKey) {
            sessionStorage.removeItem(chamadoAlertSessionKey);
          }
          return;
        }

        if (isDevChamadosUser) {
          const seenInSession = Number(
            sessionStorage.getItem(chamadoAlertSessionKey) || "0",
          );
          if (event.timestamp <= seenInSession) {
            return;
          }

          sessionStorage.setItem(
            chamadoAlertSessionKey,
            String(event.timestamp),
          );
          setChamadoAlert({
            id: `dev-${event.item.id}-${event.timestamp}`,
            chamadoId: event.item.id,
            title: "Novo chamado recebido",
            message: `O chamado "${event.item.titulo}" segue aberto e aguardando atendimento do time de desenvolvimento.`,
          });
          return;
        }

        const storedTimestamp = Number(
          localStorage.getItem(chamadoAlertStorageKey) || "0",
        );
        if (!storedTimestamp) {
          localStorage.setItem(chamadoAlertStorageKey, String(event.timestamp));
          return;
        }

        if (event.timestamp <= storedTimestamp) {
          return;
        }

        localStorage.setItem(chamadoAlertStorageKey, String(event.timestamp));
        setChamadoAlert({
          id: `${isDevChamadosUser ? "dev" : "solicitante"}-${event.item.id}-${event.timestamp}`,
          chamadoId: event.item.id,
          title: isDevChamadosUser
            ? "Novo chamado recebido"
            : "Chamado atualizado",
          message: isDevChamadosUser
            ? `O chamado "${event.item.titulo}" foi aberto e entrou na fila do time de desenvolvimento.`
            : `O chamado "${event.item.titulo}" recebeu uma nova atualização.`,
        });
      } catch {
        // falha silenciosa para nao bloquear o shell
      }
    }

    void checkChamadosAlerts();
    const intervalId = window.setInterval(checkChamadosAlerts, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    user?.nm_login,
    canAccessChamados,
    chamadoAlertStorageKey,
    chamadoAlertSessionKey,
    isDevChamadosUser,
  ]);

  useEffect(() => {
    if (!user?.nm_login || !agendaPendingAlertSessionKey) {
      return;
    }

    let cancelled = false;

    async function checkAgendaPendencias() {
      try {
        const pendencias = await listarAgendaPendenciasAbertas();
        if (cancelled || pendencias.length === 0) return;

        const signature = pendencias.map((item) => item.id).sort((a, b) => a - b).join("-");
        const seenSignature = sessionStorage.getItem(agendaPendingAlertSessionKey) || "";
        if (signature === seenSignature) return;

        sessionStorage.setItem(agendaPendingAlertSessionKey, signature);
        setChamadoAlert({
          id: `agenda-pendencias-${signature}`,
          route: "/agenda",
          title: "Pendencias abertas na Agenda",
          message:
            pendencias.length === 1
              ? `Voce possui 1 pendencia aberta na agenda da carteira ${pendencias[0].carteira}.`
              : `Voce possui ${pendencias.length} pendencias abertas na Agenda.`,
        });
      } catch {
        // falha silenciosa para nao bloquear o shell
      }
    }

    void checkAgendaPendencias();
    const intervalId = window.setInterval(checkAgendaPendencias, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [agendaPendingAlertSessionKey, user?.nm_login]);

  async function handleLogout() {
    await logout();
    if (chamadoAlertSessionKey) {
      sessionStorage.removeItem(chamadoAlertSessionKey);
    }
    if (agendaPendingAlertSessionKey) {
      sessionStorage.removeItem(agendaPendingAlertSessionKey);
    }
    navigate("/login", { replace: true });
  }

  function toggleGroup(title: string) {
    setOpenGroups((current) => ({ ...current, [title]: !current[title] }));
  }

  function handleChamadoAlertNow() {
    if (!chamadoAlert) {
      navigate("/chamados");
      return;
    }

    if (chamadoAlert.route) {
      navigate(chamadoAlert.route);
      setChamadoAlert(null);
      return;
    }

    navigate("/chamados", {
      state: {
        focusChamadoId: chamadoAlert.chamadoId,
        openDetail: true,
      },
    });
    setChamadoAlert(null);
  }

  return (
    <div
      className={`app-shell${sidebarOpen ? " app-shell--sidebar-open" : ""}`}
    >
      <header className="shell-header">
        <div className="shell-header__brand">
          <button
            className="icon-button shell-header__menu"
            type="button"
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label="Abrir menu"
          >
            <span className="menu-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <Link to="/" className="brand brand--header">
            <img className="brand__logo" src={grupoAcmeLogo} alt="Atlas" />
          </Link>
        </div>

        <div className="shell-header__center">
          <CommandSearch commands={commandItems} />
        </div>

        <div className="shell-header__actions">
          <div className="user-menu" ref={userMenuRef}>
            <button
              className={`user-menu__trigger${userMenuOpen ? " user-menu__trigger--open" : ""}`}
              type="button"
              onClick={() => setUserMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <span className="user-menu__identity">
                <strong>{user?.nm_colaborador || "Usuário"}</strong>
                <small>{user?.nm_login || "-"}</small>
              </span>
              <span className="user-menu__chevron" aria-hidden="true">
                <span />
                <span />
              </span>
            </button>

            {userMenuOpen ? (
              <div className="user-menu__dropdown" role="menu">
                {userMenuItems.map((item) =>
                  item.external ? (
                    <a
                      key={item.label}
                      className="user-menu__item"
                      href={item.to}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <span className="nav-icon">
                        <NavIcon icon={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      className="user-menu__item"
                      to={item.to}
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <span className="nav-icon">
                        <NavIcon icon={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  ),
                )}
                <button
                  className="user-menu__item user-menu__item--danger"
                  type="button"
                  onClick={handleLogout}
                >
                  <span className="nav-icon">
                    <NavIcon icon="settings" />
                  </span>
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <aside
        className={`shell-sidebar${sidebarOpen ? " shell-sidebar--open" : ""}`}
      >
        <nav className="shell-sidebar__nav" aria-label="Navegação principal">
          {sidebarEntries.map((entry) =>
            entry.type === "item" ? (
              <NavLink
                key={entry.item.to}
                to={entry.item.to}
                end
                onClick={() => setSidebarOpen(false)}
                className={() =>
                  `nav-item${isRouteActive(entry.item.to, location.pathname) ? " nav-item--active" : ""}`
                }
              >
                <span className="nav-icon">
                  <NavIcon icon={entry.item.icon} />
                </span>
                <strong>{entry.item.label}</strong>
              </NavLink>
            ) : (
              <div key={entry.title} className="nav-group">
                <button
                  className={`nav-group__title${openGroups[entry.title] ? " nav-group__title--open" : ""}`}
                  type="button"
                  onClick={() => toggleGroup(entry.title)}
                  aria-expanded={openGroups[entry.title] ? "true" : "false"}
                >
                  <span className="nav-icon">
                    <NavIcon icon={entry.icon} />
                  </span>
                  <strong>{entry.title}</strong>
                  <span className="nav-group__chevron" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
                {openGroups[entry.title] ? (
                  <div className="nav-group__items">
                    {entry.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end
                        onClick={() => setSidebarOpen(false)}
                        className={() =>
                          `nav-subitem${isRouteActive(item.to, location.pathname) ? " nav-subitem--active" : ""}`
                        }
                      >
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </nav>
      </aside>

      {sidebarOpen ? (
        <button
          className="shell-backdrop"
          type="button"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="shell-main">
        <div className="shell-main__body">
          <main className="page-content">{children}</main>
        </div>
        <AuthFooter />
      </div>

      {chamadoAlert ? (
        <div
          className="shell-alert"
          role="status"
          aria-live="polite"
          key={chamadoAlert.id}
        >
          <div className="shell-alert__content">
            <strong>{chamadoAlert.title}</strong>
            <p>{chamadoAlert.message}</p>
          </div>
          <div className="shell-alert__actions">
            <button
              className="button"
              type="button"
              onClick={handleChamadoAlertNow}
            >
              Conferir agora
            </button>
            <button
              className="shell-alert__close"
              type="button"
              onClick={() => setChamadoAlert(null)}
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
