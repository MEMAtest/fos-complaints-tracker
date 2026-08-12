ALTER TABLE fos_decisions
  ADD COLUMN IF NOT EXISTS product_sector_original TEXT;

UPDATE fos_decisions
SET product_sector_original = product_sector
WHERE product_sector_original IS NULL
  AND NULLIF(BTRIM(product_sector), '') IS NOT NULL;

UPDATE fos_decisions
SET product_sector = CASE LOWER(BTRIM(product_sector))
  WHEN 'baning and payments' THEN 'Banking and Payments'
  WHEN 'banking and paments' THEN 'Banking and Payments'
  WHEN 'banking and payments' THEN 'Banking and Payments'
  WHEN 'consumercredit' THEN 'Consumer Credit'
  WHEN 'consumer credit' THEN 'Consumer Credit'
  WHEN 'ageas insurance limited' THEN 'Insurance'
  ELSE product_sector
END
WHERE product_sector IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fos_decisions_product_original
  ON fos_decisions (product_sector_original);
