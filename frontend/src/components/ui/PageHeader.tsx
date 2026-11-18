import { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  meta?: Array<{ label: string; value: string }>;
  actions?: ReactNode;
};

export default function PageHeader({ eyebrow, title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__top">
        <div className="page-header__content">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? <div className="page-header__description">{description}</div> : null}
        </div>

        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>

      {meta?.length ? (
        <div className="page-header__meta">
          {meta.map((item) => (
            <div key={item.label} className="page-header__meta-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
