import * as React from 'react';
import { cn } from '@/lib/utils';

// Native checkbox wrapper that also accepts shadcn/ui's onCheckedChange contract
// so callers can write `<Switch onCheckedChange={fn}>` (boolean) interchangeably
// with the native `onChange` (event) handler.
interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onCheckedChange?: (checked: boolean) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      onChange={(e) => {
        onChange?.(e);
        onCheckedChange?.(e.target.checked);
      }}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-slate-700/80 checked:bg-blue-600',
        className
      )}
      {...props}
    />
  ),
);
Switch.displayName = 'Switch';

export { Switch };
