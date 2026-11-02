-- An index for every foreign key (docs/05 › Índices que importan): deleting or restoring a business no longer
-- scans whole child tables. Checked by packages/db/test/fk-indexes.test.ts.
CREATE INDEX IF NOT EXISTS "order_ws_channel_id_fk_idx" ON "order" (workspace_id, channel_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_ws_customer_id_fk_idx" ON "order" (workspace_id, customer_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_part_ws_product_id_fk_idx" ON collection_part (workspace_id, product_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_ws_logo_file_id_fk_idx" ON customer (workspace_id, logo_file_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_item_ws_collection_id_fk_idx" ON line_item (workspace_id, collection_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_item_ws_printer_id_fk_idx" ON line_item (workspace_id, printer_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_item_ws_product_id_fk_idx" ON line_item (workspace_id, product_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_queue_entry_ws_order_id_fk_idx" ON print_queue_entry (workspace_id, order_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_run_ws_order_id_fk_idx" ON print_run (workspace_id, order_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_run_ws_photo_file_id_fk_idx" ON print_run (workspace_id, photo_file_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_run_ws_printer_id_fk_idx" ON print_run (workspace_id, printer_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_run_ws_product_id_fk_idx" ON print_run (workspace_id, product_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_run_filament_ws_filament_id_fk_idx" ON print_run_filament (workspace_id, filament_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_ws_parent_id_fk_idx" ON product (workspace_id, parent_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_ws_photo_file_id_fk_idx" ON product (workspace_id, photo_file_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_ws_printer_id_fk_idx" ON product (workspace_id, printer_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_filament_ws_filament_id_fk_idx" ON product_filament (workspace_id, filament_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_supply_ws_supply_id_fk_idx" ON product_supply (workspace_id, supply_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_ws_channel_id_fk_idx" ON sale (workspace_id, channel_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_ws_order_id_fk_idx" ON sale (workspace_id, order_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spool_ws_supplier_id_fk_idx" ON spool (workspace_id, supplier_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supply_ws_supplier_id_fk_idx" ON supply (workspace_id, supplier_id);
