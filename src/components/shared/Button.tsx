import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  className = '',
  ...props
}: ButtonProps) {
  const variantStyles: Record<ButtonVariant, string> = {
    primary:   'bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] font-bold',
    secondary: 'bg-[#151b28] hover:bg-[#0a0e1a] text-[#e2e8f0] border border-[#1f2937]',
    ghost:     'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#151b28]',
    danger:    'bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  return (
    <button
      className={`rounded font-bold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22d3ee] disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {icon && <span>{icon}</span>}
        {children}
      </span>
    </button>
  );
}
