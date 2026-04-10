interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  const variantStyles = {
    success: 'bg-[#34d399]/10 border-[#34d399]/30 text-[#34d399]',
    warning: 'bg-[#eab308]/10 border-[#eab308]/30 text-[#eab308]',
    error:   'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]',
    info:    'bg-[#22d3ee]/10 border-[#22d3ee]/30 text-[#22d3ee]',
  };

  return (
    <span
      className={`inline-block px-2 py-1 text-xs font-bold rounded border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
