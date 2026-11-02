CREATE TABLE "catalog_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"hex" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_channel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"commission_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"kwh_price_cents" integer NOT NULL,
	"failure_pct" numeric(5, 2) NOT NULL,
	"purge_pct" numeric(5, 2) NOT NULL,
	"min_margin_pct" numeric(5, 2) NOT NULL,
	"formula_margin_pct" numeric(5, 2) NOT NULL,
	"business" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"brands" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "supplier_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "supply" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"unit" text DEFAULT 'pza' NOT NULL,
	"cost_cents" integer NOT NULL,
	"minimum" numeric(10, 2) DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"supplier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "supply_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "supply_movement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"supply_id" uuid NOT NULL,
	"on" date NOT NULL,
	"kind" text NOT NULL,
	"qty" numeric(10, 2) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_task" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"printer_id" uuid NOT NULL,
	"task" text NOT NULL,
	"every_hours" numeric(8, 1) NOT NULL,
	"last_hours" numeric(10, 2) DEFAULT 0 NOT NULL,
	"last_on" date,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "printer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cost_cents" integer NOT NULL,
	"life_hours" numeric(10, 1) NOT NULL,
	"maintenance_cents_per_hour" integer DEFAULT 0 NOT NULL,
	"kw" numeric(6, 3) DEFAULT 0 NOT NULL,
	"hours" numeric(10, 2) DEFAULT 0 NOT NULL,
	"purchased_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "printer_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"on" date NOT NULL,
	"concept" text NOT NULL,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"ends_on" date,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"mode" text DEFAULT 'value' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"margin_pct" numeric(5, 2),
	"printer_id" uuid,
	"print_minutes" integer DEFAULT 0 NOT NULL,
	"batch_size" integer DEFAULT 1 NOT NULL,
	"extras_cents" integer DEFAULT 0 NOT NULL,
	"tracks_stock" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"spec" jsonb,
	"photo_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "product_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "product_filament" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"filament_id" uuid NOT NULL,
	"grams" numeric(10, 1) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_supply" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"supply_id" uuid NOT NULL,
	"qty" numeric(10, 2) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer,
	"extras_cents" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "collection_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "collection_part" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel" ADD CONSTRAINT "sales_channel_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply" ADD CONSTRAINT "supply_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply" ADD CONSTRAINT "supply_supplier_fk" FOREIGN KEY ("workspace_id","supplier_id") REFERENCES "public"."supplier"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_movement" ADD CONSTRAINT "supply_movement_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_movement" ADD CONSTRAINT "supply_movement_supply_fk" FOREIGN KEY ("workspace_id","supply_id") REFERENCES "public"."supply"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_task" ADD CONSTRAINT "maintenance_task_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_task" ADD CONSTRAINT "maintenance_task_printer_fk" FOREIGN KEY ("workspace_id","printer_id") REFERENCES "public"."printer"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer" ADD CONSTRAINT "printer_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filament" ADD CONSTRAINT "product_filament_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filament" ADD CONSTRAINT "product_filament_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filament" ADD CONSTRAINT "product_filament_filament_fk" FOREIGN KEY ("workspace_id","filament_id") REFERENCES "public"."filament"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_supply" ADD CONSTRAINT "product_supply_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_supply" ADD CONSTRAINT "product_supply_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_supply" ADD CONSTRAINT "product_supply_supply_fk" FOREIGN KEY ("workspace_id","supply_id") REFERENCES "public"."supply"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_part" ADD CONSTRAINT "collection_part_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_part" ADD CONSTRAINT "collection_part_collection_fk" FOREIGN KEY ("workspace_id","collection_id") REFERENCES "public"."collection"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_part" ADD CONSTRAINT "collection_part_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_item_ws_kind_key_uq" ON "catalog_item" USING btree ("workspace_id","kind","name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_channel_ws_key_uq" ON "sales_channel" USING btree ("workspace_id","name_key") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "sales_channel_ws_pos_idx" ON "sales_channel" USING btree ("workspace_id","position");--> statement-breakpoint
CREATE INDEX "supplier_ws_name_idx" ON "supplier" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "supply_ws_key_uq" ON "supply" USING btree ("workspace_id","name_key") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "supply_movement_ws_supply_on_idx" ON "supply_movement" USING btree ("workspace_id","supply_id","on");--> statement-breakpoint
CREATE INDEX "maintenance_task_ws_printer_idx" ON "maintenance_task" USING btree ("workspace_id","printer_id");--> statement-breakpoint
CREATE INDEX "printer_ws_name_idx" ON "printer" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "expense_ws_on_idx" ON "expense" USING btree ("workspace_id","on");--> statement-breakpoint
CREATE INDEX "product_ws_name_idx" ON "product" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "product_filament_ws_product_idx" ON "product_filament" USING btree ("workspace_id","product_id");--> statement-breakpoint
CREATE INDEX "product_supply_ws_product_idx" ON "product_supply" USING btree ("workspace_id","product_id");--> statement-breakpoint
CREATE INDEX "collection_ws_name_idx" ON "collection" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "collection_part_ws_collection_idx" ON "collection_part" USING btree ("workspace_id","collection_id");--> statement-breakpoint
ALTER TABLE "spool" ADD CONSTRAINT "spool_supplier_fk" FOREIGN KEY ("workspace_id","supplier_id") REFERENCES "public"."supplier"("workspace_id","id") ON DELETE no action ON UPDATE no action;