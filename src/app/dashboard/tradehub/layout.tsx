// src/app/dashboard/tradehub/layout.tsx
export default function TradeHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">{children}</div>
  );
}
