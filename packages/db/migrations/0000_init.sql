CREATE TABLE "membership" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "membership_role" CHECK ("membership"."role" in ('owner', 'admin', 'operator'))
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filament" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"material" text NOT NULL,
	"color" text NOT NULL,
	"hex" text NOT NULL,
	"name_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filament_ws_id" UNIQUE("workspace_id","id"),
	CONSTRAINT "filament_ws_key" UNIQUE("workspace_id","name_key")
);
--> statement-breakpoint
CREATE TABLE "spool" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"filament_id" uuid NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"cost_cents" integer NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"grams" numeric(10, 1) NOT NULL,
	"purchased_on" date NOT NULL,
	"supplier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "spool_ws_id" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "spool_movement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"spool_id" uuid NOT NULL,
	"on" date NOT NULL,
	"kind" text NOT NULL,
	"grams" numeric(10, 1) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spool_movement_kind" CHECK ("spool_movement"."kind" in ('purchase', 'consumption', 'failure', 'waste', 'adjustment'))
);
--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament" ADD CONSTRAINT "filament_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spool" ADD CONSTRAINT "spool_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spool" ADD CONSTRAINT "spool_filament_fk" FOREIGN KEY ("workspace_id","filament_id") REFERENCES "public"."filament"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spool_movement" ADD CONSTRAINT "spool_movement_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spool_movement" ADD CONSTRAINT "spool_movement_spool_fk" FOREIGN KEY ("workspace_id","spool_id") REFERENCES "public"."spool"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_user" ON "membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "filament_ws_material" ON "filament" USING btree ("workspace_id","material","color");--> statement-breakpoint
CREATE INDEX "spool_ws_filament" ON "spool" USING btree ("workspace_id","filament_id");--> statement-breakpoint
CREATE INDEX "spool_movement_ws_spool_on" ON "spool_movement" USING btree ("workspace_id","spool_id","on");