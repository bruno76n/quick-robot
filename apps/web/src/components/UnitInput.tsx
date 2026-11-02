import { forwardRef, type InputHTMLAttributes } from 'react';

/** Input with a unit suffix ($, g, h, %) — mockup .unit. */
export const UnitInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { unit: string }>(function UnitInput({ unit, ...rest }, ref) {
  return (
    <div className="flex min-w-0 items-center rounded-btn border border-line-2 bg-bg focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-purple">
      <input ref={ref} className="min-h-[36px] border-0 bg-transparent text-left outline-none focus-visible:outline-none" {...rest} />
      <i className="whitespace-nowrap pr-[10px] text-[13.5px] not-italic text-ink-3">{unit}</i>
    </div>
  );
});
