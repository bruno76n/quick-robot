// NEGATIVE FIXTURE — linted as if it lived in apps/web/src. Must be rejected.
import { createApp } from '@app/server';

export const broken = createApp;
