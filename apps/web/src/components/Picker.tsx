// Accessible picker (mejoras/ronda-2.md §12, D1 · P1 and P7): a button that opens a list (role=listbox) with a search
// field. Unlike a native <select>, it can be opened from code, so a row created by "Agregar …" is born with its list
// open and the focus inside. Keyboard: Enter, Space or ↓ open it (typing a letter on the button opens it with that
// letter searched); ↑ ↓ Inicio Fin move; Enter or a click choose; Esc closes and returns the focus to the button; Tab
// closes and goes on. After choosing, the focus goes to `next()` (the grams or quantity of the row), else the button.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { es } from '../i18n/es';

export interface PickerOption { value: string; label: string; hint?: string; hex?: string; group?: string }

export interface PickerProps {
  /** Name of the field ("Filamento"); screen readers read it with the chosen value. */
  label: string;
  value: string;
  options: readonly PickerOption[];
  /** Shown on the button while nothing is chosen. */
  placeholder: string;
  onChange: (value: string) => void;
  /** Opens with the focus inside when it mounts (a row just created by "Agregar …"). Read only on mount. */
  autoOpen?: boolean;
  /** Element that receives the focus after choosing. */
  next?: (picker: HTMLElement) => HTMLElement | null | undefined;
}

const P = es.common.picker;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function Picker({ label, value, options, placeholder, onChange, autoOpen = false, next }: PickerProps) {
  const id = useId();
  const [open, setOpen] = useState(autoOpen);
  const [query, setQuery] = useState('');
  // Opened by autoOpen, it starts on the chosen option (none yet: the first one).
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // Where the focus goes once the list is gone: 'button' (Esc), 'next' (chosen) or nothing (Tab, click outside).
  const after = useRef<'button' | 'next' | null>(null);
  const q = norm(query);
  const shown = q ? options.filter((o) => norm(o.label).includes(q)) : options;
  const current = options.find((o) => o.value === value);

  const show = (text = '') => {
    const words = norm(text);
    const visible = words ? options.filter((o) => norm(o.label).includes(words)) : options;
    setQuery(text);
    setActive(Math.max(0, visible.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (focus: 'button' | 'next' | null) => { after.current = focus; setOpen(false); setQuery(''); };
  const choose = (o: PickerOption | undefined) => { if (!o) return; if (o.value !== value) onChange(o.value); close('next'); };

  useEffect(() => {
    if (open) { search.current?.focus(); return; }
    const to = after.current;
    after.current = null;
    if (to === 'next') (next?.(root.current!) ?? button.current)?.focus();
    else if (to === 'button') button.current?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- runs when the list opens or closes
  useEffect(() => {
    if (!open) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(); return; }
    if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); show(e.key); }
  };
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const last = shown.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, last)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close('button'); }
    else if (e.key === 'Tab') close(null);
  };

  // Options in their groups, keeping the index of each one in `shown` (the one the arrows move).
  const groups: { name: string | undefined; items: { o: PickerOption; i: number }[] }[] = [];
  shown.forEach((o, i) => {
    const g = groups[groups.length - 1];
    if (g && g.name === o.group) g.items.push({ o, i }); else groups.push({ name: o.group, items: [{ o, i }] });
  });
  const option = ({ o, i }: { o: PickerOption; i: number }) => (
    <div key={o.value} id={`${id}-o${i}`} data-i={i} role="option" aria-selected={i === active} aria-label={o.hint ? `${o.label}, ${o.hint}` : undefined} className={`pick-o${i === active ? ' on' : ''}${o.value === value ? ' cur' : ''}`}
      onMouseMove={() => { if (i !== active) setActive(i); }} onClick={() => choose(o)}>
      {o.hex !== undefined ? <span className="sw" style={{ ['--c' as string]: o.hex || 'var(--no-color)' }} /> : null}
      <span className="pick-l">{o.label}</span>
      {o.hint ? <small>{o.hint}</small> : null}
    </div>
  );

  return (
    <div className="pick" ref={root} onBlur={(e) => { if (open && !root.current?.contains(e.relatedTarget as Node | null)) close(null); }}>
      <button ref={button} type="button" className={`pick-b${current ? '' : ' empty'}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-l` : undefined}
        onClick={() => (open ? close('button') : show())} onKeyDown={onButtonKey}>
        <span className="sr-only">{label}: </span>
        {current?.hex !== undefined ? <span className="sw" style={{ ['--c' as string]: current.hex || 'var(--no-color)' }} /> : null}
        <span className="pick-v">{current ? current.label : placeholder}</span>
      </button>
      {open ? (
        <div className="pick-pop" onMouseDown={(e) => { if (e.target !== search.current) e.preventDefault(); }}>
          <input ref={search} className="pick-q" type="text" role="combobox" aria-label={`${P.search} · ${label}`} placeholder={P.placeholder} autoComplete="off"
            aria-expanded="true" aria-controls={`${id}-l`} aria-autocomplete="list" aria-activedescendant={shown.length ? `${id}-o${active}` : undefined}
            value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onSearchKey} />
          <div ref={list} id={`${id}-l`} role="listbox" aria-label={label} className="pick-box">
            {groups.map((g, k) => (g.name
              ? <div key={`g${k}`} role="group" aria-labelledby={`${id}-g${k}`}><div id={`${id}-g${k}`} className="pick-g" role="presentation">{g.name}</div>{g.items.map(option)}</div>
              : g.items.map(option)))}
          </div>
          {shown.length ? null : <p className="pick-e" role="status">{P.none}</p>}
        </div>
      ) : null}
    </div>
  );
}
