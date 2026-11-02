import { eq } from 'drizzle-orm';
import { assertCtx, type Ctx } from '../ctx';
import type { Executor } from '../connect';
import { newId } from '../ids';
import { file } from '../schema';
import { scope } from './helpers';

export type FileRow = typeof file.$inferSelect;

export const fileRepo = {
  async insert(ex: Executor, ctx: Ctx, data: Pick<FileRow, 'kind' | 'mime' | 'size' | 'storageKey'>): Promise<FileRow> {
    const [row] = await ex.insert(file).values({ id: newId(), workspaceId: assertCtx(ctx), ...data }).returning();
    return row!;
  },
  async get(ex: Executor, ctx: Ctx, id: string): Promise<FileRow | undefined> {
    const [row] = await ex.select().from(file).where(scope(ctx, file, eq(file.id, id)));
    return row;
  },
};
