-- Tournament schedule: days with one or more rounds per day
-- round_schedule: [{"formats":["scramble"]}, {"formats":["best_ball","singles"]}]

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS round_schedule JSONB;

DO $$
DECLARE
  rec RECORD;
  new_schedule jsonb;
  total_rounds integer;
BEGIN
  FOR rec IN
    SELECT id, round_formats
    FROM tournaments
    WHERE round_schedule IS NULL AND round_formats IS NOT NULL
  LOOP
    SELECT jsonb_agg(jsonb_build_object('formats', jsonb_build_array(value)))
    INTO new_schedule
    FROM jsonb_array_elements_text(rec.round_formats) AS t(value);

    SELECT jsonb_array_length(rec.round_formats) INTO total_rounds;

    UPDATE tournaments
    SET round_schedule = new_schedule, rounds_count = total_rounds
    WHERE id = rec.id;
  END LOOP;
END $$;

UPDATE tournaments
SET round_schedule = '[{"formats":["scramble"]}]'::jsonb, rounds_count = 1
WHERE round_schedule IS NULL;

ALTER TABLE tournaments ALTER COLUMN round_schedule SET NOT NULL;

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_round_formats_check;
ALTER TABLE tournaments DROP COLUMN IF EXISTS round_formats;

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_round_schedule_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_round_schedule_check
  CHECK (
    jsonb_typeof(round_schedule) = 'array'
    AND jsonb_array_length(round_schedule) >= 1
    AND jsonb_array_length(round_schedule) <= 14
  );

CREATE OR REPLACE FUNCTION tournament_rounds_count_matches_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected integer := 0;
  day jsonb;
BEGIN
  FOR day IN SELECT jsonb_array_elements(NEW.round_schedule) LOOP
    IF jsonb_typeof(day->'formats') <> 'array'
       OR jsonb_array_length(day->'formats') < 1 THEN
      RAISE EXCEPTION 'Each day must have at least one round format';
    END IF;
    expected := expected + jsonb_array_length(day->'formats');
  END LOOP;

  IF NEW.rounds_count <> expected THEN
    RAISE EXCEPTION 'rounds_count must equal total rounds in round_schedule';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_round_schedule ON tournaments;

CREATE TRIGGER trg_tournament_round_schedule
  BEFORE INSERT OR UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION tournament_rounds_count_matches_schedule();
