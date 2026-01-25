// src/app/dashboard/treasury/layout.tsx
export default function TreasuryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">{children}</div>
  );
}
