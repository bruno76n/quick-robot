import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { NAV, NAV_ITEMS } from '../app/nav';
import { es } from '../i18n/es';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Icon } from './Icon';
import { Toaster } from './Toast';

const useNav = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));

/** Business mark: initial of the business name (the business logo arrives with Ajustes). */
function Mark({ name, size }: { name: string; size: number }) {
  return (
    <span aria-hidden="true" className="grid flex-none place-items-center rounded-[10px] bg-purple-soft font-semibold text-purple" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** "g" then a letter navigates (mockup shortcuts). Ignored while typing or with a dialog open. */
function useGoShortcuts() {
  const navigate = useNavigate();
  const pending = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t?.closest('input, textarea, select, [contenteditable]');
      if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      const item = NAV_ITEMS.find((i) => i.key === k);
      if (pending.current && Date.now() - pending.current < 1300 && item) {
        e.preventDefault();
        pending.current = 0;
        void navigate({ to: item.path });
        return;
      }
      pending.current = k === 'g' ? Date.now() : 0;
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);
}

export function AppShell() {
  const { open, set } = useNav();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const workspace = useQuery({ queryKey: ['workspace'], queryFn: api.workspace.get, staleTime: Infinity });
  const name = workspace.data?.name ?? '';
  useGoShortcuts();
  useEffect(() => set(false), [path, set]);
  useEffect(() => {
    if (name) document.title = name;
  }, [name]);

  return (
    <div className="grid h-full grid-cols-[248px_minmax(0,1fr)] max-[899px]:grid-cols-[minmax(0,1fr)] max-[899px]:grid-rows-[auto_minmax(0,1fr)]">
      <header className="hidden items-center gap-[10px] border-b border-line bg-panel px-3 py-2 max-[899px]:flex">
        <Button variant="ghost" size="icon" aria-label={es.app.menuOpen} aria-expanded={open} onClick={() => set(true)}>
          <Icon name="menu" size={20} />
        </Button>
        <span className="mr-auto flex items-center gap-2 text-[18px] font-semibold tracking-[-0.02em]">
          {name && <Mark name={name} size={28} />}
          {name}
        </span>
        <Link to="/productos/pieza/nueva" className="inline-flex min-h-8 items-center rounded-btn border border-btn bg-btn px-[11px] py-1 text-[13.5px] font-medium text-btn-ink no-underline hover:brightness-[1.45]">
          {es.app.newPiece}
        </Link>
      </header>

      <aside
        aria-label={es.app.menuMain}
        className={cn(
          'flex min-h-0 flex-col gap-[14px] overflow-y-auto border-r border-line bg-panel px-3 pb-[14px] pt-4',
          'max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:left-0 max-[899px]:z-30 max-[899px]:w-[min(300px,86vw)] max-[899px]:transition-[transform,visibility] max-[899px]:duration-200',
          open ? 'max-[899px]:visible max-[899px]:translate-x-0' : 'max-[899px]:invisible max-[899px]:-translate-x-[105%]',
        )}
      >
        <div className="flex items-center gap-[10px] px-[6px] py-[2px]">
          {name && <Mark name={name} size={40} />}
          <div>
            <b className="text-[21px] font-semibold leading-none tracking-[-0.03em]">{name}</b>
          </div>
        </div>
        <Link to="/productos/pieza/nueva" className="inline-flex min-h-[38px] w-full items-center justify-center gap-[7px] rounded-btn border border-btn bg-btn px-[14px] py-2 font-medium text-btn-ink no-underline hover:brightness-[1.45]">
          <Icon name="plus" size={16} strokeWidth={2} />
          {es.app.newPiece}
        </Link>
        <button
          type="button"
          disabled
          title={es.app.nextPhase}
          aria-label={es.app.searchAll}
          className="mb-[6px] flex w-full items-center gap-2 rounded-[8px] border border-line-2 bg-bg px-[10px] py-2 text-left text-ink-2 disabled:cursor-not-allowed"
        >
          <Icon name="search" size={16} />
          <span className="flex-1">{es.app.search}</span>
          <kbd className="rounded-[5px] border border-b-2 border-line-2 bg-panel px-[6px] font-sans text-[11px] font-semibold text-ink-2">{es.app.searchKbd}</kbd>
        </button>
        <nav aria-label={es.app.screens} className="flex flex-1 flex-col gap-[14px]">
          {NAV.map((g) => (
            <div key={g.group ?? 'top'} className="flex flex-col gap-[2px]">
              {g.group && <span className="px-[10px] pb-[3px] text-[12.5px] font-semibold text-ink-3">{g.group}</span>}
              {g.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-[10px] rounded-[9px] px-[10px] py-2 font-medium text-ink-2 no-underline hover:bg-panel-2 hover:text-ink aria-[current=page]:bg-panel-2 aria-[current=page]:font-semibold aria-[current=page]:text-ink"
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-[25] bg-[rgba(20,12,40,.5)] min-[900px]:hidden" onClick={() => set(false)} />}

      <main className="min-h-0 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-[1160px] px-7 pb-[72px] pt-7 outline-none max-[899px]:px-4 max-[899px]:pb-14 max-[899px]:pt-5">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

/** Page heading (mockup .ph): title, one-line summary and actions. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-[22px] flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-[1_1_320px]">
        <h1>{title}</h1>
        {sub && <p className="mt-2 max-w-[58ch] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
