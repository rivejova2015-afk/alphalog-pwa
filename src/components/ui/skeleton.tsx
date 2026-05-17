import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rect" | "circle";
  width?: number | string;
  height?: number | string;
  count?: number;
}

// Shimmer placeholder for loading states. Tailwind `animate-pulse` is enough;
// no extra CSS needed. Pass `count` to render N skeletons stacked vertically.
export function Skeleton({
  className,
  variant = "rect",
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const base = "animate-pulse bg-slate-700/40";
  const shape = {
    text:   "h-3 rounded",
    rect:   "rounded-md",
    circle: "rounded-full",
  }[variant];

  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;

  if (count === 1) {
    return <div className={cn(base, shape, className)} style={style} aria-hidden="true" />;
  }

  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(base, shape, className)} style={style} />
      ))}
    </div>
  );
}

// Convenience: stacked text lines (for paragraph placeholders).
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-3 bg-slate-700/40 rounded animate-pulse",
            i === lines - 1 ? "w-3/4" : "w-full",
          )}
        />
      ))}
    </div>
  );
}
