import { Header } from './Header.client';
import { AppSidebar } from './Sidebar.client';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-[#e2e8f0] flex flex-col">
      <Header />
      {/* Desktop: content left + sidebar right. Mobile: full width */}
      <div className="flex flex-1 pt-16">
        <main className="flex-1 p-4 overflow-y-auto lg:mr-72">
          {children}
        </main>
        <AppSidebar />
      </div>
    </div>
  );
}
