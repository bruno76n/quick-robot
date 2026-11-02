-- Stock per supply: sum of its ledger, excluding deleted supplies (docs/05 › Vistas calculadas).
CREATE VIEW "supply_levels" AS
SELECT s.workspace_id, s.id AS supply_id, COALESCE(SUM(m.qty), 0)::numeric(14, 2) AS stock
FROM supply s
LEFT JOIN supply_movement m ON m.workspace_id = s.workspace_id AND m.supply_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.workspace_id, s.id;
