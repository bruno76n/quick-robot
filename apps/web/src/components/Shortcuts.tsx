// Keyboard shortcuts (docs/06 §1; mockup atajosDlg and its keydown handler): ⌘/Ctrl+K search, "?" this list,
// G + letter goes to a screen, ⌘/Ctrl+Z runs the "Deshacer" of the last toast (the product's undo is restoring a deletion).
import { useEffect } from 'react';
import { es } from '../i18n/es';
import { go } from '../lib/nav';
import { CommandPalette, openPalette, openShortcuts, usePalette } from './CommandPalette';
import { Dialog } from './Dialog';
import { useToast } from './Toast';

const L = es.screens.shortcuts;
export const GOTO: Record<string, [string, string]> = {
  i: ['/inicio', es.nav.home], p: ['/productos', es.nav.products], v: ['/ventas', es.nav.sales], d: ['/pedidos', es.nav.orders], f: ['/filamentos', es.nav.filaments],
  n: ['/insumos', es.nav.supplies], e: ['/existencias', es.nav.stock], c: ['/clientes', es.nav.customers], g: ['/gastos', es.nav.expenses], r: ['/reportes', es.nav.reports],
  o: ['/compras', es.nav.purchases], a: ['/ajustes', es.nav.settings],
};

const inField = (t: EventTarget | null) => t instanceof Element && t.matches('input, textarea, select, [contenteditable], [contenteditable] *');
const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));

/** The key handler; returns the cleanup. Exported for tests. */
export function installShortcuts(): () => void {
  let gAt = 0;
  const onKey = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const k = (e.key || '').toLowerCase();
    const st = usePalette.getState();
    if (mod && k === 'k') { e.preventDefault(); if (st.palette) st.set({ palette: false }); else openPalette(); return; }
    if (st.palette) return;
    if (mod && k === 'z' && !e.shiftKey && !inField(e.target) && !dialogOpen()) {
      const { undo, hide } = useToast.getState();
      if (undo) { e.preventDefault(); hide(); undo(); }
      return;
    }
    if (inField(e.target) || dialogOpen() || mod || e.altKey) return;
    if (e.key === '?') { e.preventDefault(); openShortcuts(); return; }
    if (gAt && Date.now() - gAt < 1300 && GOTO[k]) { e.preventDefault(); gAt = 0; go(GOTO[k][0]); return; }
    gAt = k === 'g' ? Date.now() : 0;
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}

const Keys = ({ k }: { k: string[] }) => <span className="kbd">{k.map((x, i) => <kbd key={i}>{x}</kbd>)}</span>;

export function ShortcutsDialog() {
  const open = usePalette((s) => s.shortcuts);
  const set = usePalette((s) => s.set);
  if (!open) return null;
  return (
    <Dialog open title={L.title} onClose={() => set({ shortcuts: false })} cancelLabel={es.common.close}>
      <ul className="keys">
        <li><span>{L.search}</span><Keys k={['⌘', 'K']} /></li>
        <li><span>{L.undo}</span><Keys k={['⌘', 'Z']} /></li>
        <li><span>{L.list}</span><Keys k={['?']} /></li>
      </ul>
      <h3>{L.goTitle} <kbd>{'G'}</kbd> {L.goThen}</h3>
      <ul className="keys two">{Object.entries(GOTO).map(([k, [, label]]) => <li key={k}><span>{label}</span><Keys k={['G', k.toUpperCase()]} /></li>)}</ul>
      <p className="hint">{L.hint}</p>
    </Dialog>
  );
}

/** Palette, shortcut list and the key handler, mounted once in Root. */
export function CommandLayer() {
  useEffect(installShortcuts, []);
  return <><CommandPalette /><ShortcutsDialog /></>;
}
