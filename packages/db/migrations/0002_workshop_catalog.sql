CREATE TABLE "catalog_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"hex" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_item_ws_kind_key" UNIQUE("workspace_id","kind","name_key"),
	CONSTRAINT "catalog_item_kind" CHECK ("catalog_item"."kind" in ('material', 'color', 'brand', 'customer_type', 'expense_category'))
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
	CONSTRAINT "file_ws_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "file_kind" CHECK ("file"."kind" in ('product_photo', 'customer_logo', 'print_photo')),
	CONSTRAINT "file_mime" CHECK ("file"."mime" in ('image/jpeg', 'image/png', 'image/webp'))
);
--> statement-breakpoint
CREATE TABLE "sales_channel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"commission_pct" numeric(5, 2) NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_channel_ws_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "sales_channel_ws_key" UNIQUE("workspace_id","name_key")
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
	"last_backup_on" date,
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
	CONSTRAINT "supplier_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "supply" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"cost_cents" integer NOT NULL,
	"minimum" numeric(12, 2) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"supplier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "supply_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "supply_movement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"supply_id" uuid NOT NULL,
	"on" date NOT NULL,
	"kind" text NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supply_movement_kind" CHECK ("supply_movement"."kind" in ('purchase', 'use', 'adjustment', 'waste'))
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expense_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "maintenance_task" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"printer_id" uuid NOT NULL,
	"task" text NOT NULL,
	"every_hours" numeric(8, 2) NOT NULL,
	"last_hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"last_on" date,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_task_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "printer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cost_cents" integer NOT NULL,
	"life_hours" numeric(10, 2) NOT NULL,
	"maintenance_cents_per_hour" integer NOT NULL,
	"kw" numeric(6, 3) NOT NULL,
	"hours" numeric(8, 2) DEFAULT 0 NOT NULL,
	"purchased_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "printer_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer,
	"extras_cents" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "collection_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "collection_part" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"mode" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"margin_pct" numeric(5, 2),
	"printer_id" uuid,
	"hours" numeric(8, 2) NOT NULL,
	"batch_size" integer DEFAULT 1 NOT NULL,
	"extras_cents" integer DEFAULT 0 NOT NULL,
	"tracks_stock" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"photo_file_id" uuid,
	"spec" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "product_ws_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "product_mode" CHECK ("product"."mode" in ('value', 'formula'))
);
--> statement-breakpoint
CREATE TABLE "product_filament" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"filament_id" uuid NOT NULL,
	"grams" numeric(10, 1) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_supply" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"supply_id" uuid NOT NULL,
	"qty" numeric(12, 2) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel" ADD CONSTRAINT "sales_channel_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply" ADD CONSTRAINT "supply_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply" ADD CONSTRAINT "supply_supplier_fk" FOREIGN KEY ("workspace_id","supplier_id") REFERENCES "public"."supplier"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_movement" ADD CONSTRAINT "supply_movement_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_movement" ADD CONSTRAINT "supply_movement_supply_fk" FOREIGN KEY ("workspace_id","supply_id") REFERENCES "public"."supply"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_task" ADD CONSTRAINT "maintenance_task_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_task" ADD CONSTRAINT "maintenance_task_printer_fk" FOREIGN KEY ("workspace_id","printer_id") REFERENCES "public"."printer"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer" ADD CONSTRAINT "printer_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_part" ADD CONSTRAINT "collection_part_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_part" ADD CONSTRAINT "collection_part_collection_fk" FOREIGN KEY ("workspace_id","collection_id") REFERENCES "public"."collection"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_part" ADD CONSTRAINT "collection_part_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_parent_fk" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_printer_fk" FOREIGN KEY ("workspace_id","printer_id") REFERENCES "public"."printer"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_photo_fk" FOREIGN KEY ("workspace_id","photo_file_id") REFERENCES "public"."file"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filament" ADD CONSTRAINT "product_filament_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filament" ADD CONSTRAINT "product_filament_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_filament" ADD CONSTRAINT "product_filament_filament_fk" FOREIGN KEY ("workspace_id","filament_id") REFERENCES "public"."filament"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_supply" ADD CONSTRAINT "product_supply_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_supply" ADD CONSTRAINT "product_supply_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_supply" ADD CONSTRAINT "product_supply_supply_fk" FOREIGN KEY ("workspace_id","supply_id") REFERENCES "public"."supply"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_channel_ws_pos" ON "sales_channel" USING btree ("workspace_id","position");--> statement-breakpoint
CREATE INDEX "supplier_ws_name" ON "supplier" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "supply_ws_key" ON "supply" USING btree ("workspace_id","name_key");--> statement-breakpoint
CREATE INDEX "supply_movement_ws_supply_on" ON "supply_movement" USING btree ("workspace_id","supply_id","on");--> statement-breakpoint
CREATE INDEX "expense_ws_on" ON "expense" USING btree ("workspace_id","on");--> statement-breakpoint
CREATE INDEX "maintenance_task_ws_printer" ON "maintenance_task" USING btree ("workspace_id","printer_id");--> statement-breakpoint
CREATE INDEX "printer_ws_name" ON "printer" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "collection_ws_name" ON "collection" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "collection_part_ws_collection" ON "collection_part" USING btree ("workspace_id","collection_id");--> statement-breakpoint
CREATE INDEX "product_ws_name" ON "product" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "product_filament_ws_product" ON "product_filament" USING btree ("workspace_id","product_id");--> statement-breakpoint
CREATE INDEX "product_supply_ws_product" ON "product_supply" USING btree ("workspace_id","product_id");--> statement-breakpoint
ALTER TABLE "spool" ADD CONSTRAINT "spool_supplier_fk" FOREIGN KEY ("workspace_id","supplier_id") REFERENCES "public"."supplier"("workspace_id","id") ON DELETE no action ON UPDATE no action;