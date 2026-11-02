import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type Variant = 'default' | 'primary' | 'ghost' | 'link';
type Size = 'md' | 'sm' | 'icon';

const base =
  'inline-flex items-center justify-center gap-[7px] rounded-btn border font-medium cursor-pointer no-underline transition-[filter,background-color,border-color] disabled:opacity-50 disabled:cursor-not-allowed';
const variants: Record<Variant, string> = {
  default: 'border-line-2 bg-bg text-ink hover:bg-panel hover:border-ink-3',
  primary: 'border-btn bg-btn text-btn-ink hover:brightness-[1.45]',
  ghost: 'border-transparent bg-transparent text-ink-2 hover:bg-panel-2',
  link: 'border-0 bg-transparent p-0 min-h-0 text-purple font-semibold underline',
};
const sizes: Record<Size, string> = {
  md: 'min-h-[38px] px-[14px] py-2 text-[15px]',
  sm: 'min-h-8 px-[11px] py-1 text-[13.5px]',
  icon: 'w-[34px] min-h-[34px] p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn(base, variants[variant], variant !== 'link' && sizes[size], block && 'w-full', className)} {...rest} />;
});
