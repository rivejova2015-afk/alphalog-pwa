import * as React from 'react';
import { cn } from '@/lib/utils';

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?:
      | 'default'
      | 'destructive'
      | 'outline'
      | 'secondary'
      | 'ghost'
      | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
  }
>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      ...props
    },
    ref
  ) => (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-primary text-primary-foreground shadow-[0_14px_28px_rgba(2,4,10,0.35)] hover:bg-primary/90':
            variant === 'default',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90':
            variant === 'destructive',
          'border border-input/70 bg-transparent text-slate-100 hover:bg-slate-800/60':
            variant === 'outline',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80':
            variant === 'secondary',
          'text-slate-200 hover:bg-slate-800/60 hover:text-slate-50':
            variant === 'ghost',
          'text-primary underline-offset-4 hover:underline':
            variant === 'link',
        },
        {
          'h-9 px-4 py-2': size === 'default',
          'h-8 rounded px-3 text-xs': size === 'sm',
          'h-10 rounded-md px-8': size === 'lg',
          'h-9 w-9': size === 'icon',
        },
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button };
