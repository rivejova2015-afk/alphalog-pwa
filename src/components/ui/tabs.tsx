import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContext {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContext | undefined>(undefined);

const Tabs = ({
  children,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
}: {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue || '');
  const value = controlledValue ?? activeTab;

  const handleTabChange = (newValue: string) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab: value, onTabChange: handleTabChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-start overflow-x-auto rounded-full bg-slate-900/70 border border-slate-700/60 p-1 gap-1',
        className
      )}
      {...props}
    />
  );
});
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  const isActive = context?.activeTab === value;

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-slate-800 text-slate-50 shadow-[0_10px_24px_rgba(2,4,10,0.4)]'
          : 'text-slate-300 hover:text-slate-100'
      )}
      onClick={() => context?.onTabChange(value)}
      {...props}
    />
  );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  const isActive = context?.activeTab === value;

  if (!isActive) return null;

  return (
    <div
      ref={ref}
      className={cn('mt-2 focus-visible:outline-none', className)}
      {...props}
    />
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
