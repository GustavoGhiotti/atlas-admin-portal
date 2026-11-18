export function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return digits;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatNumber(value: unknown, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(Number(value || 0));
}

export function formatPercent(value: unknown) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
