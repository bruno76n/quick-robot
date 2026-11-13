-- Variant families (mejoras/ronda-2.md §3.1, D38, D44). Additive only: a column, an index and a check; no name changes.
-- Old data is normalized to one level: chains go to the root original, variants whose original was deleted become
-- independent pieces (parent cleared, no label), and each variant gets a label from its name. The label rule is
-- core › variantLabelFromName; packages/db/test/migration-variants.test.ts checks this SQL against it.
ALTER TABLE "product" ADD COLUMN "variant_label" text;--> statement-breakpoint
CREATE INDEX "product_ws_parent" ON "product" USING btree ("workspace_id","parent_id");--> statement-breakpoint
CREATE FUNCTION pg_temp.qr_tidy(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(coalesce(s, ''), '\s+', ' ', 'g'))
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.qr_fold(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(normalize(s, NFD), '[̀-ͯ]', '', 'g'))
$$;--> statement-breakpoint
CREATE FUNCTION pg_temp.qr_variant_label(name text, original text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  rest text := pg_temp.qr_tidy(regexp_replace(normalize(coalesce(name, ''), NFC), '\s*\(\s*variante\s*\)', '', 'gi'));
  orig text := pg_temp.qr_tidy(regexp_replace(normalize(coalesce(original, ''), NFC), '\s*\(\s*variante\s*\)', '', 'gi'));
BEGIN
  IF orig <> '' AND starts_with(pg_temp.qr_fold(rest), pg_temp.qr_fold(orig))
     AND substr(rest, char_length(orig) + 1) !~ '^[[:alnum:]À-ÖØ-öø-ɏ]' THEN
    rest := substr(rest, char_length(orig) + 1);
  END IF;
  rest := regexp_replace(rest, '^[\s·–—:/,-]+', '');
  rest := pg_temp.qr_tidy(regexp_replace(rest, '^\(([^()]*)\)$', '\1'));
  rest := btrim(left(rest, 60));
  RETURN CASE WHEN rest = '' THEN 'Variante' ELSE rest END;
END
$$;--> statement-breakpoint
WITH RECURSIVE up(id, workspace_id, anc, depth, cyc) AS (
  SELECT id, workspace_id, parent_id, 1, parent_id = id FROM product WHERE parent_id IS NOT NULL
  UNION ALL
  SELECT up.id, up.workspace_id, a.parent_id, up.depth + 1, a.parent_id = up.id
  FROM up JOIN product a ON a.workspace_id = up.workspace_id AND a.id = up.anc
  WHERE a.parent_id IS NOT NULL AND NOT up.cyc AND up.depth < 64
),
roots AS (
  SELECT DISTINCT ON (up.id) up.id, a.id AS root, a.name AS root_name
  FROM up JOIN product a ON a.workspace_id = up.workspace_id AND a.id = up.anc
  WHERE a.deleted_at IS NULL AND a.id <> up.id
  ORDER BY up.id, up.depth DESC
),
cycles AS (SELECT DISTINCT id FROM up WHERE cyc),
fixed AS (
  SELECT v.id, v.workspace_id, CASE WHEN c.id IS NULL THEN r.root END AS root, r.root_name
  FROM product v LEFT JOIN roots r ON r.id = v.id LEFT JOIN cycles c ON c.id = v.id
  WHERE v.parent_id IS NOT NULL
)
UPDATE product p
SET parent_id = f.root,
    variant_label = CASE WHEN f.root IS NULL THEN NULL ELSE pg_temp.qr_variant_label(p.name, f.root_name) END
FROM fixed f
WHERE p.workspace_id = f.workspace_id AND p.id = f.id;--> statement-breakpoint
DROP FUNCTION pg_temp.qr_variant_label(text, text);--> statement-breakpoint
DROP FUNCTION pg_temp.qr_fold(text);--> statement-breakpoint
DROP FUNCTION pg_temp.qr_tidy(text);--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_variant_label" CHECK (("product"."variant_label" is null or char_length("product"."variant_label") between 1 and 60) and ("product"."parent_id" is null or "product"."variant_label" is not null));
