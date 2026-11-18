import { FormEventHandler, ReactNode } from "react";

type FilterBarProps = {
  title: string;
  description?: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  actions?: ReactNode;
  children: ReactNode;
};

export default function FilterBar({ title, description, onSubmit, actions, children }: FilterBarProps) {
  return (
    <section className="panel filter-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Filtros</p>
          <h2>{title}</h2>
          {description ? <p className="panel__description">{description}</p> : null}
        </div>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </div>

      <form className="filter-grid filter-panel__form" onSubmit={onSubmit}>
        {children}
      </form>
    </section>
  );
}
