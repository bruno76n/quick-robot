// Server process policy (docs/02 §6, docs/15 §5): restart once by itself; if it falls again, "down".
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { isServerMessage, isStartMessage, type StartMessage } from '../src/protocol';
import { ServerSupervisor, type ServerChild } from '../src/supervisor';

class FakeChild extends EventEmitter implements ServerChild {
  static n = 100;
  pid = FakeChild.n++;
  sent: unknown[] = [];
  killed = false;
  postMessage(m: unknown) { this.sent.push(m); if ((m as { type: string }).type === 'stop') setImmediate(() => this.emit('exit', 0)); }
  kill() { this.killed = true; setImmediate(() => this.emit('exit', 1)); return true; }
}

function setup(over: { startTimeoutMs?: number; now?: () => number } = {}) {
  const children: FakeChild[] = [];
  const events = { onListening: vi.fn(), onFatal: vi.fn(), onDown: vi.fn() };
  const s = new ServerSupervisor({
    fork: () => { const c = new FakeChild(); children.push(c); return c; },
    startMessage: (port, restoreFrom): StartMessage => ({ type: 'start', secret: 'x'.repeat(43), dataDir: '/d', webRoot: '/w', migrationsFolder: '/m', port, version: '1', ...(restoreFrom ? { restoreFrom } : {}) }),
    events, ...over,
  });
  return { s, children, events };
}
const last = <T>(a: T[]) => a[a.length - 1]!;

describe('ServerSupervisor', () => {
  it('starts on a random port and reports where it listens', () => {
    const { s, children, events } = setup();
    s.start();
    expect(children[0]!.sent[0]).toMatchObject({ type: 'start', port: 0 });
    children[0]!.emit('message', { type: 'listening', port: 5000 });
    expect(events.onListening).toHaveBeenCalledWith(5000, false);
    expect(s.currentPort).toBe(5000);
    expect(s.pid).toBe(children[0]!.pid);
  });

  it('restarts once on the same port; the second fall is "down"; Reintentar starts again on a new port', () => {
    const { s, children, events } = setup();
    s.start();
    children[0]!.emit('message', { type: 'listening', port: 5000 });
    children[0]!.emit('exit', 9);
    expect(children).toHaveLength(2);
    expect(children[1]!.sent[0]).toMatchObject({ port: 5000 });
    children[1]!.emit('message', { type: 'listening', port: 5000 });
    expect(events.onListening).toHaveBeenLastCalledWith(5000, true);
    children[1]!.emit('exit', 9);
    expect(children).toHaveLength(2);
    expect(events.onDown).toHaveBeenCalledTimes(1);
    s.start();
    expect(last(children).sent[0]).toMatchObject({ port: 0 });
  });

  it('a crash long after the restart gets its own restart again', () => {
    let t = 0;
    const { s, children, events } = setup({ now: () => t });
    s.start();
    children[0]!.emit('message', { type: 'listening', port: 5000 });
    children[0]!.emit('exit', 9);
    children[1]!.emit('message', { type: 'listening', port: 5000 });
    t = 10 * 60_000;
    children[1]!.emit('exit', 9);
    expect(children).toHaveLength(3);
    expect(events.onDown).not.toHaveBeenCalled();
  });

  it('a known failure (data or migration) is reported and not restarted', () => {
    const { s, children, events } = setup();
    s.start();
    children[0]!.emit('message', { type: 'fatal', kind: 'migration', message: 'x', restored: true });
    children[0]!.emit('exit', 2);
    expect(events.onFatal).toHaveBeenCalledWith(expect.objectContaining({ kind: 'migration' }));
    expect(children).toHaveLength(1);
    expect(events.onDown).not.toHaveBeenCalled();
  });

  it('passes the backup to restore and ignores messages that are not from the protocol', () => {
    const { s, children, events } = setup();
    s.start({ restoreFrom: '/b/backup-2026-11-01.json' });
    expect(children[0]!.sent[0]).toMatchObject({ restoreFrom: '/b/backup-2026-11-01.json' });
    children[0]!.emit('message', { type: 'listening', port: 'x' });
    children[0]!.emit('message', null);
    expect(events.onListening).not.toHaveBeenCalled();
  });

  it('a start that hangs is killed and counts as a fall', async () => {
    vi.useFakeTimers();
    try {
      const { s, children } = setup({ startTimeoutMs: 1000 });
      s.start();
      vi.advanceTimersByTime(1001);
      expect(children[0]!.killed).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('stop asks the server to close the data and does not restart it', async () => {
    const { s, children, events } = setup();
    s.start();
    children[0]!.emit('message', { type: 'listening', port: 5000 });
    await s.stop();
    expect(last(children[0]!.sent)).toEqual({ type: 'stop' });
    expect(children).toHaveLength(1);
    expect(events.onDown).not.toHaveBeenCalled();
    expect(s.currentState).toBe('stopping');
  });
});

describe('protocol guards', () => {
  it('validate both directions', () => {
    expect(isServerMessage({ type: 'fatal', kind: 'data', message: 'x' })).toBe(true);
    expect(isServerMessage({ type: 'fatal', kind: 'other' })).toBe(false);
    expect(isStartMessage({ type: 'start', secret: 's', dataDir: '/d', webRoot: '/w', migrationsFolder: '/m', port: 0, version: '1' })).toBe(true);
    expect(isStartMessage({ type: 'start', secret: 's', dataDir: '/d', webRoot: '/w', migrationsFolder: '/m', port: 0, version: '1', restoreFrom: 3 })).toBe(false);
    expect(isStartMessage('start')).toBe(false);
  });
});
