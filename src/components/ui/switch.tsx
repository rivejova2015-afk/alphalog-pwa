import * as React from 'react';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/60 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-slate-700/80 checked:bg-blue-600',
      className
    )}
    {...props}
  />
));
Switch.displayName = 'Switch';

export { Switch };
