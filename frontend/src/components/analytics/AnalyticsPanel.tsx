import { ReactNode } from "react";

type AnalyticsPanelProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export default function AnalyticsPanel({ eyebrow, title, description, children }: AnalyticsPanelProps) {
  return (
    <section className="panel analytics-panel">
      <div className="panel__header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p className="panel__description">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
