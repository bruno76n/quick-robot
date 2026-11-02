-- What is left per spool: sum of its ledger, excluding deleted spools (docs/05 › Vistas calculadas).
CREATE VIEW "spool_levels" AS
SELECT s.workspace_id, s.id AS spool_id, s.filament_id,
       COALESCE(SUM(m.grams), 0)::numeric(12, 1) AS remaining_grams
FROM spool s
LEFT JOIN spool_movement m ON m.workspace_id = s.workspace_id AND m.spool_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.workspace_id, s.id, s.filament_id;
