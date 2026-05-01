import React, { useState } from 'react';
import { 
  FolderSearch, 
  Wand2, 
  CheckCircle2, 
  ArrowRight, 
  Loader2,
  FileBox,
  AlertTriangle,
  Search,
  Sparkles,
  RefreshCw,
  FolderSync,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

// Services & Store
import { orphanSweeperService, FileCleanupPlan } from '../../services/service.orphanSweeper';
import { resourceValidatorService, MissingAsset } from '../../services/service.resourceValidator';
import { useStore } from '../../store';

// UI components from root components/ui
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface OrphanSweeperProps {
  courseId: string;
  courseName?: string;
}

export function OrphanSweeper({ courseId, courseName = "Course" }: OrphanSweeperProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // === Sweeper State ===
  const [isScanning, setIsScanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [cleanupPlan, setCleanupPlan] = useState<FileCleanupPlan[] | null>(null);

  // === Validator State ===
  const { plannerData } = useStore();
  const [isValidating, setIsValidating] = useState(false);
  const [missingAssets, setMissingAssets] = useState<MissingAsset[] | null>(null);

  // --- Sweeper Handlers ---
  const handleScanAndAnalyze = async () => {
    setIsScanning(true);
    setCleanupPlan(null);
    try {
      const files = await orphanSweeperService.getOrphanedFiles(courseId);
      
      if (files.length === 0) {
        toast.success("Root directory is clean! No orphaned files found.");
        setIsScanning(false);
        return;
      }

      toast.info(`Found ${files.length} messy files. Gemini is analyzing...`);
      const plan = await orphanSweeperService.analyzeFiles(files);
      setCleanupPlan(plan);
      toast.success("AI File Analysis complete.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to scan or analyze Canvas files.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleExecuteCleanup = async () => {
    if (!cleanupPlan) return;
    setIsExecuting(true);
    try {
      await orphanSweeperService.executeCleanup(courseId, cleanupPlan);
      toast.success("File system successfully organized!");
      setCleanupPlan(null);
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to organize files in Canvas.");
    } finally {
      setIsExecuting(false);
    }
  };

  // --- Validator Handlers ---
  const handleValidateAssets = async () => {
    if (!plannerData || plannerData.length === 0) {
      toast.error("Planner is empty. Please populate your planner first.");
      return;
    }

    setIsValidating(true);
    setMissingAssets(null);
    try {
      const missing = await resourceValidatorService.findMissingAssets(courseId, plannerData);
      setMissingAssets(missing);
      
      if (missing.length === 0) {
        toast.success("All required assets are present in Canvas!");
      } else {
        toast.warning(`Found ${missing.length} missing assets.`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to validate assets.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
            <Trash2 className="w-4 h-4 mr-2" />
            Sweep {courseName}
          </Button>
        }
      />

      <DialogContent className="max-w-2xl bg-[#0d0d10] border-white/10 text-slate-100 p-0 overflow-hidden">
        <Tabs defaultValue="sweeper" className="w-full">
          <CardHeader className="p-6 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-emerald-400 text-xl font-bold">
                  <FileBox className="w-6 h-6" />
                  Resource Command Center
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Manage and validate files for {courseName}.
                </DialogDescription>
              </div>
              <TabsList className="bg-black/40 border border-white/10 p-1">
                <TabsTrigger value="sweeper" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-bold uppercase tracking-widest px-4 py-2">
                  <FolderSearch className="w-3.5 h-3.5 mr-1.5" />
                  Orphan Sweeper
                </TabsTrigger>
                <TabsTrigger value="validator" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white text-xs font-bold uppercase tracking-widest px-4 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Asset Validator
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          {/* TAB 1: ORPHAN SWEEPER */}
          <TabsContent value="sweeper" className="m-0 focus-visible:outline-none">
            <div className="p-6 space-y-6">
              {!cleanupPlan ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/10 rounded-2xl bg-black/20">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20">
                    <FileBox className="w-10 h-10 text-emerald-500/50" />
                  </div>
                  <p className="text-lg font-bold text-slate-200 mb-2">Automated Folder Purge</p>
                  <p className="text-sm text-slate-400 text-center mb-8 max-w-sm">
                    Analyze the course root for unorganized files. Gemini will automatically rename and sort them into weekly folders.
                  </p>
                  <Button 
                    onClick={handleScanAndAnalyze} 
                    disabled={isScanning}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] px-8 py-6 h-auto tracking-widest"
                  >
                    {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                    {isScanning ? "Analyzing Course Assets..." : "Trigger AI Root Scan"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 font-mono uppercase tracking-tighter">
                      {cleanupPlan.length} Operations Ready
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setCleanupPlan(null)} disabled={isExecuting} className="text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase">
                      Restart Analysis
                    </Button>
                  </div>

                  <ScrollArea className="h-[300px] border border-white/5 rounded-xl bg-black/40 p-4">
                    <div className="space-y-3">
                      {cleanupPlan.map((file, i) => (
                        <div key={i} className="p-4 bg-white/[0.03] border border-white/5 rounded-lg flex flex-col gap-3 hover:bg-white/[0.05] transition-all group">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] text-slate-500 font-mono truncate max-w-[45%] opacity-70 group-hover:opacity-100 transition-opacity">
                              {file.originalName}
                            </span>
                            <div className="flex-1 flex items-center justify-center">
                              <ArrowRight className="w-4 h-4 text-slate-600" />
                            </div>
                            <span className="text-[10px] text-emerald-400 font-mono font-bold truncate max-w-[45%]">
                              {file.newName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="px-2 py-1 bg-emerald-500/10 rounded flex items-center gap-1.5 border border-emerald-500/10">
                               <FolderSync className="w-3 h-3 text-emerald-500" />
                               <span className="text-[9px] font-black uppercase text-emerald-500/80 tracking-widest">{file.targetFolderName}</span>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button 
                    onClick={handleExecuteCleanup} 
                    disabled={isExecuting}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] py-6 tracking-widest shadow-lg shadow-emerald-900/20"
                  >
                    {isExecuting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    {isExecuting ? "Executing Protocol..." : "Launch Asset Migration"}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: ASSET VALIDATOR */}
          <TabsContent value="validator" className="m-0 focus-visible:outline-none">
            <div className="p-6 space-y-6">
              {!missingAssets ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/10 rounded-2xl bg-black/20">
                  <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20">
                    <Search className="w-10 h-10 text-amber-500/50" />
                  </div>
                  <p className="text-lg font-bold text-slate-200 mb-2">Cross-Reference Audit</p>
                  <p className="text-sm text-slate-400 text-center mb-8 max-w-sm">
                    Ensure all planned assignments actually exist in Canvas. We'll check every week's folder for matching PDF, Quiz, or Slide assets.
                  </p>
                  <Button 
                    onClick={handleValidateAssets} 
                    disabled={isValidating}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] px-8 py-6 h-auto tracking-widest"
                  >
                    {isValidating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    {isValidating ? "Validating Course integrity..." : "Run Integrity Check"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <Badge className={missingAssets.length === 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 font-mono uppercase" : "bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 font-mono uppercase"}>
                      {missingAssets.length === 0 ? "Audit Passed: 0 Missing" : `Audit Failed: ${missingAssets.length} Discrepancies`}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setMissingAssets(null)} className="text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase">
                      Clear Audit
                    </Button>
                  </div>

                  {missingAssets.length > 0 ? (
                    <ScrollArea className="h-[300px] border border-white/5 rounded-xl bg-black/40 p-4">
                      <div className="space-y-3">
                        {missingAssets.map((asset, i) => (
                          <div key={i} className="p-4 bg-rose-500/[0.02] border border-rose-500/10 rounded-lg flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-200">{asset.assignmentTitle}</span>
                              <Badge variant="outline" className="text-[9px] font-black bg-rose-500/10 border-rose-500/20 text-rose-500 uppercase tracking-widest">{asset.weekId}</Badge>
                            </div>
                            <p className="text-[10px] text-rose-400/80 italic flex items-start gap-2 bg-rose-500/5 p-2 rounded border border-rose-500/5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {asset.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center border border-white/5 rounded-xl bg-emerald-500/[0.02] text-emerald-500">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 transition-transform hover:scale-110">
                        <CheckCircle2 className="w-8 h-8 opacity-50" />
                      </div>
                      <p className="font-bold text-lg">Course Validated</p>
                      <p className="text-xs text-emerald-500/50 uppercase tracking-widest mt-1">All assets accounted for in Canvas</p>
                    </div>
                  )}
                  
                  <Button 
                    onClick={() => setMissingAssets(null)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black uppercase text-[10px] py-6 tracking-widest"
                  >
                    Close Report
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end">
           <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300 font-bold text-[10px] uppercase">
             Close Command Center
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Re-defining CardHeader since we need it in the Tabs
function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
