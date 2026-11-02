import * as RD from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Side drawer for the detail of a wide-list item (mockup .drw). Esc or outside click closes it. */
export function Drawer({ open, onOpenChange, kicker, closeLabel, children }: { open: boolean; onOpenChange: (open: boolean) => void; kicker: string; closeLabel: string; children: ReactNode }) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange} modal>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-[70] bg-[rgba(18,18,20,.28)] data-[state=open]:animate-[fade-in_.2s]" />
        <RD.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-[71] flex w-[min(520px,100vw)] flex-col bg-bg shadow-[-18px_0_50px_rgba(18,18,20,.16)] focus:outline-none data-[state=open]:animate-[drawer-in_.24s_cubic-bezier(.2,.8,.2,1)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line py-3 pl-[22px] pr-[14px] text-[13px] font-semibold text-ink-3">
            <RD.Title className="text-[13px] font-semibold">{kicker}</RD.Title>
            <RD.Close className="grid w-[34px] min-h-[34px] cursor-pointer place-items-center rounded-btn border border-transparent bg-transparent text-ink-2 hover:bg-panel-2" aria-label={closeLabel}>
              <Icon name="x" />
            </RD.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-8 pt-5">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
