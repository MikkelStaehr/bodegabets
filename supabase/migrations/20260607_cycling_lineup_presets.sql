-- ============================================================================
-- cycling_lineup_presets — gemte rolle-rytter templates pr. squad
--
-- Brugeren har typisk 2-3 lineups i ærmet under et Grand Tour: en til flade
-- etaper (sprinter-fokus), en til bjergetaper (klassement + grimpeur) og evt.
-- en til ITT. I stedet for at klikke 9 slots × 21 etaper kan de gemme et
-- preset og anvende det med ét klik på hver matchende etape.
--
-- Modellen er per-squad fordi truppen (og dermed de mulige rytter-id'er)
-- skifter mellem blokke. Slots gemmes som jsonb så vi ikke skal vedligeholde
-- en separat slot-tabel; layoutet er samme shape som LineupState i UI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cycling_lineup_presets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id     uuid NOT NULL REFERENCES cycling_squads(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 24),
  slot_index   int NOT NULL CHECK (slot_index BETWEEN 0 AND 4),
  slots        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (squad_id, slot_index)
);

CREATE INDEX IF NOT EXISTS cycling_lineup_presets_squad_idx
  ON cycling_lineup_presets (squad_id, slot_index);

ALTER TABLE cycling_lineup_presets ENABLE ROW LEVEL SECURITY;

-- Læs: kun ejeren af squad'en
DROP POLICY IF EXISTS "Squad owner reads presets" ON cycling_lineup_presets;
CREATE POLICY "Squad owner reads presets" ON cycling_lineup_presets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cycling_squads sq
      WHERE sq.id = cycling_lineup_presets.squad_id
        AND sq.user_id = auth.uid()
    )
  );

-- Skriv/opdater/slet: kun ejeren af squad'en
DROP POLICY IF EXISTS "Squad owner writes presets" ON cycling_lineup_presets;
CREATE POLICY "Squad owner writes presets" ON cycling_lineup_presets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cycling_squads sq
      WHERE sq.id = cycling_lineup_presets.squad_id
        AND sq.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cycling_squads sq
      WHERE sq.id = cycling_lineup_presets.squad_id
        AND sq.user_id = auth.uid()
    )
  );

-- updated_at auto-bump ved opdatering af slots/name
CREATE OR REPLACE FUNCTION cycling_lineup_presets_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cycling_lineup_presets_touch ON cycling_lineup_presets;
CREATE TRIGGER cycling_lineup_presets_touch
  BEFORE UPDATE ON cycling_lineup_presets
  FOR EACH ROW EXECUTE FUNCTION cycling_lineup_presets_touch_updated_at();
