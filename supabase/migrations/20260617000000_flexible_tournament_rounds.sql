-- Allow flexible round counts (not limited to 2–3 days)

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_rounds_count_check;

ALTER TABLE tournaments ADD CONSTRAINT tournaments_rounds_count_check
  CHECK (rounds_count >= 1 AND rounds_count <= 14);

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_round_formats_check;

ALTER TABLE tournaments ADD CONSTRAINT tournaments_round_formats_check
  CHECK (
    jsonb_typeof(round_formats) = 'array'
    AND jsonb_array_length(round_formats) = rounds_count
  );
