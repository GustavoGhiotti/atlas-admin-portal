type KpiCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
};

export default function KpiCard({ label, value, helper, tone = "default" }: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-card--${tone}`}>
      <strong className="kpi-card__value">{value}</strong>
      <div className="kpi-card__body">
        <span className="kpi-card__label">{label}</span>
        {helper ? <p className="kpi-card__helper">{helper}</p> : null}
      </div>
    </article>
  );
}
