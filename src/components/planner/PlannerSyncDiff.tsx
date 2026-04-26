import React, { useState } from 'react';
import { 
  RefreshCcw, 
  PlusCircle, 
  RefreshCw, 
  Archive, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Cloud
} from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../../store';
import { diffEngine, DiffResult } from '../../services/service.diffEngine';

import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PlannerSyncDiffProps {
  courseId: string;
  courseName: string;
}

export function PlannerSyncDiff({ courseId, courseName }: PlannerSyncDiffProps) {
  const { plannerData, canvasApiToken } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [diff, setDiff] = useState<DiffResult | null>(null);

  const handleCalculateDiff = async () => {
    if (!canvasApiToken) {
      toast.error("Canvas Token Missing", {
        description: "Please configure your API token in Settings."
      });
      setIsOpen(false);
      return;
    }

    if (!plannerData || plannerData.length === 0) {
      toast.error("Local planner is empty. Nothing to sync.");
      setIsOpen(false);
      return;
    }

    setIsCalculating(true);
    setDiff(null);
    try {
      const calculatedDiff = await diffEngine.generateDiff(plannerData, courseId);
      setDiff(calculatedDiff);
    } catch (error) {
      toast.error(`Analysis failed for ${courseName}.`, {
        description: error instanceof Error ? error.message : "Ensure API token is valid."
      });
      setIsOpen(false);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExecuteSync = async () => {
    if (!diff) return;
    
    setIsExecuting(true);
    try {
      await diffEngine.executeDiff(courseId, diff);
      toast.success(`Synchronized ${courseName}!`);
      setIsOpen(false);
    } catch (error) {
      toast.error("Sync Protocol Interrupted", {
        description: error instanceof Error ? error.message : "An error occurred during synchronization."
      });
    } finally {
      setIsExecuting(false);
      setDiff(null);
    }
  };

  const totalChanges = diff ? diff.additions.length + diff.updates.length + diff.deletions.length : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (isExecuting) return; // Prevent closing while syncing
        setIsOpen(open);
        if (open) handleCalculateDiff();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10">
          <Cloud className="w-4 h-4 mr-2" />
          Sync {courseName}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl bg-[#0d0d10] border-white/10 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Cloud className="w-6 h-6 text-emerald-500" />
            Canvas Sync Pre-Flight
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Comparing local Planner Data against live Canvas Course: <span className="text-emerald-500 font-mono">{courseName} ({courseId})</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px] py-4">
          {isCalculating ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-4 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
              <div className="text-center">
                <p className="text-lg font-medium text-slate-200">Analyzing Delta...</p>
                <p className="text-sm">Fetching modules and items from Canvas API</p>
              </div>
            </div>
          ) : diff ? (
            <div className="space-y-6">
                
              {totalChanges === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] space-y-4 text-emerald-500">
                    <CheckCircle2 className="w-16 h-16 opacity-20" />
                    <div className="text-center">
                      <p className="text-xl font-bold">Canvas is up to date!</p>
                      <p className="text-sm text-slate-500">Local planner matches remote course state.</p>
                    </div>
                  </div>
              ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                            <PlusCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                            <div className="text-3xl font-mono font-bold text-emerald-500">{diff.additions.length}</div>
                            <div className="text-[10px] text-emerald-500/70 uppercase font-black tracking-widest">To Add</div>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                            <RefreshCw className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                            <div className="text-3xl font-mono font-bold text-amber-500">{diff.updates.length}</div>
                            <div className="text-[10px] text-amber-500/70 uppercase font-black tracking-widest">To Update</div>
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
                            <Archive className="w-6 h-6 text-rose-500 mx-auto mb-2" />
                            <div className="text-3xl font-mono font-bold text-rose-500">{diff.deletions.length}</div>
                            <div className="text-[10px] text-rose-500/70 uppercase font-black tracking-widest">To Archive</div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 pb-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Proposed Modifications
                        </h3>
                        <ScrollArea className="h-[250px] border border-white/5 rounded-xl p-4 bg-white/5">
                            <div className="space-y-2">
                                {diff.additions.map((w, i) => (
                                    <div key={`add-${i}`} className="flex items-center justify-between p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                        <div className="flex items-center gap-3">
                                          <PlusCircle className="w-4 h-4 text-emerald-500" />
                                          <div>
                                            <p className="text-sm font-medium">Week {w.weekNumber}: {(w as any).topic || w.readingWeek}</p>
                                            <p className="text-[10px] text-slate-500">{w.dates}</p>
                                          </div>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-500">NEW</Badge>
                                    </div>
                                ))}
                                {diff.updates.map((w, i) => (
                                    <div key={`upd-${i}`} className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                        <div className="flex items-center gap-3">
                                          <RefreshCw className="w-4 h-4 text-amber-500" />
                                          <div>
                                            <p className="text-sm font-medium">Week {w.weekNumber}: {(w as any).topic || w.readingWeek}</p>
                                            <p className="text-[10px] text-slate-500">{w.dates}</p>
                                          </div>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-500">SYNC</Badge>
                                    </div>
                                ))}
                                {diff.deletions.map((item, i) => (
                                    <div key={`del-${i}`} className="flex items-center justify-between p-3 bg-rose-500/5 rounded-lg border border-rose-500/10 opacity-70">
                                        <div className="flex items-center gap-3">
                                          <Archive className="w-4 h-4 text-rose-500" />
                                          <div>
                                            <p className="text-sm font-medium">{item.title}</p>
                                            <p className="text-[10px] text-slate-500">Canvas Native Item</p>
                                          </div>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] border-rose-500/50 text-rose-500">REMOVE</Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                  </>
              )}
            </div>
          ) : (
             <div className="flex items-center justify-center h-[300px] text-rose-500 text-sm font-medium">
                 <AlertTriangle className="w-5 h-5 mr-2" />
                 Failed to load comparison data. Check console for details.
             </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isExecuting} className="text-slate-500 font-bold uppercase text-[10px]">Cancel</Button>
          <Button 
            onClick={handleExecuteSync} 
            disabled={!diff || totalChanges === 0 || isExecuting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] px-8"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executing Sync...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Push to Canvas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
