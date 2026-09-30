/**
 * How a rate is written on the card.
 *
 * Lives here rather than beside the code that fetches rates because the card
 * runs in the browser. Importing it from the server module pulled that whole
 * module into the page — its network code included — which was harmless only
 * until the network code needed something the browser does not have.
 */

export interface FormattableRate {
  value: number | null;
  /** How many places the figure is worth reading to. */
  decimals: number;
}

/** A figure a person reads, not one a machine printed: 48,25 and 79 003. */
export function formatRate<T extends FormattableRate>(row: T): string {
  if (row.value === null) return "—";
  return row.value.toLocaleString("ru-RU", {
    minimumFractionDigits: row.decimals,
    maximumFractionDigits: row.decimals,
  });
}
