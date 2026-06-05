-- ============================================================================
-- gameroom_messages — shoutbox-beskeder pr. spilrum
--
-- Simpel chat-funktion: medlemmer poster korte beskeder med valgfri
-- @mention af andre medlemmer (username refereret i content som tekst —
-- ingen separat mention-tabel; klienten parser ved rendering).
-- ============================================================================

CREATE TABLE IF NOT EXISTS gameroom_messages (
  id          bigserial PRIMARY KEY,
  game_id     int NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gameroom_messages_game_created_idx
  ON gameroom_messages (game_id, created_at DESC);

ALTER TABLE gameroom_messages ENABLE ROW LEVEL SECURITY;

-- Læs: kun medlemmer af spilrummet
DROP POLICY IF EXISTS "Members can read messages" ON gameroom_messages;
CREATE POLICY "Members can read messages" ON gameroom_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_members gm
      WHERE gm.game_id = gameroom_messages.game_id
        AND gm.user_id = auth.uid()
    )
  );

-- Skriv: kun medlemmer kan oprette beskeder, og kun som sig selv
DROP POLICY IF EXISTS "Members can insert their own messages" ON gameroom_messages;
CREATE POLICY "Members can insert their own messages" ON gameroom_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM game_members gm
      WHERE gm.game_id = gameroom_messages.game_id
        AND gm.user_id = auth.uid()
    )
  );

-- Slet: kun beskedens forfatter eller spillets host
DROP POLICY IF EXISTS "Authors and host can delete messages" ON gameroom_messages;
CREATE POLICY "Authors and host can delete messages" ON gameroom_messages
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = gameroom_messages.game_id
        AND g.host_id = auth.uid()
    )
  );
