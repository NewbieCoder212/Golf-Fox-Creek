-- Match play hole winners: gross best-ball by default; enable net via admin toggle.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS match_use_net_scoring BOOLEAN NOT NULL DEFAULT false;
