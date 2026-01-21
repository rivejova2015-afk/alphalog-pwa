import * as React from 'react';
import { cn } from '@/lib/utils';

// Simple select component using native HTML select
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Select.displayName = 'Select';

const SelectTrigger = Select;
const SelectValue = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ children, ...props }, ref) => (
  <option ref={ref} {...props}>
    {children}
  </option>
));
SelectItem.displayName = 'SelectItem';

const SelectGroup = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const SelectSeparator = () => null;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSeparator,
};
