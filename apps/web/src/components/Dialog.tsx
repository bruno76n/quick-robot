import * as RD from '@radix-ui/react-dialog';
import type { FormEvent, ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Modal dialog with a form (mockup dialog: title, body, sticky footer). Esc and outside click close it. */
export function Dialog({
  open,
  onOpenChange,
  title,
  wide,
  children,
  footer,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  wide?: boolean;
  children: ReactNode;
  footer: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-[80] bg-[rgba(20,12,40,.5)]" />
        <RD.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-[81] flex max-h-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-dialog border border-line-2 bg-bg text-ink shadow-[0_24px_70px_rgba(25,12,60,.35)] focus:outline-none',
            wide ? 'w-[min(800px,calc(100vw-32px))]' : 'w-[min(540px,calc(100vw-32px))]',
          )}
        >
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col" autoComplete="off">
            <div className="min-h-0 overflow-y-auto">
              <RD.Title className="px-[22px] pt-5 text-[20px] font-semibold tracking-[-0.03em]">{title}</RD.Title>
              <div className="grid gap-[14px] px-[22px] py-4">{children}</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line bg-bg px-[22px] pb-[18px] pt-3">{footer}</div>
          </form>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
