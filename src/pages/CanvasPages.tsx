import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Wand2, 
  ExternalLink, 
  Rocket, 
  Eye, 
  Code, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  RefreshCcw,
  Eraser
} from 'lucide-react'
import { canvasPageService, CanvasPage } from '../services/service.canvasPage'
import { plannerService } from '../services/service.planner'
import { assignmentService } from '../services/service.assignment'
import { calendarService } from '../services/service.calendar'
import { useStore } from '../store'
import { generateWeeklyAgenda } from '../lib/geminiHelper'
import { COURSE_IDS } from '../constants'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSafeHTML } from '../lib/security'

export function CanvasPages() {
  const week = useStore((state) => state.selectedWeek);
  const setWeek = useStore((state) => state.setWeek);
  const [page, setPage] = useState<CanvasPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  useEffect(() => {
    setSyncing(true);
    const unsubscribe = canvasPageService.subscribeByWeek(week, (pages) => {
      if (pages.length > 0) {
        setPage(pages[0]);
      } else {
        setPage(null);
      }
      setSyncing(false);
    });
    return () => unsubscribe();
  }, [week]);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      // Fetch planner rows for context
      const plannerRows: any[] = [];
      const unsubscribe = plannerService.subscribeToWeek(week, (rows) => {
        plannerRows.push(...rows);
        unsubscribe();
      });

      const html = await generateWeeklyAgenda(week, plannerRows);
      if (html) {
        await canvasPageService.upsert(week, html);
        toast.success('Weekly Agenda Generated');
      }
    } catch (err) {
      console.error("Canvas Agenda Generation Error:", err);
      toast.error('Neural Engine Error: Failed to generate Canvas HTML. Ensure your curriculum nodes are valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleReplay = async () => {
    if (!page) return;
    try {
        setLoading(true);
        // Refresh local content from planner first
        await handleGenerate();
        await canvasPageService.replayPage(page.id!);
        toast.success("Page Rebuild & Replay Triggered");
    } catch (err) {
        toast.error("Replay Failed");
    } finally {
        setLoading(false);
    }
  };

  const handleClean = async () => {
    try {
      setCleaning(true);
      const canvasCount = await canvasPageService.cleanDuplicates(week);
      const assignmentCount = await assignmentService.cleanDuplicates(week);
      toast.success(`Cleanup Complete`, { description: `Removed ${canvasCount} drafts and ${assignmentCount} redundant assignments.`});
    } catch (err) {
      toast.error("Cleanup Failed");
    } finally {
      setCleaning(false);
    }
  };

  const handleDeploy = async () => {
    if (!page) return;
    try {
      setLoading(true);
      // Simulation of Canvas API call
      await new Promise(r => setTimeout(r, 2000));
      await canvasPageService.updateStatus(page.id!, 'Deployed', 'canvas_page_12345');
      toast.success('Deployed to Canvas LMS successfully');
    } catch (err) {
      toast.error('Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Canvas Builder</h1>
          <p className="text-slate-400">Convert your Weekly Planner into high-fidelity Canvas pages.</p>
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
            onClick={handleClean} 
            disabled={loading || cleaning}
            variant="outline" 
            className="border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10"
          >
            {cleaning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eraser className="w-4 h-4 mr-2" />}
            Clean Drafts
          </Button>

          <Button 
            onClick={handleGenerate} 
            disabled={loading}
            variant="outline" 
            className="border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
            Update Content
          </Button>

          {page && (
            <Button 
              onClick={handleReplay} 
              disabled={loading}
              variant="outline"
              className="border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Force Replay
            </Button>
          )}

          {page && (
            <Button 
              onClick={handleDeploy} 
              disabled={loading || page.status === 'Deployed'}
              className={cn(
                "font-bold",
                page.status === 'Deployed' ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"
              )}
            >
              {page.status === 'Deployed' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
              {page.status === 'Deployed' ? 'Deployed' : 'Deploy to Canvas'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 flex-1 overflow-hidden">
        <div className="col-span-1 space-y-6">
           <Card className="rounded-2xl border border-white/10 bg-white/5">
              <CardHeader>
                 <CardTitle className="text-white text-xs uppercase tracking-widest">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Status</span>
                    <Badge variant={page?.status === 'Deployed' ? 'default' : 'outline'} className={cn(
                      "w-fit",
                      page?.status === 'Deployed' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}>
                      {page?.status || 'No Draft'}
                    </Badge>
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Routing ID</span>
                    <span className="text-xs text-amber-500 font-mono">{COURSE_IDS.Homeroom} (Homeroom)</span>
                 </div>
                 {page?.canvasPageId && (
                   <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Canvas ID</span>
                      <span className="text-xs text-white font-mono">{page.canvasPageId}</span>
                   </div>
                 )}
              </CardContent>
           </Card>

           <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
             <h4 className="text-amber-500 text-[10px] font-bold uppercase tracking-widest mb-3">Deployment Safety</h4>
             <p className="text-slate-400 text-xs leading-normal">
               The "Deploy" bridge creates a new page in your Canvas Course under the 'Agendas' module. It will not overwrite existing pages unless configured in Settings.
             </p>
          </div>
        </div>

        <Card className="col-span-3 rounded-2xl border border-white/10 bg-[#121216] flex flex-col overflow-hidden">
          <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between shrink-0">
            <div>
              <CardTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" />
                Live Preview
              </CardTitle>
              <CardDescription className="text-slate-500 text-xs mt-1">Rendered Canvas HTML content.</CardDescription>
            </div>
            <div className="flex bg-[#0a0a0c] p-1 rounded-lg border border-white/10">
               <Button 
                onClick={() => setViewMode('preview')}
                variant="ghost" 
                size="sm" 
                className={cn("text-[10px] uppercase font-bold px-3 h-7", viewMode === 'preview' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300")}
               >
                 <Eye className="w-3 h-3 mr-1.5" />
                 Preview
               </Button>
               <Button 
                onClick={() => setViewMode('code')}
                variant="ghost" 
                size="sm" 
                className={cn("text-[10px] uppercase font-bold px-3 h-7", viewMode === 'code' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300")}
               >
                 <Code className="w-3 h-3 mr-1.5" />
                 Code
               </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto bg-white/[0.02]">
            {!page ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs uppercase font-bold tracking-widest">No Page Generated</p>
                    <p className="text-[10px] mt-1">Click "Generate Page" to start the AI engine.</p>
                  </div>
               </div>
            ) : viewMode === 'code' ? (
              <pre className="p-6 text-[10px] font-mono text-emerald-500/80 leading-relaxed overflow-auto h-full">
                {page.htmlContent}
              </pre>
            ) : (
              <div 
                className="p-8 prose prose-invert max-w-none text-slate-200 Thales-Canvas-Reset"
                dangerouslySetInnerHTML={useSafeHTML(page.htmlContent)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

