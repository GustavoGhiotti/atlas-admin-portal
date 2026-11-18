import { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function ChartCard({ title, subtitle, action, children }: ChartCardProps) {
  return (
    <article className="chart-card">
      <div className="chart-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        {action ? action : null}
      </div>
      <div className="chart-card__body">{children}</div>
    </article>
  );
}
