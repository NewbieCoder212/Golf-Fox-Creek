-- Defending champion side for cup tie-breaker (retains cup on equal match points).
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS defending_champion_side TEXT
  CHECK (defending_champion_side IS NULL OR defending_champion_side IN ('side_a', 'side_b'));

-- 2026 Generation Cup — Team Depends (side_b) enters as defending champion.
UPDATE tournaments
SET defending_champion_side = 'side_b'
WHERE display_slug = 'generation-cup'
   OR id = '107c086c-8edd-4859-aa54-7ec6a0e9daba';
