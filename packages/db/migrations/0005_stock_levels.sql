-- Physical pieces per product: sum of its ledger, excluding deleted products (docs/05 › Vistas calculadas).
CREATE VIEW "stock_levels" AS
SELECT p.workspace_id, p.id AS product_id, GREATEST(COALESCE(SUM(m.qty), 0), 0)::numeric(14, 0) AS physical
FROM product p
LEFT JOIN stock_movement m ON m.workspace_id = p.workspace_id AND m.product_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.workspace_id, p.id;
