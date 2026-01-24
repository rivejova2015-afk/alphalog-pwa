// src/app/dashboard/logs/layout.tsx
import BackToDashboardButton from "@/components/BackToDashboardButton.client";

export default function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 md:ml-56">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-50">Journal PT</h1>
          <BackToDashboardButton />
        </div>
      </header>
      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
