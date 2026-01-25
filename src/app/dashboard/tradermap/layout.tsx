// src/app/dashboard/tradermap/layout.tsx
export default function TradermapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">{children}</div>
  );
}
