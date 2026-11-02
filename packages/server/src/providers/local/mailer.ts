import type { Mailer } from '../../deps';

/** Local mode sends nothing (docs/08). */
export const nullMailer: Mailer = { send: async () => undefined };
