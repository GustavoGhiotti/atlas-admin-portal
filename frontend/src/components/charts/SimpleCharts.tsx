import { useState } from "react";

import { formatNumber } from "@/lib/format";

type ChartPoint = {
  label: string;
  value: number;
};

type LineChartProps = {
  data: ChartPoint[];
  stroke?: string;
  axisLabelFormatter?: (label: string, index: number) => string;
  maxAxisLabels?: number;
};

type BarChartProps = {
  data: ChartPoint[];
  color?: string;
  formatValue?: (value: number) => string;
};

type DonutChartProps = {
  data: ChartPoint[];
};

// Uma cor por fatia. O dominio de categoria do Portal Acordo tem ~16 valores, e a
// paleta antiga tinha 6 e dava a volta (index % length): categorias diferentes
// saiam da mesma cor e a rosca deixava de ser legivel.
//
// A paleta foi validada contra o fundo dos paineis (--bg-panel, #111827):
// luminosidade OKLCH dentro de 0.48-0.67, croma >= 0.10, e separacao entre cores
// vizinhas de dE 10.8 sob protanopia/deuteranopia e 22.2 sob visao normal
// (OKLab x100). A ORDEM faz parte da validacao - a checagem olha pares vizinhos,
// entao reordenar pode encostar duas cores que hoje passam.
const DONUT_PALETTE = [
  "#1961d4", "#d06f17", "#1991af", "#bc1f4f", "#1da381", "#af48b7", "#59740f", "#7a79fa",
  "#9d7113", "#11719c", "#e8542f", "#1ca09a", "#b22578", "#1fa836", "#9554d2", "#726c0f",
];

// Respiro entre fatias vizinhas, em pontos percentuais da volta. Duas cores
// coladas se leem como uma so quando a fatia e fina. Teto proporcional ao
// tamanho da fatia: uma fatia de 0,4% nao pode gastar 0,4% com a borda.
const DONUT_GAP = 0.4;

function safeData(data: ChartPoint[]) {
  return data.filter((item) => Number.isFinite(item.value));
}

export function LineChart({ data, stroke = "#1f5eff", axisLabelFormatter, maxAxisLabels = 8 }: LineChartProps) {
  const series = safeData(data);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

  if (!series.length) {
    return <div className="empty-state empty-state--inline">Sem dados para o periodo.</div>;
  }

  const width = 520;
  const height = 250;
  const padding = 24;
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const stepX = series.length === 1 ? width - padding * 2 : (width - padding * 2) / (series.length - 1);

  const points = series
    .map((item, index) => {
      const x = padding + index * stepX;
      const y = height - padding - (item.value / maxValue) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const area = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
  const axisStep = series.length <= maxAxisLabels ? 1 : Math.ceil((series.length - 1) / (maxAxisLabels - 1));

  return (
    <div className="chart-surface">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" role="img" aria-label="Grafico de linha">
        <polyline className="line-chart__area" points={area} />
        <polyline className="line-chart__line" points={points} pathLength={1} style={{ stroke }} />
        {series.map((item, index) => {
          const x = padding + index * stepX;
          const y = height - padding - (item.value / maxValue) * (height - padding * 2);
          return (
            <g key={`${item.label}-${index}`}>
              <circle
                cx={x}
                cy={y}
                r="12"
                className="line-chart__point-hitbox"
                onMouseEnter={() => setTooltip({ x, y, label: item.label, value: item.value })}
                onMouseLeave={() => setTooltip(null)}
              />
              <circle
                cx={x}
                cy={y}
                r="5"
                className="line-chart__point"
                style={{ stroke }}
                onMouseEnter={() => setTooltip({ x, y, label: item.label, value: item.value })}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          );
        })}
      </svg>
      {tooltip ? (
        <div
          className="chart-tooltip"
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100}%`,
          }}
        >
          <strong>{tooltip.label}</strong>
          <span>Envios: {formatNumber(tooltip.value)}</span>
        </div>
      ) : null}

      <div className="chart-axis">
        {series.map((item, index) => (
          <span key={`${item.label}-${index}`}>
            {index === 0 || index === series.length - 1 || index % axisStep === 0
              ? (axisLabelFormatter ? axisLabelFormatter(item.label, index) : item.label)
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data, color = "#1f5eff", formatValue }: BarChartProps) {
  const series = safeData(data);

  if (!series.length) {
    return <div className="empty-state empty-state--inline">Sem dados para o periodo.</div>;
  }

  const maxValue = Math.max(...series.map((item) => item.value), 1);

  return (
    <div className="bar-chart">
      {series.map((item) => {
        const width = `${(item.value / maxValue) * 100}%`;
        return (
          <div key={item.label} className="bar-chart__row">
            <div className="bar-chart__label">
              <strong>{item.label}</strong>
              <span>{formatValue ? formatValue(item.value) : item.value}</span>
            </div>
            <div className="bar-chart__track">
              <div className="bar-chart__fill" style={{ width, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ data }: DonutChartProps) {
  const series = safeData(data).filter((item) => item.value > 0);

  if (!series.length) {
    return <div className="empty-state empty-state--inline">Sem dados para o periodo.</div>;
  }

  const total = series.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  const gradient = series
    .map((item, index) => {
      const start = (offset / total) * 100;
      offset += item.value;
      const end = (offset / total) * 100;
      // Fatia unica nao tem vizinha para separar - o corte viraria uma emenda no anel.
      const gap = series.length > 1 ? Math.min(DONUT_GAP, (end - start) / 4) : 0;
      const corte = end - gap;
      return `${DONUT_PALETTE[index % DONUT_PALETTE.length]} ${start}% ${corte}%, var(--bg-panel) ${corte}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="donut-chart">
      <div
        className="donut-chart__ring"
        // Variavel em vez de background: o CSS pinta as fatias numa camada
        // propria, que pode ser revelada sem levar o centro junto.
        style={{ ["--fatias" as string]: `conic-gradient(${gradient})` }}
      >
        <div className="donut-chart__center">
          <strong>{total}</strong>
          <span>itens</span>
        </div>
      </div>
      <div className="donut-chart__legend">
        {series.map((item, index) => (
          <div key={item.label} className="donut-chart__legend-item">
            <span className="donut-chart__swatch" style={{ background: DONUT_PALETTE[index % DONUT_PALETTE.length] }} />
            <strong>{item.label}</strong>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
