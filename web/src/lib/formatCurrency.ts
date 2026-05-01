const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function formatCurrency(value: number): string {
  return fmt.format(value);
}

export function formatCurrencyCompact(value: number): string {
  if (value >= 1000) {
    return '$' + (value / 1000).toFixed(1) + 'k';
  }
  return fmt.format(value);
}
