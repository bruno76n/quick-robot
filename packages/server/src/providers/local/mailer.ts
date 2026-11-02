import type { Mailer } from '../../deps';

/** Local mode sends no mail. */
export const noopMailer: Mailer = {
  async send() {},
};
