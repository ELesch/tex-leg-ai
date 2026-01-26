import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/mobile-header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar className="hidden md:flex" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader className="md:hidden" />
        <main className="flex-1 overflow-hidden bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
