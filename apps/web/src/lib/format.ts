/** 48200 -> "48.2K", 1210000 -> "1.21M" — compact enough for a card face. */
export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

export function currency(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

export function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}
