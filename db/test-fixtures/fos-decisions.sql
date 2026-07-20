INSERT INTO fos_decisions (
  decision_reference,
  decision_date,
  business_name,
  product_sector,
  outcome,
  ombudsman_name,
  source_url,
  complaint_text,
  firm_response_text,
  ombudsman_reasoning_text,
  final_decision_text,
  decision_summary,
  precedents,
  root_cause_tags,
  vulnerability_flags,
  decision_logic
)
SELECT
  'CI-TEST-' || LPAD(series::TEXT, 4, '0'),
  MAKE_DATE(CASE WHEN series <= 1800 THEN 2025 ELSE 2024 END, 1 + (series % 12), 1 + (series % 27)),
  CASE
    WHEN series <= 1200 THEN 'Lloyds Bank PLC'
    WHEN series <= 1800 THEN 'Barclays Bank UK PLC'
    ELSE 'Beta Finance Plc'
  END,
  CASE
    WHEN series <= 1200 THEN 'Payment protection insurance (PPI)'
    WHEN series <= 1800 THEN 'Banking and Payments'
    ELSE 'Banking and credit'
  END,
  CASE series % 4
    WHEN 0 THEN 'Upheld'
    WHEN 1 THEN 'Not upheld'
    WHEN 2 THEN 'Partially upheld'
    ELSE 'Not upheld'
  END,
  'CI Ombudsman',
  'https://example.test/decision/' || series,
  'The customer complained about service, communication, and the handling of their account.',
  'The firm reviewed its records and explained the evidence used when reaching its decision.',
  'The ombudsman considered the chronology, supporting records, customer circumstances, and whether the firm acted fairly.',
  'The complaint outcome was reached after considering the available evidence and relevant obligations.',
  'A representative CI fixture decision covering service, communication, evidence, and fair treatment.',
  '["Consumer Duty", "DISP"]'::JSONB,
  '["delay in claim handling"]'::JSONB,
  CASE WHEN series % 5 = 0 THEN '["financial difficulty"]'::JSONB ELSE '[]'::JSONB END,
  'The evidence was assessed against fair and reasonable treatment expectations.'
FROM GENERATE_SERIES(1, 2200) AS series
ON CONFLICT (decision_reference) DO UPDATE SET
  decision_date = EXCLUDED.decision_date,
  business_name = EXCLUDED.business_name,
  product_sector = EXCLUDED.product_sector,
  outcome = EXCLUDED.outcome,
  complaint_text = EXCLUDED.complaint_text,
  firm_response_text = EXCLUDED.firm_response_text,
  ombudsman_reasoning_text = EXCLUDED.ombudsman_reasoning_text,
  final_decision_text = EXCLUDED.final_decision_text,
  decision_summary = EXCLUDED.decision_summary,
  precedents = EXCLUDED.precedents,
  root_cause_tags = EXCLUDED.root_cause_tags,
  vulnerability_flags = EXCLUDED.vulnerability_flags,
  decision_logic = EXCLUDED.decision_logic,
  updated_at = NOW();

INSERT INTO fos_ingestion_runs (
  status,
  records_ingested,
  started_at,
  finished_at,
  last_success_at
)
SELECT 'completed', 2200, NOW() - INTERVAL '2 minutes', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM fos_ingestion_runs);

DELETE FROM fos_advisor_briefs
WHERE product = 'Banking and Payments';

INSERT INTO fos_advisor_briefs (
  product,
  root_cause,
  total_cases,
  upheld_rate,
  not_upheld_rate,
  risk_level,
  trend_direction,
  year_trend,
  key_precedents,
  root_cause_patterns,
  what_wins,
  what_loses,
  ai_what_wins,
  ai_what_loses,
  ai_guidance,
  outcome_distribution,
  vulnerabilities,
  sample_cases,
  recommended_actions
)
VALUES
  (
    'Banking and Payments',
    NULL,
    600,
    25.00,
    50.00,
    'low',
    'stable',
    '[{"year":2024,"upheldRate":24.0,"total":100},{"year":2025,"upheldRate":25.2,"total":500}]'::JSONB,
    '[{"label":"Consumer Duty","count":600,"percentOfCases":100}]'::JSONB,
    '[{"label":"Delay in claim handling","count":600,"upheldRate":25}]'::JSONB,
    '[{"theme":"Clear records and timely communication","frequency":300,"sampleCaseIds":[]}]'::JSONB,
    '[{"theme":"Delayed handling and incomplete explanations","frequency":150,"sampleCaseIds":[]}]'::JSONB,
    'Clear contemporaneous records and timely explanations are the strongest signals in not-upheld outcomes.',
    'Delayed handling and incomplete customer explanations are the strongest signals in upheld outcomes.',
    'Keep a complete decision trail, explain the evidence relied upon, and escalate vulnerability or delay indicators promptly.',
    '[{"outcome":"upheld","count":150},{"outcome":"not_upheld","count":300},{"outcome":"partially_upheld","count":150}]'::JSONB,
    '[{"label":"Financial difficulty","count":120,"percentOfCases":20}]'::JSONB,
    '[]'::JSONB,
    '[{"item":"Document the evidence and rationale for each decision","source":"precedent","priority":"critical"}]'::JSONB
  ),
  (
    'Banking and Payments',
    'Delay in claim handling',
    600,
    25.00,
    50.00,
    'low',
    'stable',
    '[{"year":2024,"upheldRate":24.0,"total":100},{"year":2025,"upheldRate":25.2,"total":500}]'::JSONB,
    '[{"label":"DISP","count":600,"percentOfCases":100}]'::JSONB,
    '[{"label":"Delay in claim handling","count":600,"upheldRate":25}]'::JSONB,
    '[{"theme":"Proactive progress updates","frequency":300,"sampleCaseIds":[]}]'::JSONB,
    '[{"theme":"Missed updates and unexplained delay","frequency":150,"sampleCaseIds":[]}]'::JSONB,
    NULL,
    NULL,
    NULL,
    '[{"outcome":"upheld","count":150},{"outcome":"not_upheld","count":300},{"outcome":"partially_upheld","count":150}]'::JSONB,
    '[{"label":"Financial difficulty","count":120,"percentOfCases":20}]'::JSONB,
    '[]'::JSONB,
    '[{"item":"Issue progress updates before the four-week milestone","source":"root_cause","priority":"important"}]'::JSONB
  );
