-- Backfill customer_score from latest assessment for any customer that has been assessed
UPDATE customers c
SET customer_score = latest.total_score
FROM (
  SELECT DISTINCT ON (customer_id) customer_id, total_score
  FROM customer_assessments
  WHERE customer_id IS NOT NULL
  ORDER BY customer_id, assessed_at DESC
) latest
WHERE c.id = latest.customer_id;
