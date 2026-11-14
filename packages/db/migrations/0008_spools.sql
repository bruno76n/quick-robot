-- Spools of ronda 4 (mejoras/ronda-4.md §3, docs/05). Additive only: columns, checks and an index; no gram changes.
-- Old spools get their number per workspace in purchase order (ties by id, deleted ones included: a number is never
-- reused) and the ones that cost nothing (cost + shipping = 0) become no-cost spools. packages/db/test/migration-spools.test.ts
-- checks it with the mockup backup and the rare cases.
ALTER TABLE "catalog_item" ADD COLUMN "spool_tare_grams" integer;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "cost_avg_purchases" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "filament" ADD COLUMN "reference_cents_per_kg" integer;--> statement-breakpoint
ALTER TABLE "spool" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "spool" ADD COLUMN "no_cost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "spool" s SET "number" = n.rn
FROM (SELECT id, workspace_id, row_number() OVER (PARTITION BY workspace_id ORDER BY purchased_on, id) AS rn FROM "spool") n
WHERE s.workspace_id = n.workspace_id AND s.id = n.id;--> statement-breakpoint
UPDATE "spool" SET "no_cost" = true WHERE "cost_cents" + "shipping_cents" = 0;--> statement-breakpoint
ALTER TABLE "spool" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "spool" ADD CONSTRAINT "spool_ws_number" UNIQUE("workspace_id","number");--> statement-breakpoint
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_tare" CHECK ("catalog_item"."spool_tare_grams" is null or "catalog_item"."spool_tare_grams" >= 0);--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_cost_avg" CHECK ("workspace_settings"."cost_avg_purchases" between 1 and 10);--> statement-breakpoint
ALTER TABLE "filament" ADD CONSTRAINT "filament_reference_positive" CHECK ("filament"."reference_cents_per_kg" is null or "filament"."reference_cents_per_kg" > 0);--> statement-breakpoint
ALTER TABLE "spool" ADD CONSTRAINT "spool_number_positive" CHECK ("spool"."number" >= 1);
