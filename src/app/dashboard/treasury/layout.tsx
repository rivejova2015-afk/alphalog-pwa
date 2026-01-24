// src/app/dashboard/treasury/layout.tsx
import BackToDashboardButton from "@/components/dashboard/BackToDashboardButton";

export default function TreasuryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <BackToDashboardButton />
      </div>
      {children}
    </div>
  );
}
