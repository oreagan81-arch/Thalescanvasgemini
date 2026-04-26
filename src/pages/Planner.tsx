import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Wand2, 
  Upload, 
  Copy, 
  Calendar as CalendarIcon, 
  Check, 
  Loader2,
  FileJson,
  Sparkles as SparklesIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Correcting relative paths: Planner is in src/pages/
// Go up one level to reach src/store.ts and src/services/
import { useStore } from '../store';
import { curriculumExtractionService } from '../services/service.curriculumExtraction';
import { calendarSync } from '../services/service.calendarSync';
import { plannerService, PlannerRow } from '../services/service.planner';
import { calendarService } from '../services/service.calendar';
import { assignmentService } from '../services/service.assignment';
import { useAuth } from '../contexts/AuthContext';

// UI components and lib are at the project root (outside of src/)
// Go up two levels from src/pages/ to reach the root
import { cn } from '../../lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar } from '../../components/ui/calendar';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { ScrollArea, ScrollBar } from '../../components/ui/scroll-area';

// Components inside src/components/planner
import { PlannerHeader } from '../components/planner/PlannerHeader';
import { PlannerEmptyState } from '../components/planner/PlannerEmptyState';
import { PlannerColumn } from '../components/planner/PlannerColumn';
import { PlannerSyncDiff } from '../components/planner/PlannerSyncDiff';
import { PlannerSnowDay } from '../components/planner/PlannerSnowDay';
import { OrphanSweeper } from '../components/planner/OrphanSweeper';
import { diffEngine, DiffResult } from '../services/service.diffEngine';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function Planner() {
  const { user } = useAuth();
  const { 
    selectedWeek: week, 
    setWeek, 
    plannerData, 
    setPlannerData, 
    canvasCourseIds, 
    canvasApiToken 
  } = useStore();
  
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [isMagicImportOpen, setIsMagicImportOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [newStartDate, setNewStartDate] = useState<Date | undefined>(new Date('2026-07-13')); // Defaulting to July 2026
  
  // Local state for previewing changes
  const [previewData, setPreviewData] = useState<any[] | null>(null);

  // Memoize week dates to avoid recalculation on every render
  const weekDates = useMemo(() => {
    const parts = week.split('_');
    if (parts.length < 2) return [];
    const qStr = parts[0].substring(1);
    const wStr = parts[1].substring(1);
    return calendarService.getDatesForContext(parseInt(qStr) || 1, parseInt(wStr) || 1);
  }, [week]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = plannerService.subscribeToWeek(user.uid, week, (fetchedRows) => {
      setRows(fetchedRows);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [week, user]);

  const handleCreateShell = useCallback(async () => {
    try {
      setLoading(true);
      await plannerService.generateWeekShell(week);
      toast.success(`Generated planner shell for ${week}`);
    } catch (error) {
      toast.error('Failed to generate shell');
    } finally {
      setLoading(false);
    }
  }, [week]);

  const handleSyncSheet = useCallback(async () => {
    try {
      setSyncing(true);
      const res = await plannerService.syncFromGoogleSheet(week);
      toast.success(res.message);
    } catch (err) {
      toast.error("Google Sheet Sync Failed");
    } finally {
      setSyncing(false);
    }
  }, [week]);

  const handleCleanData = useCallback(async () => {
    try {
      setSyncing(true);
      const plannerCount = await plannerService.cleanDuplicates(week);
      const assignmentCount = await assignmentService.cleanDuplicates(week);
      toast.success(`Deduplication Complete`, {
        description: `Removed ${plannerCount} duplicate rows and ${assignmentCount} assignments. Graded items were preserved.`
      });
    } catch (err) {
      toast.error("Cleanup failed");
    } finally {
      setSyncing(false);
    }
  }, [week]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<PlannerRow>) => {
    try {
      await plannerService.updateRow(id, updates);
    } catch (err) {
      toast.error('Failed to save change');
    }
  }, []);

  const handleAddBlock = useCallback((day: string) => {
    plannerService.addRow({ 
      weekId: week, 
      day, 
      subject: 'New', 
      lessonNum: '', 
      lessonTitle: '', 
      type: 'Lesson', 
      resources: [], 
      homework: '', 
      reminder: '', 
      notes: '', 
      deployStatus: 'Draft' 
    });
  }, [week]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsExtracting(true);
      toast.info("Gemini is indexing your syllabus...");
      const extracted = await curriculumExtractionService.extractFromDocument(file);
      setPreviewData(extracted);
      toast.success("Syllabus analyzed successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to extract curriculum from document.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCloneYear = () => {
    if (!plannerData || plannerData.length === 0) {
      toast.error("No existing data found to clone.");
      return;
    }
    if (!newStartDate) {
      toast.error("Please select a start date for the new school year.");
      return;
    }

    try {
      const migrated = calendarSync.migratePacing(plannerData, newStartDate.toISOString());
      setPreviewData(migrated);
      toast.success(`Prepared migration for ${migrated.length} weeks.`);
    } catch (err) {
      console.error(err);
      toast.error("Migration failed.");
    }
  };

  const confirmImport = () => {
    if (previewData) {
      setPlannerData(previewData);
      setPreviewData(null);
      setIsMagicImportOpen(false);
      toast.success("Planner updated with new data!");
    }
  };

  const homeroomId = canvasCourseIds['Homeroom'] || '22254';

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <PlannerHeader 
          week={week}
          setWeek={setWeek}
          rowsCount={rows.length}
          loading={loading}
          syncing={syncing}
          onCreateShell={handleCreateShell}
          onSyncSheet={handleSyncSheet}
          onCleanData={handleCleanData}
        >
          <OrphanSweeper 
            courseId={homeroomId}
            courseName="Homeroom"
          />
          <PlannerSnowDay />
          <PlannerSyncDiff 
            courseId={homeroomId}
            courseName="Homeroom"
          />
        </PlannerHeader>

        <div className="flex items-center gap-2">
          {/* Magic Import Dialog */}
          <Dialog open={isMagicImportOpen} onOpenChange={setIsMagicImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20">
                <Wand2 className="w-4 h-4 mr-2" />
                Magic Import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-[#0d0d10] border-white/10 text-slate-100">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-amber-500" />
                  Magic Curriculum Import
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Extract data from a new syllabus or migrate last year's gold-standard pacing.
                </DialogDescription>
              </DialogHeader>

              {!previewData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  {/* Option 1: AI Extraction */}
                  <div className="flex flex-col p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/50 transition-all cursor-pointer group relative">
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handleFileUpload}
                      disabled={isExtracting}
                    />
                    <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      {isExtracting ? <Loader2 className="w-5 h-5 text-amber-500 animate-spin" /> : <Upload className="w-5 h-5 text-amber-500" />}
                    </div>
                    <h3 className="font-bold text-sm">Scan New Syllabus</h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Upload a PDF or Photo. Gemini will extract weeks, topics, and assignments automatically.
                    </p>
                  </div>

                  {/* Option 2: Calendar Migration */}
                  <div className="flex flex-col p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
                      <Copy className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-sm">Clone Previous Year</h3>
                    <div className="mt-3 space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">New Start Date (July)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-8 text-[11px] bg-black/20 border-white/10">
                            <CalendarIcon className="w-3 h-3 mr-2" />
                            {newStartDate ? format(newStartDate, 'PPP') : 'Select Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-[#0d0d10] border-white/10">
                          <Calendar
                            mode="single"
                            selected={newStartDate}
                            onSelect={setNewStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Button 
                        size="sm" 
                        className="w-full h-8 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold"
                        onClick={handleCloneYear}
                      >
                        Prepare Migration
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* PREVIEW STATE */
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-none">Previewing {previewData.length} Weeks</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)} className="text-slate-500 h-6">Cancel</Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-white/10 p-2 bg-black/20">
                    {previewData.slice(0, 5).map((p, i) => (
                      <div key={i} className="p-2 border-b border-white/5 last:border-0 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-amber-500 uppercase">{p.weekId}</p>
                          <p className="text-xs font-medium truncate max-w-[200px]">{p.topic || 'No Topic'}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] opacity-50">{p.assignments?.length || 0} items</Badge>
                      </div>
                    ))}
                    {previewData.length > 5 && <p className="text-center text-[10px] text-slate-600 pt-2 italic">...and {previewData.length - 5} more weeks</p>}
                  </div>
                </div>
              )}

              <DialogFooter>
                {previewData && (
                  <Button onClick={confirmImport} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold">
                    <Check className="w-4 h-4 mr-2" />
                    Confirm & Load into Planner
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
            Export JSON
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Syncing with Thales OS Cloud...</p>
        </div>
      ) : rows.length === 0 ? (
        <PlannerEmptyState onCreateShell={handleCreateShell} />
      ) : (
        <ScrollArea className="flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
          <div className="min-w-max p-6 flex gap-4 h-full">
            {DAYS.map(day => (
              <PlannerColumn 
                key={day}
                day={day}
                rows={rows.filter(r => r.day === day)}
                dateLabel={weekDates.find(d => d.label === day)?.formatted}
                onUpdate={handleUpdate}
                onAddBlock={() => handleAddBlock(day)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="bg-[#0a0a0c]" />
        </ScrollArea>
      )}
    </div>
  );
}
