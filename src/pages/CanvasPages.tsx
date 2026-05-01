import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Send, 
  RefreshCcw, 
  ExternalLink, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  ChevronDown,
  Layers,
  ChevronRight,
  Home,
  Settings as SettingsIcon
} from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../store';
import { deepLinkSyncService } from '../services/service.deepLinkSync';
import { PlannerSyncDiff } from '../components/planner/PlannerSyncDiff';
import { useAuth } from '../contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export default function CanvasPages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { plannerData, canvasCourseIds, addLog, canvasApiToken } = useStore();
  
  // State for UI management
  const [syncingWeek, setSyncingWeek] = useState<string | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('Math');
  const [syncedWeeks, setSyncedWeeks] = useState<Set<string>>(new Set());

  const currentCourseId = canvasCourseIds[selectedSubject];

  /**
   * Enhanced Error Handling for Token Expiry
   */
  const handleSyncError = (error: any, weekId: string) => {
    console.error(error);
    const isTokenError = error.message?.includes('401') || !canvasApiToken;

    toast.error(isTokenError ? "Canvas Authentication Failed" : `Sync Error: ${weekId}`, {
      description: isTokenError 
        ? "Your API token is missing or expired. Please update it in Settings." 
        : "The Canvas API rejected this request. Check your internet or course ID.",
      action: isTokenError ? {
        label: "Go to Settings",
        onClick: () => navigate('/settings')
      } : undefined
    });
    
    addLog(`CRITICAL: Sync failed for ${weekId}. ${error.message}`);
  };

  const handleDeepSync = async (week: any) => {
    if (!currentCourseId) {
      toast.error(`Missing Course ID`, {
        description: `No Canvas ID found for ${selectedSubject}. Update your mapping in Settings.`
      });
      return;
    }

    setSyncingWeek(week.weekId);
    addLog(`Initiating Deep Link Sync for ${week.weekId} to ${selectedSubject}...`);

    try {
      if (!user) return;
      const result = await deepLinkSyncService.executeTwoPassSync(currentCourseId, week, user.uid);
      
      if (result.success) {
        setSyncedWeeks(prev => new Set(prev).add(week.weekId));
        toast.success(`Sync Successful`, {
          description: `Created linked assignments for ${week.weekId}.`,
          action: {
            label: "View in Canvas",
            onClick: () => window.open(result.pageUrl, '_blank')
          }
        });
        addLog(`Success: ${week.weekId} synced with ${result.assignmentsCreated} deep links.`);
      }
    } catch (error) {
      handleSyncError(error, week.weekId);
    } finally {
      setSyncingWeek(null);
    }
  };

  const handleBatchSync = async () => {
    if (!currentCourseId) return;

    setIsBatchSyncing(true);
    addLog(`STARTING BATCH SYNC: Processing entire quarter for ${selectedSubject}...`);
    
    let successCount = 0;
    try {
      for (const week of (plannerData || [])) {
        setSyncingWeek(week.weekId);
        if (!user) break;
        await deepLinkSyncService.executeTwoPassSync(currentCourseId, week, user.uid);
        setSyncedWeeks(prev => new Set(prev).add(week.weekId));
        successCount++;
      }
      toast.success(`Batch Complete`, {
        description: `Successfully pushed ${successCount} weeks to Canvas.`
      });
    } catch (error) {
      handleSyncError(error, "Batch Process");
    } finally {
      setIsBatchSyncing(false);
      setSyncingWeek(null);
    }
  };

  const subjects = useMemo(() => Object.keys(canvasCourseIds), [canvasCourseIds]);

  if (!plannerData || plannerData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <FileText className="w-16 h-16 text-slate-700 opacity-20" />
        <h2 className="text-xl font-semibold text-slate-400">No Planner Data Found</h2>
        <p className="text-slate-500 max-w-sm">Import your pacing guide or syllabus in the Planner section to start building Canvas pages.</p>
        <Button variant="outline" onClick={() => navigate('/planner')} className="mt-4">
          Go to Planner
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">
        <Home className="w-3 h-3" />
        <ChevronRight className="w-3 h-3" />
        <span onClick={() => navigate('/planner')} className="hover:text-blue-500 cursor-pointer transition-colors">Planner</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-300">Canvas Page Builder</span>
      </nav>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Page Builder
          </h1>
          <p className="text-muted-foreground text-sm">Automate your LMS workflow with AI-powered deep linking.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Dynamic Subject Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-black/20 border-white/10 min-w-[140px] justify-between">
                <Layers className="w-4 h-4 mr-2 text-blue-400" />
                {selectedSubject}
                <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0d0d10] border-white/10 text-slate-200">
              {subjects.map(s => (
                <DropdownMenuItem key={s} onClick={() => setSelectedSubject(s)} className="hover:bg-white/5">
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <PlannerSyncDiff courseId={currentCourseId} courseName={selectedSubject} />

          <Button 
            onClick={handleBatchSync}
            disabled={isBatchSyncing || !currentCourseId}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20"
          >
            {isBatchSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Sync All Weeks
          </Button>
        </div>
      </div>

      {!currentCourseId && (
        <Card className="bg-amber-500/5 border-amber-500/20 border-dashed">
          <CardContent className="flex items-center gap-4 py-4 text-amber-500">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-bold">Missing Configuration:</span> No Canvas Course ID is mapped to <span className="font-bold underline">{selectedSubject}</span>.
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/settings')} className="border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
              <SettingsIcon className="w-3.5 h-3.5 mr-1.5" />
              Fix in Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instructional Note */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-tighter bg-white/5 w-fit px-3 py-1 rounded-full border border-white/5">
        <Info className="w-3 h-3" />
        Note: Deep Link Sync pushes to "Pages". Ensure your weekly modules are published.
      </div>

      {/* Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plannerData.map((week) => {
          const isSynced = syncedWeeks.has(week.weekId);
          const isCurrentSyncing = syncingWeek === week.weekId;

          return (
            <Card key={week.weekId} className={cn(
              "bg-[#0d0d10] border-white/10 hover:border-blue-500/30 transition-all group overflow-hidden relative",
              isSynced && "border-emerald-500/30 shadow-[0_0_20px_-12px_rgba(16,185,129,0.3)]"
            )}>
              {isSynced && (
                <div className="absolute top-0 right-0 p-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
              )}

              <CardHeader className="pb-3 border-b border-white/5 bg-black/20">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-none font-mono">
                    {week.weekId}
                  </Badge>
                  {week.assignments?.length > 0 && (
                     <Badge className="bg-emerald-500/10 text-emerald-500 border-none">
                       {week.assignments.length} Assets
                     </Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-2 group-hover:text-blue-400 transition-colors line-clamp-1">
                  {week.topic}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="pt-4 h-40">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-2.5">
                    {week.assignments && week.assignments.length > 0 ? (
                      week.assignments.map((a: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-slate-400 group/item">
                          <LinkIcon className="w-3.5 h-3.5 mt-0.5 text-slate-600 shrink-0 group-hover/item:text-blue-500 transition-colors" />
                          <span className="line-clamp-2">{a.title}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No assignments extracted for this week.</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              <CardFooter className="bg-black/40 border-t border-white/5 p-4 flex gap-2">
                <Button 
                  onClick={() => handleDeepSync(week)}
                  disabled={!!syncingWeek || !currentCourseId}
                  variant={isSynced ? "outline" : "default"}
                  className={cn(
                    "flex-1 font-bold",
                    !isSynced && "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/10",
                    isSynced && "border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5"
                  )}
                >
                  {isCurrentSyncing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : isSynced ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : (
                    <RefreshCcw className="w-4 h-4 mr-2" />
                  )}
                  {isCurrentSyncing ? "Linking..." : isSynced ? "Synced" : "Deep Link Sync"}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="border-white/10 text-slate-400 hover:text-white"
                  title="Preview Mode"
                  onClick={() => toast.info("Direct Preview is currently being optimized for Cidi Labs compatibility.")}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Utility icon for the instructional note
function Info(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
