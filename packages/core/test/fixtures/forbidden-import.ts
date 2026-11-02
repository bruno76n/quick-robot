// Negative boundary fixture (docs/14 §7): core must not import anything from the monorepo or Node.
// Excluded from the normal lint; tools/test/boundaries.test.ts lints it and requires an error.
import { readFileSync } from 'node:fs';
import { connectPglite } from '@app/db';

export const probe = [readFileSync, connectPglite];
