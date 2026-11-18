import { Link } from "react-router-dom";

import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { navigationSections } from "@/lib/navigation";
import { hasAnyGroup } from "@/lib/permissions";

export default function Index() {
  const { user } = useAuth();
  const visibleModules = navigationSections
    .flatMap((section) => section.items)
    .filter((item) => !item.groups.length || hasAnyGroup(user?.grupos ?? [], item.groups));

  const primaryModules = visibleModules.filter((item) => item.sidebar && item.to !== "/");
  const supportLinks = visibleModules.filter((item) => !item.external && !item.sidebar && !item.userMenu).slice(0, 4);

  return (
    <div className="stack-md">
      <PageHeader
        eyebrow="Painel operacional"
        title="Atlas"
        description="O Atlas é um portal interno que centraliza as principais operações do negócio, permitindo gerenciar acessos, acompanhar processos, monitorar indicadores e executar ações de forma segura e controlada. Em um único ambiente, integra rotinas críticas como gestão de usuários, cargas operacionais e comunicação, garantindo mais eficiência, organização e governança no dia a dia."
      />

      <section className="home-grid">
        {primaryModules.map((item) => (
          <Link key={item.to} className="module-card module-card--compact" to={item.to}>
            <span className="module-card__eyebrow">{item.category}</span>
            <strong>{item.label}</strong>
            <p>{item.description}</p>
          </Link>
        ))}
      </section>

      {supportLinks.length ? (
        <section className="surface-card surface-card--compact">
          <div className="section-header">
            <div>
              <p className="eyebrow">Atalhos</p>
              <h2>Priorize rotinas complementares</h2>
            </div>
          </div>
          <div className="quick-link-list">
            {supportLinks.map((item) => (
              <Link key={item.to} className="quick-link-list__item" to={item.to}>
                <strong>{item.label}</strong>
                <span>{item.command}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
