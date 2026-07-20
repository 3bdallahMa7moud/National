import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export default function AppShell() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-background print:bg-white print:min-h-0 print:!p-0 print:!m-0">
      <Sidebar />
      <div
        className={cn(
          'min-w-0 transition-all duration-300 print:!ms-0 print:!m-0 print:!p-0 print:!w-full print:!block',
          sidebarCollapsed ? 'lg:ms-[72px]' : 'lg:ms-64'
        )}
      >
        <Topbar />
        <main className="min-w-0 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7 print:!p-0 print:!m-0 print:!overflow-visible print:!w-full print:!block">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
