import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Rocket, 
  RefreshCcw, 
  Calendar, 
  CheckCircle2, 
  Loader2,
  FileEdit,
  ExternalLink,
  ChevronRight,
  ClipboardList,
  Sparkles,
  Cloud,
  AlertCircle
} from 'lucide-react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { assignmentService, Assignment } from '../services/service.assignment'
import { plannerService } from '../services/service.planner'
import { calendarService } from '../services/service.calendar'
import { canvasSyncService } from '../services/service.canvasSync'
import { useStore } from '../store'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function Assignments() {
  const { user } = useAuth();
  const currentContext = calendarService.getAcademicContext();
  const { selectedWeek: week, setWeek, canvasCourseIds, canvasApiToken } = useStore();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [diff, setDiff] = useState<any>(null);
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setSyncing(true);
    const unsubscribe = assignmentService.subscribeByWeek(user.uid, week, (data) => {
      setAssignments(data);
      setSyncing(false);
    });
    return () => unsubscribe();
  }, [week, user]);

  const handleRunDiff = async () => {
    if (!canvasApiToken) {
      toast.error("Canvas API Token Missing", {
        description: "Please configure it in Settings first."
      });
      return;
    }
    try {
      setLoading(true);
      const homeroomId = canvasCourseIds['Homeroom'] || '22254';
      const result = await canvasSyncService.getCanvasDiff(homeroomId, week, assignments);
      setDiff(result);
      setIsDiffOpen(true);
    } catch (err) {
      toast.error("Failed to fetch Canvas state");
    } finally {
      setLoading(false);
    }
  };

  const handleDeployOne = async (item: Assignment) => {
    try {
      setLoading(true);
      await canvasSyncService.deploySingleAssignment(item);
      toast.success(`'${item.title}' Deployed to Canvas`);
    } catch (err) {
      toast.error('Deployment failed');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Fetch planner rows for context
      const plannerRows: any[] = [];
      const unsubscribe = plannerService.subscribeToWeek(user.uid, week, (rows) => {
        plannerRows.push(...rows);
        unsubscribe();
      });

      await assignmentService.generateFromPlanner(week, plannerRows, canvasCourseIds);
      toast.success('Assignment Drafts Created');
    } catch (err) {
      toast.error('Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Assignment Bridge</h1>
          <p className="text-slate-400">Automated assignment creation engine for Canvas LMS.</p>
        </div>
        <div className="flex items-center gap-3">
           <Select value={week} onValueChange={setWeek}>
            <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Select Week" />
            </SelectTrigger>
            <SelectContent className="bg-[#121216] border-white/10 text-white">
              {[1, 2, 3, 4].map(q => 
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(w => (
                  <SelectItem key={`Q${q}_W${w}`} value={`Q${q}_W${w}`}>
                    Q{q} - Week {w}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Button 
            onClick={handleRunDiff}
            disabled={loading || syncing}
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
            Review Canvas Sync
          </Button>

          <Button 
            onClick={handleAutoGenerate} 
            disabled={loading}
            variant="outline" 
            className="border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Auto-Sync from Planner
          </Button>
        </div>
      </div>

      <Dialog open={isDiffOpen} onOpenChange={setIsDiffOpen}>
        <DialogContent className="max-w-3xl bg-[#0d0d10] border-white/10 text-slate-100">
           <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                 <Cloud className="w-5 h-5 text-emerald-500" />
                 Pre-Flight Sync Audit
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                 Comparing your local assignments for {week} with the current state of Canvas Course {canvasCourseIds['Homeroom']}.
              </DialogDescription>
           </DialogHeader>

           {diff && (
              <div className="space-y-6 py-4">
                 <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                       <p className="text-[10px] uppercase font-bold text-emerald-500 mb-1">To Add</p>
                       <p className="text-2xl font-mono text-emerald-500">{diff.toAdd.length}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                       <p className="text-[10px] uppercase font-bold text-amber-500 mb-1">To Update</p>
                       <p className="text-2xl font-mono text-amber-500">{diff.toUpdate.length}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                       <p className="text-[10px] uppercase font-bold text-red-500 mb-1">Orphaned</p>
                       <p className="text-2xl font-mono text-red-500">{diff.toArchive.length}</p>
                    </div>
                 </div>

                 <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                    {diff.toAdd.map((a: any) => (
                       <div key={a.id} className="p-3 bg-white/5 rounded-lg border-l-4 border-emerald-500 flex justify-between items-center">
                          <span className="text-sm font-medium">{a.title}</span>
                          <Badge className="bg-emerald-500/20 text-emerald-500 text-[10px]">NEW</Badge>
                       </div>
                    ))}
                    {diff.toUpdate.map((u: any) => (
                       <div key={u.local.id} className="p-3 bg-white/5 rounded-lg border-l-4 border-amber-500 flex justify-between items-center">
                          <span className="text-sm font-medium">{u.local.title}</span>
                          <Badge className="bg-amber-500/20 text-amber-500 text-[10px]">CHANGED</Badge>
                       </div>
                    ))}
                    {diff.toArchive.map((r: any) => (
                       <div key={r.id} className="p-3 bg-white/5 rounded-lg border-l-4 border-red-500 flex justify-between items-center opacity-70">
                          <span className="text-sm font-medium">{r.name}</span>
                          <Badge className="bg-red-500/20 text-red-500 text-[10px]">CANVAS ONLY</Badge>
                       </div>
                    ))}
                 </div>
              </div>
           )}

           <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setIsDiffOpen(false)} className="text-slate-500 font-bold uppercase text-[10px]">Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-[10px] px-8" onClick={() => {
                toast.info("Bulk synchronization protocol initiated...");
                setIsDiffOpen(false);
              }}>
                 Execute Deterministic Sync
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-4 gap-6 flex-1 overflow-hidden">
        <div className="col-span-1 space-y-6">
           <Card className="rounded-2xl border border-white/10 bg-white/5">
              <CardHeader>
                 <CardTitle className="text-white text-xs uppercase tracking-widest">Queue Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Pending</span>
                    <span className="text-amber-500 font-mono text-xs">{assignments.filter(a => a.status === 'Pending').length}</span>
                 </div>
                 <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Deployed</span>
                    <span className="text-emerald-500 font-mono text-xs">{assignments.filter(a => a.status === 'Deployed').length}</span>
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
             <h4 className="text-amber-500 text-[10px] font-bold uppercase tracking-widest mb-3">Deterministic Engine</h4>
             <p className="text-slate-400 text-xs leading-normal">
               The "Bridge" automatically pulls lesson topics from your Weekly Planner and formats them as standard Canvas Assignments with due dates.
             </p>
          </div>
        </div>

        <Card className="col-span-3 rounded-2xl border border-white/10 bg-[#121216] flex flex-col overflow-hidden">
          <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between shrink-0">
            <div>
              <CardTitle className="text-white text-sm uppercase tracking-widest">Assignment Pipeline</CardTitle>
              <CardDescription className="text-slate-500 text-xs mt-1">Pending synchronization queue.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            {syncing ? (
              <div className="flex h-64 items-center justify-center">
                 <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : assignments.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-96 text-slate-600 gap-4">
                  <ClipboardList className="w-12 h-12 opacity-20" />
                  <div className="text-center">
                    <p className="text-xs uppercase font-bold tracking-widest">Queue Empty</p>
                    <p className="text-[10px] mt-1">Click "Auto-Sync" to pull from your Planner.</p>
                  </div>
               </div>
            ) : (
              <div className="divide-y divide-white/5">
                {assignments.map((item) => (
                  <div key={item.id} className="group p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                       <div className={cn(
                         "h-12 w-12 rounded-xl flex items-center justify-center border transition-colors",
                         item.status === 'Deployed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-white/5 border-white/10 text-slate-500 group-hover:text-amber-500"
                       )}>
                          {item.status === 'Deployed' ? <CheckCircle2 className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                       </div>
                       <div>
                          <div className="flex items-center gap-2">
                             <h4 className="text-sm font-bold text-slate-100">{item.title}</h4>
                             <Badge variant="outline" className="bg-white/5 text-[9px] border-white/10 text-slate-500 font-bold tracking-tighter uppercase p-0 px-2 h-4">
                               {item.subject}
                             </Badge>
                             <Badge variant="outline" className="bg-amber-500/5 text-[9px] border-amber-500/20 text-amber-500 uppercase p-0 px-2 h-4 font-mono">
                               ID: {item.courseId}
                             </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                             <p className="text-[10px] text-slate-600 font-mono">Status: {item.status}</p>
                             {item.canvasId && <p className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                                <ExternalLink className="w-2.5 h-2.5" />
                                {item.canvasId}
                             </p>}
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                       <Button 
                        size="sm" 
                        onClick={() => handleDeployOne(item)}
                        disabled={loading || item.status === 'Deployed'}
                        className={cn(
                          "h-8 px-4 text-[10px] font-bold uppercase",
                          item.status === 'Deployed' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-amber-500 text-black hover:bg-amber-400"
                        )}
                       >
                          {item.status === 'Deployed' ? 'Synced' : 'Deploy'}
                          {item.status !== 'Deployed' && <Rocket className="w-3 h-3 ml-2" />}
                       </Button>
                       <ChevronRight className="w-4 h-4 text-slate-800" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

