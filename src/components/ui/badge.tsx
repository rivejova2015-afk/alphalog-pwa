import * as React from 'react';
import { cn } from '@/lib/utils';

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'warning' | 'running' | 'stopped' | 'paused' | 'error';
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60 focus:ring-offset-2',
      {
        'border-transparent bg-primary text-primary-foreground hover:bg-primary/85':
          variant === 'default',
        'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80':
          variant === 'secondary',
        'border-slate-700/70 text-slate-200': variant === 'outline',
        'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85':
          variant === 'destructive',
        'border-transparent bg-amber-600/20 text-amber-200 hover:bg-amber-600/30':
          variant === 'warning',
        'border-green-500/30 bg-green-500/15 text-green-300 shadow-[0_0_8px_rgba(57,255,20,0.1)]':
          variant === 'running',
        'border-slate-500/30 bg-slate-500/15 text-slate-400':
          variant === 'stopped',
        'border-amber-500/30 bg-amber-500/15 text-amber-300':
          variant === 'paused',
        'border-red-500/30 bg-red-500/15 text-red-300 shadow-[0_0_8px_rgba(255,7,58,0.1)]':
          variant === 'error',
      },
      className
    )}
    {...props}
  />
));
Badge.displayName = 'Badge';

export { Badge };
