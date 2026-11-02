// Runs the server's utility process: restarts it once if it exits unexpectedly, then reports "down" (docs/02 §6,
// docs/15 §5). The process factory is injected so the policy is unit tested without Electron.
import { isServerMessage, type ServerMessage, type StartMessage } from './protocol';

export interface ServerChild {
  readonly pid?: number | undefined;
  postMessage(message: unknown): void;
  on(event: 'message', fn: (message: unknown) => void): unknown;
  on(event: 'exit', fn: (code: number) => void): unknown;
  kill(): boolean;
}

export interface SupervisorEvents {
  onListening(port: number, restarted: boolean): void;
  onFatal(m: Extract<ServerMessage, { type: 'fatal' }>): void;
  onDown(): void;
}

export interface SupervisorOptions {
  fork: () => ServerChild;
  startMessage: (port: number, restoreFrom?: string) => StartMessage;
  events: SupervisorEvents;
  /** Time to open the data and listen before the start counts as failed. */
  startTimeoutMs?: number;
  /** After this long listening, a later crash gets its own automatic restart again. */
  healthyAfterMs?: number;
  now?: () => number;
}

type State = 'idle' | 'starting' | 'running' | 'fatal' | 'down' | 'stopping';

export class ServerSupervisor {
  private child: ServerChild | null = null;
  private state: State = 'idle';
  private restarts = 0;
  private port = 0;
  private listeningAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly o: SupervisorOptions) {}

  get pid() { return this.child?.pid; }
  get currentPort() { return this.port; }
  get currentState() { return this.state; }

  /** A fresh start (first launch, "Reintentar", "Abrir de nuevo" or a restore): the automatic restart is available again. */
  start(opts: { restoreFrom?: string } = {}) {
    this.restarts = 0;
    this.spawn(0, opts.restoreFrom);
  }

  private spawn(port: number, restoreFrom?: string) {
    this.state = 'starting';
    const child = this.o.fork();
    this.child = child;
    child.on('message', (m) => { if (this.child === child) this.onMessage(m); });
    child.on('exit', () => { if (this.child === child) this.onExit(); });
    child.postMessage(this.o.startMessage(port, restoreFrom));
    this.clearTimer();
    this.timer = setTimeout(() => { if (this.child === child && this.state === 'starting') child.kill(); }, this.o.startTimeoutMs ?? 90_000);
  }

  private onMessage(m: unknown) {
    if (!isServerMessage(m)) return;
    this.clearTimer();
    if (m.type === 'listening') {
      const restarted = this.restarts > 0;
      this.state = 'running';
      this.port = m.port;
      this.listeningAt = (this.o.now ?? Date.now)();
      this.o.events.onListening(m.port, restarted);
    } else {
      this.state = 'fatal';
      this.o.events.onFatal(m);
    }
  }

  private onExit() {
    this.clearTimer();
    this.child = null;
    if (this.state === 'fatal' || this.state === 'stopping' || this.state === 'idle') return;
    if (this.state === 'running' && (this.o.now ?? Date.now)() - this.listeningAt > (this.o.healthyAfterMs ?? 300_000)) this.restarts = 0;
    if (this.restarts < 1) {
      this.restarts += 1;
      this.spawn(this.port);
      return;
    }
    this.state = 'down';
    this.o.events.onDown();
  }

  private clearTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  /** Asks the server to close the data file cleanly; kills it if it does not exit in time. */
  stop(timeoutMs = 5000): Promise<void> {
    const child = this.child;
    this.state = 'stopping';
    this.clearTimer();
    if (!child) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(() => { child.kill(); resolve(); }, timeoutMs);
      child.on('exit', () => { clearTimeout(t); resolve(); });
      child.postMessage({ type: 'stop' });
    });
  }
}
