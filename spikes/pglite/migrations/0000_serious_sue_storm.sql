CREATE TABLE "crash_row" (
	"id" integer PRIMARY KEY NOT NULL,
	"batch" integer NOT NULL,
	"payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_item" (
	"workspace_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"parent_kind" text NOT NULL,
	"parent_id" uuid NOT NULL,
	"product_id" uuid,
	"qty" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"cost_cents" integer NOT NULL,
	CONSTRAINT "line_item_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"workspace_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "product_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"workspace_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"on" date NOT NULL,
	"channel_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sale_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "sales_channel" (
	"workspace_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"commission_pct" numeric(5, 2) NOT NULL,
	CONSTRAINT "sales_channel_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_item" ADD CONSTRAINT "line_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_workspace_id_channel_id_sales_channel_workspace_id_id_fk" FOREIGN KEY ("workspace_id","channel_id") REFERENCES "public"."sales_channel"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_channel" ADD CONSTRAINT "sales_channel_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crash_row_batch" ON "crash_row" USING btree ("batch");--> statement-breakpoint
CREATE INDEX "line_item_parent" ON "line_item" USING btree ("workspace_id","parent_kind","parent_id");--> statement-breakpoint
CREATE INDEX "sale_ws_on" ON "sale" USING btree ("workspace_id","on");