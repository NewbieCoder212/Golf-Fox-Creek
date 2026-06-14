-- ============================================
-- FOX CREEK GOLF CLUB - LOCAL AD PLACEMENTS
-- Curated sponsor banners for PWA surfaces
-- Date: 2026-06-23
-- ============================================

CREATE TABLE ad_placements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sponsor_name TEXT NOT NULL,
  placement_type TEXT NOT NULL,
  hole_number INTEGER,
  image_url TEXT NOT NULL,
  banner_text TEXT NOT NULL,
  action_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ad_placements_placement_type_check
    CHECK (
      placement_type IN (
        'scorecard_header',
        'hole_sponsor',
        'the_turn',
        'leaderboard'
      )
    ),

  CONSTRAINT ad_placements_hole_number_range_check
    CHECK (hole_number IS NULL OR (hole_number >= 1 AND hole_number <= 18))
);

CREATE INDEX idx_ad_placements_type_active
  ON ad_placements (placement_type, is_active);

CREATE INDEX idx_ad_placements_hole
  ON ad_placements (placement_type, hole_number)
  WHERE hole_number IS NOT NULL;

CREATE OR REPLACE FUNCTION ad_placements_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ad_placements_updated_at
  BEFORE UPDATE ON ad_placements
  FOR EACH ROW
  EXECUTE FUNCTION ad_placements_set_updated_at();

-- Development: open RLS (matches tournament tables)
ALTER TABLE ad_placements DISABLE ROW LEVEL SECURITY;

-- NOTE (2026-06-14): Rotation not implemented. Multiple active rows per placement_type
-- show only the newest (see getActiveAdPlacement limit=1). Revisit: PROJECT_STATUS.md §5.
