export function formatPercent(value: number | null, decimals = 1): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}
