// Desktop fatal page (docs/15 §5, desktop rows). Shown by apps/desktop from the bundled build when the local server
// cannot serve the app: ?kind=down | migration | data. Every action goes through window.desktop.fatal (preload).
import { es } from '../i18n/es';
import { t } from '../i18n/t';
import { date } from '../lib/format';
import type { DesktopBackup, DesktopFatal } from '../lib/platform';
import mascot from '../styles/mascot.svg';
import './fatal.css';

type Kind = 'down' | 'migration' | 'data';
const texts = es.screens.fatal;
const more = es.screens.desktop.fatal;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: { text?: string; className?: string } = {}, ...children: Node[]) {
  const node = document.createElement(tag);
  if (props.text !== undefined) node.textContent = props.text;
  if (props.className) node.className = props.className;
  node.append(...children);
  return node;
}

function button(text: string, onClick: () => Promise<unknown> | void, className = 'btn') {
  const b = el('button', { text, className });
  b.type = 'button';
  b.addEventListener('click', async () => {
    const all = document.querySelectorAll('button');
    all.forEach((x) => { x.disabled = true; });
    try { await onClick(); } finally { all.forEach((x) => { x.disabled = false; }); }
  });
  return b;
}

export function readKind(search: string): Kind {
  const k = new URLSearchParams(search).get('kind');
  return k === 'migration' || k === 'data' ? k : 'down';
}

function backupList(api: DesktopFatal, backups: DesktopBackup[], status: HTMLElement) {
  if (backups.length === 0) return el('p', { text: more.noBackups, className: 'note' });
  const list = el('ul');
  for (const b of backups.slice(0, 7)) {
    const label = el('span', { text: t('screens.desktop.fatal.backupOn', { date: date(b.on) }) });
    const size = el('small', { text: t('screens.desktop.fatal.sizeKb', { size: b.sizeKb }) });
    list.append(el('li', {}, label, size, button(more.restore, () => restore(() => api.restoreBackup(b.id), status), 'btn sm')));
  }
  return list;
}

/** true: the app opens with the copy; null: the dialog was cancelled; false: the copy could not be applied. */
async function restore(run: () => Promise<boolean | null>, status: HTMLElement) {
  status.textContent = more.working;
  status.className = 'note';
  const ok = await run().catch(() => false);
  if (ok === null) status.textContent = '';
  else if (!ok) { status.textContent = more.restoreFailed; status.className = 'note error'; }
}

export async function render(root: HTMLElement, kind: Kind, api: DesktopFatal | undefined) {
  document.title = more.title;
  root.replaceChildren();
  const img = el('img');
  img.src = mascot;
  img.alt = '';
  root.append(img);
  const status = el('p', { className: 'note' });
  status.setAttribute('role', 'status');
  if (kind === 'down') {
    root.append(el('h1', { text: texts.serverDown.text }), el('div', { className: 'actions' }, button(texts.serverDown.buttons[0], () => api?.retry(), 'btn primary')));
  } else if (kind === 'migration') {
    root.append(el('h1', { text: texts.migrationFailed.text }), el('div', { className: 'actions' },
      button(texts.migrationFailed.buttons[0], () => api?.retry(), 'btn primary'),
      button(texts.migrationFailed.buttons[1], () => api?.showLogs()),
      button(more.quit, () => api?.quit())));
  } else {
    const backups = (await api?.listBackups().catch(() => [])) ?? [];
    const latest = backups[0];
    const actions = el('div', { className: 'actions' });
    if (latest) actions.append(button(texts.dataFileUnreadable.buttons[0], () => restore(() => api!.restoreBackup(latest.id), status), 'btn primary'));
    actions.append(button(texts.dataFileUnreadable.buttons[1], () => (api ? restore(() => api.chooseBackupFile(), status) : undefined)));
    root.append(el('h1', { text: texts.dataFileUnreadable.text }), actions, el('h2', { text: more.backupsTitle }), backupList(api!, backups, status));
  }
  root.append(status);
}

const root = document.getElementById('fatal');
if (root) void render(root, readKind(window.location.search), window.desktop?.fatal);
