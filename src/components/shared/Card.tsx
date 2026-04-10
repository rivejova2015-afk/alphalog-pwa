interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className = '', onClick, hover = false }: CardProps) {
  return (
    <div
      className={`bg-[#151b28] border border-[#1f2937] rounded-lg p-4 transition-colors duration-150 ${
        hover ? 'hover:border-[#22d3ee]/30 cursor-pointer' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
