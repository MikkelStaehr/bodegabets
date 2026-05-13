-- Cycling classification positions (2026-05-13)
--
-- Vi gemte før kun GC-position pr. rytter pr. stage. For at vise top-10
-- af alle klassifikationer (points, mountain, youth) i gameroom-cardet
-- skal vi gemme de andre placeringer også.
--
-- Sync populerer nu alle 4 placeringer fra PCS' stage-N-gc subside
-- (tab-baseret UI hvor alle 4 classifications er i samme HTML).

ALTER TABLE cycling_results
  ADD COLUMN IF NOT EXISTS points_position_after int,
  ADD COLUMN IF NOT EXISTS mountain_position_after int,
  ADD COLUMN IF NOT EXISTS youth_position_after int;
