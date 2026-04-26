import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  FileText, 
  Send, 
  Rss, 
  Layout,
  Layers, 
  Settings, 
  LogOut, 
  Loader2,
  Github,
  GitBranch,
  ShieldAlert,
  ChevronRight,
  RefreshCw,
  AppWindow,
  Activity,
  Sparkles,
  Wand2
} from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDashboardLogic } from '../hooks/hook.useDashboardLogic';

export function DashboardLayout() {
  const { logOut } = useAuth();
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const heartbeatLogs = useStore((state) => state.heartbeatLogs);
  
  const {
    gitToken,
    repos,
    loadingRepos,
    auditing,
    syncing,
    handleConnectGit,
    handlePullUpdates,
    runThalesProtocol
  } = useDashboardLogic();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    { icon: Calendar, label: 'Planner', to: '/planner' },
    { icon: FileText, label: 'Canvas Pages', to: '/canvas-pages' },
    { icon: Wand2, label: 'Syllabus Mapper', to: '/syllabus-mapper' },
    { icon: Send, label: 'Assignments', to: '/assignments' },
    { icon: Rss, label: 'Announcements', to: '/announcements' },
    { icon: Sparkles, label: 'AI Command Center', to: '/command-center' },
    { icon: Layout, label: 'Blueprints', to: '/templates' },
    { icon: Layers, label: 'Resource Brain', to: '/resources' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - Linear/Superhuman inspired minimal rail */}
      <nav className="w-16 lg:w-64 flex flex-col border-r border-white/10 bg-[#0d0d10] z-20 transition-all duration-300">
        <div className="h-16 flex items-center justify-center lg:justify-start px-4 lg:px-6 border-b border-white/10 shrink-0">
          <div className="h-8 w-8 bg-amber-500 rounded flex items-center justify-center font-bold text-black relative">
            <span className="text-sm font-bold text-black">T</span>
          </div>
          <span className="ml-3 font-semibold tracking-widest uppercase hidden lg:block truncate text-sm">
            Thales Academy <span className="text-amber-500 font-mono italic">OS</span>
          </span>
        </div>

        <div className="flex-1 py-4 flex flex-col gap-6 px-3 overflow-y-auto overflow-x-hidden disable-scrollbars">
          <div className="space-y-1">
            <p className="hidden lg:block text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] px-3 mb-2">Systems</p>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-center lg:justify-start px-0 lg:px-3 h-10 w-10 lg:w-full rounded-md transition-all duration-200 group text-sm relative",
                    isActive 
                      ? "bg-white/5 text-amber-500 font-medium" 
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-amber-500" : "text-slate-500 group-hover:text-slate-400")} />
                    <span className="ml-3 hidden lg:block truncate font-medium">{item.label}</span>
                    {isActive && <div className="hidden lg:block absolute right-0 w-0.5 h-4 bg-amber-500 rounded-l-full" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* GitHub Repository Index */}
          <div className="space-y-3 pt-4 border-t border-white/5">
             <div className="px-3 flex items-center justify-between">
                <p className="hidden lg:block text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Pacing Sync</p>
                {!gitToken && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-500 hover:text-amber-500"
                    onClick={handleConnectGit}
                  >
                    <Github className="w-4 h-4" />
                  </Button>
                )}
             </div>

             {!gitToken ? (
                <div className="hidden lg:block px-3 py-4 bg-white/5 rounded-xl border border-dashed border-white/10 text-center">
                   <p className="text-[10px] text-slate-500 leading-normal">Cloud sync required for Pacing Handshake.</p>
                   <Button 
                    onClick={handleConnectGit}
                    className="mt-3 h-7 w-full text-[10px] bg-slate-100 text-black font-bold uppercase hover:bg-white"
                   >
                     Connect GitHub
                   </Button>
                </div>
             ) : (
                <div className="space-y-1">
                   {loadingRepos ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                      </div>
                   ) : (
                      <div className="hidden lg:block max-h-64 overflow-y-auto px-1 space-y-1 disable-scrollbars">
                         {repos.map(repo => (
                            <div 
                              key={repo.id} 
                              className="group flex flex-col p-2 rounded-lg hover:bg-white/5 transition-colors cursor-default"
                            >
                               <div className="flex items-center justify-between">
                                  <div className="flex items-center min-w-0">
                                     <GitBranch className={cn("w-3 h-3 mr-2 shrink-0", repo.name.includes('pilot') ? "text-amber-500" : "text-slate-600")} />
                                     <span className="text-[11px] font-medium text-slate-400 truncate group-hover:text-slate-200">{repo.name}</span>
                                  </div>
                                  {repo.name === 'pacing-sync-pilot-8c50be47' && <Badge className="bg-amber-500/10 text-amber-500 border-none text-[8px] h-3 px-1 leading-none uppercase font-bold">Target</Badge>}
                               </div>
                               
                               {repo.name === 'pacing-sync-pilot-8c50be47' && (
                                  <div className="flex gap-1.5 mt-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handlePullUpdates(repo.full_name)}
                                      disabled={syncing === repo.full_name}
                                      className="flex-1 h-6 text-[9px] bg-white/5 border-white/10 text-white font-bold uppercase hover:bg-white/10"
                                    >
                                      {syncing === repo.full_name ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                      Pull Updates
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      onClick={() => runThalesProtocol(repo.full_name)}
                                      disabled={auditing === repo.full_name}
                                      className="h-6 px-2 bg-amber-500 text-black font-bold uppercase hover:bg-amber-400"
                                    >
                                      {auditing === repo.full_name ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
                                    </Button>
                                  </div>
                               )}
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             )}
          </div>

          {/* Heartbeat Console */}
          <div className="mt-auto pt-4 border-t border-white/5 px-3">
             <p className="hidden lg:block text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Activity className="w-3 h-3 text-amber-500" />
                Heartbeat Console
             </p>
             <div className="hidden lg:block bg-black/40 rounded-lg p-2 font-mono text-[9px] h-32 overflow-y-auto space-y-1 disable-scrollbars border border-white/5">
                {heartbeatLogs.map((log, i) => (
                  <div key={i} className="text-emerald-500/70 whitespace-pre-wrap leading-tight">
                    <span className="text-emerald-800 mr-1">{'>'}</span>
                    {log}
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="p-3 border-t border-white/10 shrink-0 lg:p-6 bg-black/20">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={logOut} 
            className="w-10 h-10 lg:w-full flex lg:justify-start lg:px-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-md"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className="ml-3 hidden lg:block text-sm font-medium">Terminate Session</span>
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0c] relative z-10 box-border">
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
