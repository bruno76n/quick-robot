import type { Ctx } from '@app/db';
import type { Warning } from '@app/contract';
import type { Deps, Session } from './deps';

export interface AppEnv {
  Variables: {
    deps: Deps;
    requestId: string;
    session: Session;
    ctx: Ctx;
    action: string;
    warnings: Warning[];
  };
}
