CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"type" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"has_logo" boolean DEFAULT false NOT NULL,
	"logo_file_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "customer_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "line_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_kind" text NOT NULL,
	"parent_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text NOT NULL,
	"product_id" uuid,
	"collection_id" uuid,
	"name" text NOT NULL,
	"qty" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"list_cents" integer NOT NULL,
	"cost_cents" numeric(14, 4) NOT NULL,
	"extras_cents" integer DEFAULT 0 NOT NULL,
	"parts" jsonb,
	"printer_id" uuid,
	"from_stock" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_item_ws_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "line_item_parent_kind" CHECK ("line_item"."parent_kind" in ('order', 'sale')),
	CONSTRAINT "line_item_kind" CHECK ("line_item"."kind" in ('piece', 'set'))
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text NOT NULL,
	"channel_id" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_on" date NOT NULL,
	"due_on" date NOT NULL,
	"production_on" date,
	"ready_on" date,
	"delivered_on" date,
	"filament_deducted" boolean DEFAULT false NOT NULL,
	"runs_logged" boolean DEFAULT false NOT NULL,
	"stock_reserved" jsonb,
	"cancellation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "order_ws_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "order_ws_number" UNIQUE("workspace_id","number"),
	CONSTRAINT "order_status" CHECK ("order"."status" in ('quoted', 'accepted', 'in_production', 'ready', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"parent_kind" text NOT NULL,
	"parent_id" uuid NOT NULL,
	"on" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_ws_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "payment_parent_kind" CHECK ("payment"."parent_kind" in ('order', 'sale'))
);
--> statement-breakpoint
CREATE TABLE "print_queue_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"printer_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"text" text NOT NULL,
	"minutes" integer NOT NULL,
	"position" integer NOT NULL,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_queue_entry_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "print_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"on" date NOT NULL,
	"product_id" uuid,
	"qty" integer NOT NULL,
	"printer_id" uuid,
	"result" text NOT NULL,
	"hours" numeric(8, 2) NOT NULL,
	"reason" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"order_id" uuid,
	"photo_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_run_ws_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "print_run_result" CHECK ("print_run"."result" in ('ok', 'fail')),
	CONSTRAINT "print_run_reason" CHECK ("print_run"."reason" in ('stock', 'order', 'test'))
);
--> statement-breakpoint
CREATE TABLE "print_run_filament" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"print_run_id" uuid NOT NULL,
	"filament_id" uuid NOT NULL,
	"grams" numeric(10, 1) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"on" date NOT NULL,
	"channel_id" uuid NOT NULL,
	"customer_id" uuid,
	"order_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"tracks_payments" boolean DEFAULT false NOT NULL,
	"return" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sale_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"on" date NOT NULL,
	"kind" text NOT NULL,
	"qty" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_kind" CHECK ("stock_movement"."kind" in ('initial', 'print', 'order_print', 'sale', 'return', 'delivery', 'adjustment'))
);
--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_logo_fk" FOREIGN KEY ("workspace_id","logo_file_id") REFERENCES "public"."file"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "line_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "line_item_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "line_item_collection_fk" FOREIGN KEY ("workspace_id","collection_id") REFERENCES "public"."collection"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "line_item_printer_fk" FOREIGN KEY ("workspace_id","printer_id") REFERENCES "public"."printer"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_fk" FOREIGN KEY ("workspace_id","customer_id") REFERENCES "public"."customer"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_channel_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."sales_channel"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_queue_entry" ADD CONSTRAINT "print_queue_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_queue_entry" ADD CONSTRAINT "print_queue_entry_printer_fk" FOREIGN KEY ("workspace_id","printer_id") REFERENCES "public"."printer"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_queue_entry" ADD CONSTRAINT "print_queue_entry_order_fk" FOREIGN KEY ("workspace_id","order_id") REFERENCES "public"."order"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_run" ADD CONSTRAINT "print_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_run" ADD CONSTRAINT "print_run_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_run" ADD CONSTRAINT "print_run_printer_fk" FOREIGN KEY ("workspace_id","printer_id") REFERENCES "public"."printer"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_run" ADD CONSTRAINT "print_run_order_fk" FOREIGN KEY ("workspace_id","order_id") REFERENCES "public"."order"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_run" ADD CONSTRAINT "print_run_photo_fk" FOREIGN KEY ("workspace_id","photo_file_id") REFERENCES "public"."file"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_run_filament" ADD CONSTRAINT "print_run_filament_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_run_filament" ADD CONSTRAINT "print_run_filament_run_fk" FOREIGN KEY ("workspace_id","print_run_id") REFERENCES "public"."print_run"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_run_filament" ADD CONSTRAINT "print_run_filament_filament_fk" FOREIGN KEY ("workspace_id","filament_id") REFERENCES "public"."filament"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_channel_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."sales_channel"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_customer_fk" FOREIGN KEY ("workspace_id","customer_id") REFERENCES "public"."customer"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_order_fk" FOREIGN KEY ("workspace_id","order_id") REFERENCES "public"."order"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_fk" FOREIGN KEY ("workspace_id","product_id") REFERENCES "public"."product"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_ws_key" ON "customer" USING btree ("workspace_id","name_key");--> statement-breakpoint
CREATE INDEX "line_item_ws_parent" ON "line_item" USING btree ("workspace_id","parent_kind","parent_id");--> statement-breakpoint
CREATE INDEX "order_ws_status_due" ON "order" USING btree ("workspace_id","status","due_on");--> statement-breakpoint
CREATE INDEX "payment_ws_parent" ON "payment" USING btree ("workspace_id","parent_kind","parent_id");--> statement-breakpoint
CREATE INDEX "print_queue_entry_ws_printer" ON "print_queue_entry" USING btree ("workspace_id","printer_id","position");--> statement-breakpoint
CREATE INDEX "print_run_ws_on" ON "print_run" USING btree ("workspace_id","on");--> statement-breakpoint
CREATE INDEX "print_run_filament_ws_run" ON "print_run_filament" USING btree ("workspace_id","print_run_id");--> statement-breakpoint
CREATE INDEX "sale_ws_on" ON "sale" USING btree ("workspace_id","on");--> statement-breakpoint
CREATE INDEX "sale_ws_customer" ON "sale" USING btree ("workspace_id","customer_id");--> statement-breakpoint
CREATE INDEX "stock_movement_ws_product_on" ON "stock_movement" USING btree ("workspace_id","product_id","on");--> statement-breakpoint
CREATE INDEX "stock_movement_ws_ref" ON "stock_movement" USING btree ("workspace_id","ref_id");