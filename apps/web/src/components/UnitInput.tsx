import { forwardRef, type InputHTMLAttributes } from 'react';

/** Input with a unit ($, g, h, %). "$" goes before the number, like the mockup. */
export const UnitInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { unit: string }>(function UnitInput({ unit, className = '', ...rest }, ref) {
  return (
    <span className={`unit ${className}`}>
      <input ref={ref} {...rest} />
      <i>{unit}</i>
    </span>
  );
});
