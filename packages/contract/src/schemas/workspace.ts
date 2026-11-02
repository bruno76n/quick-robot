import { z } from 'zod';
import { Id } from './common';

/** The business the session belongs to. Name and other business data are records, never code. */
export const Workspace = z.object({ id: Id, name: z.string() });
export type Workspace = z.infer<typeof Workspace>;
