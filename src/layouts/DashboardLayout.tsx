import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, FileText, Send, Rss, Layers, Settings, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function DashboardLayout() {
  const { logOut } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    { icon: Calendar, label: 'Planner', to: '/planner' },
    { icon: FileText, label: 'Canvas Pages', to: '/canvas-pages' },
    { icon: Send, label: 'Assignments', to: '/assignments' },
    { icon: Rss, label: 'Announcements', to: '/announcements' },
    { icon: Layers, label: 'Resource Brain', to: '/resources' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - Linear/Superhuman inspired minimal rail */}
      <nav className="w-16 lg:w-60 flex flex-col border-r border-white/10 bg-[#0d0d10] z-20 transition-all duration-300">
        <div className="h-16 flex items-center justify-center lg:justify-start px-4 lg:px-6 border-b border-white/10 shrink-0">
          <div className="h-8 w-8 bg-amber-500 rounded flex items-center justify-center font-bold text-black relative">
            <span className="text-sm font-bold text-black">T</span>
          </div>
          <span className="ml-3 font-semibold tracking-widest uppercase hidden lg:block truncate text-sm">
            Thales OS <span className="text-amber-500">v2</span>
          </span>
        </div>

        <div className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto overflow-x-hidden disable-scrollbars">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-center lg:justify-start px-0 lg:px-3 h-10 w-10 lg:w-full rounded-md transition-all duration-200 group text-sm relative",
                  isActive 
                    ? "bg-white/5 text-amber-500 font-medium lg:border-r-2 lg:border-amber-500 lg:rounded-r-none" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-amber-500" : "text-slate-500 group-hover:text-slate-400")} />
                  <span className="ml-3 hidden lg:block truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="p-3 border-t border-white/10 shrink-0 lg:p-6">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={logOut} 
            className="w-10 h-10 lg:w-full flex lg:justify-start lg:px-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-md"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className="ml-3 hidden lg:block text-sm">Sign Out</span>
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0c] relative z-10">
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
