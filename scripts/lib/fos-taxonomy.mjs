const PRODUCT_ALIASES = new Map([
  ['baning and payments', 'Banking and Payments'],
  ['banking and paments', 'Banking and Payments'],
  ['banking and payments', 'Banking and Payments'],
  ['consumercredit', 'Consumer Credit'],
  ['consumer credit', 'Consumer Credit'],
  ['ageas insurance limited', 'Insurance'],
]);

export function canonicalProductSector(value) {
  const original = String(value || '').trim().replace(/\s+/g, ' ');
  if (!original) return null;
  return PRODUCT_ALIASES.get(original.toLowerCase()) || original;
}
