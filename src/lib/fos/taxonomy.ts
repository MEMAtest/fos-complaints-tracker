const PRODUCT_ALIASES = new Map<string, string>([
  ['baning and payments', 'Banking and Payments'],
  ['banking and paments', 'Banking and Payments'],
  ['banking and payments', 'Banking and Payments'],
  ['consumercredit', 'Consumer Credit'],
  ['consumer credit', 'Consumer Credit'],
  ['ageas insurance limited', 'Insurance'],
]);

export function canonicalProductSector(value: unknown): string {
  const original = String(value || '').trim().replace(/\s+/g, ' ');
  if (!original) return 'Unspecified';
  return PRODUCT_ALIASES.get(original.toLowerCase()) || original;
}

export function canonicalProductOptions(values: string[]): string[] {
  return Array.from(new Set(values.map(canonicalProductSector))).sort((a, b) => a.localeCompare(b));
}
