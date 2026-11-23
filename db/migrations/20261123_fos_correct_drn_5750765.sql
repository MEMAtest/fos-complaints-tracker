-- Source: https://www.financial-ombudsman.org.uk/decision/DRN-5750765.pdf
-- The investigator's earlier finding differs from the Ombudsman's final
-- determination. The final determination does not uphold the complaint.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $correction$
DECLARE
  decision fos_decisions%ROWTYPE;
  brief fos_advisor_briefs%ROWTYPE;
  matched_briefs integer := 0;
  old_upheld integer;
  old_not_upheld integer;
BEGIN
  SELECT * INTO STRICT decision
  FROM fos_decisions
  WHERE decision_reference = 'DRN-5750765'
  FOR UPDATE;

  IF decision.pdf_url IS DISTINCT FROM 'https://www.financial-ombudsman.org.uk/decision/DRN-5750765.pdf'
     OR decision.product_sector IS DISTINCT FROM 'Banking and Payments'
     OR decision.decision_date IS DISTINCT FROM DATE '2026-02-02'
     OR NOT COALESCE(decision.final_decision_text ILIKE 'My final decision is I don’t uphold%', false)
  THEN
    RAISE EXCEPTION 'DRN-5750765 no longer matches the reviewed evidence';
  END IF;

  IF decision.outcome = 'not_upheld' AND NOT EXISTS (
    SELECT 1 FROM fos_advisor_briefs
    WHERE sample_cases @> '[{"decisionReference":"DRN-5750765","outcome":"upheld"}]'
  ) THEN
    RETURN;
  END IF;

  IF decision.outcome IS DISTINCT FROM 'upheld' THEN
    RAISE EXCEPTION 'Unexpected starting outcome for DRN-5750765';
  END IF;

  FOR brief IN
    SELECT * FROM fos_advisor_briefs
    WHERE sample_cases @> '[{"decisionReference":"DRN-5750765","outcome":"upheld"}]'
    FOR UPDATE
  LOOP
    IF brief.product IS DISTINCT FROM decision.product_sector
       OR (brief.root_cause IS NOT NULL AND lower(brief.root_cause) NOT IN ('delay in claim handling', 'fraud or scam concern'))
    THEN
      RAISE EXCEPTION 'Unexpected Advisor scope for DRN-5750765';
    END IF;

    SELECT
      MAX((item->>'count')::integer) FILTER (WHERE item->>'outcome' = 'upheld'),
      MAX((item->>'count')::integer) FILTER (WHERE item->>'outcome' = 'not_upheld')
    INTO old_upheld, old_not_upheld
    FROM jsonb_array_elements(brief.outcome_distribution) AS item;

    IF old_upheld IS NULL OR old_upheld < 1 OR old_not_upheld IS NULL
       OR brief.total_cases <> old_upheld + old_not_upheld
       OR brief.upheld_rate <> round(100.0 * old_upheld / brief.total_cases, 2)
    THEN
      RAISE EXCEPTION 'Unexpected Advisor totals for DRN-5750765';
    END IF;

    UPDATE fos_advisor_briefs
    SET upheld_rate = round(100.0 * (old_upheld - 1) / brief.total_cases, 2),
        not_upheld_rate = round(100.0 * (old_not_upheld + 1) / brief.total_cases, 2),
        outcome_distribution = (
          SELECT jsonb_agg(
            CASE item->>'outcome'
              WHEN 'upheld' THEN jsonb_set(item, '{count}', to_jsonb(old_upheld - 1))
              WHEN 'not_upheld' THEN jsonb_set(item, '{count}', to_jsonb(old_not_upheld + 1))
              ELSE item
            END ORDER BY position
          )
          FROM jsonb_array_elements(brief.outcome_distribution) WITH ORDINALITY AS a(item, position)
        ),
        year_trend = (
          SELECT jsonb_agg(
            CASE WHEN item->>'year' = '2026' THEN jsonb_set(item, '{upheldRate}', to_jsonb(
              round((100.0 * (round((item->>'upheldRate')::numeric * (item->>'total')::numeric / 100.0) - 1)) / (item->>'total')::numeric, 2)
            )) ELSE item END ORDER BY position
          )
          FROM jsonb_array_elements(brief.year_trend) WITH ORDINALITY AS a(item, position)
        ),
        root_cause_patterns = (
          SELECT jsonb_agg(
            CASE WHEN lower(item->>'label') IN ('delay in claim handling', 'fraud or scam concern')
            THEN jsonb_set(item, '{upheldRate}', to_jsonb(
              round((100.0 * (round((item->>'upheldRate')::numeric * (item->>'count')::numeric / 100.0) - 1)) / (item->>'count')::numeric, 2)
            )) ELSE item END ORDER BY position
          )
          FROM jsonb_array_elements(brief.root_cause_patterns) WITH ORDINALITY AS a(item, position)
        ),
        sample_cases = (
          SELECT jsonb_agg(
            CASE WHEN item->>'decisionReference' = 'DRN-5750765'
            THEN jsonb_set(item, '{outcome}', '"not_upheld"') ELSE item END ORDER BY position
          )
          FROM jsonb_array_elements(brief.sample_cases) WITH ORDINALITY AS a(item, position)
        )
    WHERE id = brief.id;
    matched_briefs := matched_briefs + 1;
  END LOOP;

  IF matched_briefs <> 3 THEN
    RAISE EXCEPTION 'Expected three matching Advisor brief rows, found %', matched_briefs;
  END IF;

  UPDATE fos_decisions SET outcome = 'not_upheld' WHERE id = decision.id;
END
$correction$;

COMMIT;
