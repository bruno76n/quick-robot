// Every route is registered with its action (guard) so the access matrix can walk all of them (docs/12 §11).
import type { Handler, Hono } from 'hono';
import type { AppEnv } from '../env';
import { guard } from '../middleware/session';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface RouteDef { method: Method; path: string; action: string }

export function makeRouter(app: Hono<AppEnv>, registry: RouteDef[], prefix = '/api/v1') {
  const add = (method: Method) => (path: string, action: string, handler: Handler<AppEnv>) => {
    registry.push({ method, path: prefix + path, action });
    app.on(method, prefix + path, guard(action), handler);
  };
  return { get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE') };
}
export type Router = ReturnType<typeof makeRouter>;
