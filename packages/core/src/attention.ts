// Home attentions by priority (mejoras/ronda-2.md §5, docs/06 §2). Kind and due date decide the group.
export type AttentionKind =
  | 'order_filament_short' | 'order_due' | 'sale_owed' | 'filament_low' | 'supply_low'
  | 'maintenance' | 'price_below_floor' | 'backup';
export type AttentionSeverity = 'urgent' | 'soon' | 'review';

/** Days before the due date from which an active order is an attention (0 = today, negative = overdue). */
export const ORDER_DUE_SOON_DAYS = 2;

/**
 * Group of an attention: urgent = blocks a print or is due today or tomorrow (or overdue); soon = this week;
 * review = can wait. An active order due in more than 2 days is not an attention (null).
 */
export function classifyAttention(kind: AttentionKind, params: { days?: number | null } = {}): AttentionSeverity | null {
  switch (kind) {
    case 'order_filament_short': return 'urgent';
    case 'order_due': {
      const d = params.days ?? 0;
      if (d <= 1) return 'urgent';
      return d <= ORDER_DUE_SOON_DAYS ? 'soon' : null;
    }
    case 'sale_owed': case 'filament_low': case 'supply_low': return 'soon';
    case 'maintenance': case 'price_below_floor': case 'backup': return 'review';
  }
}
