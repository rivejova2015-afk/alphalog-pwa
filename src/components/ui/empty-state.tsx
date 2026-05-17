import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

// Standardized empty-list / no-results placeholder. Keep usage consistent so
// users learn to recognize "nothing here yet" vs "loading" vs "error".
export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 px-4 rounded-lg border border-dashed border-slate-700/60 bg-slate-900/30",
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center mb-3">
        <Icon size={22} className="text-slate-500" />
      </div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {message && <p className="text-xs text-slate-400 mt-1 max-w-xs">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
