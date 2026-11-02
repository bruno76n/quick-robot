import { desc, eq, sql } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../connect';
import { newId } from '../ids';
import { expense } from '../schema';
import { scope } from './helpers';

export type ExpenseRow = typeof expense.$inferSelect;

export const expenseRepo = {
  async insert(ex: Executor, ctx: Ctx, data: Pick<ExpenseRow, 'on' | 'concept' | 'category' | 'amountCents' | 'recurring' | 'endsOn'> & { refId?: string | null }): Promise<ExpenseRow> {
    const [row] = await ex.insert(expense).values({ id: newId(), workspaceId: assertCtx(ctx), ...data, refId: data.refId ?? null }).returning();
    return row!;
  },
  list: (ex: Executor, ctx: Ctx): Promise<ExpenseRow[]> => ex.select().from(expense).where(scope(ctx, expense)).orderBy(desc(expense.on)),
  async get(ex: Executor, ctx: Ctx, id: string): Promise<ExpenseRow | undefined> {
    const [row] = await ex.select().from(expense).where(scope(ctx, expense, eq(expense.id, id)));
    return row;
  },
  async count(ex: Executor, ctx: Ctx): Promise<number> {
    const [row] = await ex.select({ n: sql<number>`count(*)::int` }).from(expense).where(scope(ctx, expense));
    return row?.n ?? 0;
  },
};
