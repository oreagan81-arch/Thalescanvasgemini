import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../store';
import { plannerService, PlannerRow } from '../services/service.planner';
import { plannerAIService, AIPlannerResult } from '../services/plannerAIService'; 
import { pacingImportService } from '../services/service.pacingImport';
import { calendarService } from '../services/service.calendar';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { useJob } from '../hooks/useJob';
import { CommandReviewModal } from '../components/planner/CommandReviewModal';

import { ScrollArea, ScrollBar } from '../../components/ui/scroll-area';

import { PlannerHeader } from '../components/planner/PlannerHeader';
import { PlannerEmptyState } from '../components/planner/PlannerEmptyState';
import { PlannerColumn } from '../components/planner/PlannerColumn';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function Planner() {
  const { user } = useAuth();
  const { 
    selectedWeek: week, 
    setWeek,
    activeJobId,
    setActiveJob
  } = useStore();
  
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const rowsRef = useRef<PlannerRow[]>([]);
  const autoFillTriggeredRef = useRef<Record<string, boolean>>({});

  // Review Layer State
  const [pendingPlan, setPendingPlan] = useState<AIPlannerResult | null>(null);

  // Monitor Job Progress
  const { job } = useJob(activeJobId);

  useEffect(() => {
    if (job?.status === 'completed' && job.result) {
      setPendingPlan(job.result as AIPlannerResult);
    }
  }, [job?.status]);

  const handleCommitPlan = async () => {
    if (!pendingPlan) return;
    try {
      toast.info("Finalizing Neural Synthesis...");
      
      const existingRows = rowsRef.current;
      const newPlanDays = pendingPlan.days;

      // 1. Determine deletions
      const preservedIds = new Set(newPlanDays.map(d => d.id).filter(id => id));
      const toDelete = existingRows.filter(r => !preservedIds.has(r.id));

      for (const row of toDelete) {
        await plannerService.deleteRow(row.id!);
      }

      // 2. Apply Updates and Additions
      const DAY_MAP: Record<string, string> = { 
        Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday', Friday: 'Friday' 
      };
      
      for (const dayPlan of newPlanDays) {
        const day = DAY_MAP[dayPlan.day] || dayPlan.day;
        
        const rowData = {
          weekId: week,
          day,
          subject: pendingPlan.course || 'Curriculum',
          lessonNum: '',
          lessonTitle: dayPlan.lesson,
          type: 'Lesson' as const,
          resources: dayPlan.resources || [],
          homework: dayPlan.homework || '',
          reminder: '',
          notes: (dayPlan.objectives || []).join('\n'),
          deployStatus: 'Draft' as const,
          updatedAt: Date.now()
        };

        if (dayPlan.id) {
          await plannerService.updateRow(dayPlan.id, rowData);
        } else {
          await plannerService.addRow({
            ...rowData,
            order: Date.now()
          });
        }
      }
      
      toast.success("Command Output Mapped! Preserved your manual changes.");
      setActiveJob(null);
      setPendingPlan(null);
    } catch (err) {
      console.error(err);
      toast.error("Mapping Failed: Brain integrity lost.");
    }
  };

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Auto-load Q4_W4 on initial mount if week hasn't been set,
  // or generally ensure we have a valid week.
  useEffect(() => {
    // If we have content, just keep the current week. 
    // Otherwise force the week we expect.
    if (!week) {
        setWeek('Q4_W4');
    }
  }, [week, setWeek]);

  // Auto-extract if no data for the week AND we have a pacing URL
  useEffect(() => {
    if (week === 'Q4_W4' && rows.length === 0 && !loading && !autoFillTriggeredRef.current[week]) {
        autoFillTriggeredRef.current[week] = true;
        handleAiAutofill();
    }
  }, [week, rows.length, loading]);

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

  const handleSyncResources = useCallback(async () => {
    try {
      setSyncing(true);
      const { resourceService } = await import('../services/service.resource');
      await resourceService.syncCanvasFiles();
      toast.success("Resources grabbed from Canvas successfully!");
    } catch (err) {
      toast.error("Resource Sync Failed");
    } finally {
      setSyncing(false);
    }
  }, []);

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
      order: Date.now(),
      deployStatus: 'Draft' 
    });
  }, [week]);

  const getHomework = (subject: string, title: string, assignments: string[]) => {
      let homework = assignments.join(', ');
      
      // Math: Special logic for Odds/Evens
      if (subject === 'Math' && title.toLowerCase().includes('lesson')) {
          const lessonNumMatch = title.match(/(\d+)/);
          if (lessonNumMatch) {
              const lessonNum = parseInt(lessonNumMatch[1], 10);
              homework = `Math Homework ${lessonNum} ${lessonNum % 2 !== 0 ? 'Odds' : 'Evens'}`;
          }
      }
      // Reading/Spelling: Add Practice
      else if ((subject === 'Reading' || subject === 'Spelling') && !homework.includes('Practice')) {
          homework = `${homework}, Reading and Spelling Practice`;
      }
      
      return homework;
  };

  const handleAiAutofill = useCallback(async () => {
    try {
      setSyncing(true);
      toast.info("Dispatching Command to Brain Queue...");

      const store = useStore.getState();
      const url = store.pacingGuideUrl;
      const proxyUrl = `/api/proxy/google-sheets?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch Google Sheet");
      const csvText = await response.text();
      const parsedWeeks = pacingImportService.parse(csvText);
      
      // Find the specific week data
      const currentWeekData = parsedWeeks.find(w => w.weekId === week || `Week ${w.weekNumber}` === week);
      
      const payload = currentWeekData ? JSON.stringify({
        course: "Thales Curriculum",
        week: week,
        days: currentWeekData.days.map((d, idx) => ({
          day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][idx] || 'Unknown',
          lessons: [
            { subject: 'Math', lessonTitle: d.mathLesson },
            { subject: 'Reading', lessonTitle: d.readingWeek },
            { subject: 'ELA', lessonTitle: d.elaChapter },
            { subject: 'History/Science', lessonTitle: d.historyScience }
          ]
        }))
      }) : csvText;

      // Collect existing state for diffing
      const existingState = rowsRef.current.map(r => ({
        id: r.id,
        day: r.day,
        lesson: r.lessonTitle,
        homework: r.homework,
        notes: r.notes
      }));

      // Collect historical context (previous week)
      let historicalContext: any = null;
      try {
        const userId = auth.currentUser?.uid;
        if (userId && week) {
          // week format is Qx_Wx
          const parts = week.split('_');
          const q = parseInt(parts[0].substring(1));
          const w = parseInt(parts[1].substring(1));
          
          let prevQ = q;
          let prevW = w - 1;
          
          if (prevW === 0) {
            prevQ = q - 1;
            prevW = prevQ === 3 ? 10 : 9; // Q4 has 10 weeks
          }

          if (prevQ > 0) {
            const prevWeekId = `Q${prevQ}_W${prevW}`;
            const prevRows = await plannerService.getWeekRows(userId, prevWeekId);
            historicalContext = prevRows.map(r => ({
              day: r.day,
              subject: r.subject,
              lesson: r.lessonTitle,
              homework: r.homework,
              notes: r.notes
            }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch historical context, proceeding without memory.");
      }

      const jobId = await plannerAIService.startParseTask(payload, existingState, historicalContext);
      setActiveJob(jobId);
    } catch (err) {
      console.error(err);
      toast.error("Command Dispatch Failed");
    } finally {
      setSyncing(false);
    }
  }, [week, setActiveJob]);

  const handlePastePlan = useCallback(async (text: string) => {
    try {
      setSyncing(true);
      toast.info("Dispatching Command to Brain Queue...");

      const parsedWeeks = pacingImportService.parse(text);
      const currentWeekData = parsedWeeks.find(w => w.weekId === week || `Week ${w.weekNumber}` === week);
      
      const payload = currentWeekData ? JSON.stringify({
        course: "Thales Curriculum",
        week: week,
        days: currentWeekData.days.map((d, idx) => ({
          day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][idx] || 'Unknown',
          lessons: [
            { subject: 'Math', lessonTitle: d.mathLesson },
            { subject: 'Reading', lessonTitle: d.readingWeek },
            { subject: 'ELA', lessonTitle: d.elaChapter },
            { subject: 'History/Science', lessonTitle: d.historyScience }
          ]
        }))
      }) : text;

      // Collect existing state for diffing
      const existingState = rowsRef.current.map(r => ({
        id: r.id,
        day: r.day,
        lesson: r.lessonTitle,
        homework: r.homework,
        notes: r.notes
      }));

      // Collect historical context (previous week)
      let historicalContext: any = null;
      try {
        const userId = auth.currentUser?.uid;
        if (userId && week) {
          const parts = week.split('_');
          const q = parseInt(parts[0].substring(1));
          const w = parseInt(parts[1].substring(1));
          
          let prevQ = q;
          let prevW = w - 1;
          
          if (prevW === 0) {
            prevQ = q - 1;
            prevW = prevQ === 3 ? 10 : 9;
          }

          if (prevQ > 0) {
            const prevWeekId = `Q${prevQ}_W${prevW}`;
            const prevRows = await plannerService.getWeekRows(userId, prevWeekId);
            historicalContext = prevRows.map(r => ({
              day: r.day,
              subject: r.subject,
              lesson: r.lessonTitle,
              homework: r.homework,
              notes: r.notes
            }));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch historical context, proceeding without memory.");
      }

      const jobId = await plannerAIService.startParseTask(payload, existingState, historicalContext); 
      setActiveJob(jobId);
    } catch (err) {
      console.error(err);
      toast.error("Command Dispatch Failed");
    } finally {
      setSyncing(false);
    }
  }, [week, setActiveJob]);

  const handleRegenerateDay = useCallback(async (day: string) => {
    try {
      setSyncing(true);
      toast.info(`Regenerating ${day} locally...`);

      const store = useStore.getState();
      const url = store.pacingGuideUrl;
      const proxyUrl = `/api/proxy/google-sheets?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch Google Sheet");
      const csvText = await response.text();
      
      // Existing state for this day
      const existingState = rowsRef.current.map(r => ({
        id: r.id,
        day: r.day,
        lesson: r.lessonTitle,
        homework: r.homework,
        notes: r.notes
      }));

      const jobId = await plannerAIService.startParseTask(csvText, existingState, null, [day]);
      setActiveJob(jobId);
    } catch (err) {
      console.error(err);
      toast.error("Regeneration Failed");
    } finally {
      setSyncing(false);
    }
  }, [setActiveJob]);

  return (
    <div className="flex flex-col h-full space-y-6">
      {pendingPlan && (
        <CommandReviewModal 
          plan={pendingPlan}
          existingRows={rows}
          onConfirm={handleCommitPlan}
          onCancel={() => {
            setPendingPlan(null);
            setActiveJob(null);
          }}
        />
      )}
      <PlannerHeader 
        week={week}
        setWeek={setWeek}
        syncing={syncing}
        onSyncSheet={handleSyncSheet}
        onSyncResources={handleSyncResources}
        onAiAutofill={handleAiAutofill}
        onPastePlan={handlePastePlan}
      />

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Syncing with Thales OS Cloud...</p>
        </div>
      ) : rows.length === 0 ? (
        <PlannerEmptyState onCreateShell={async () => {
          try {
            await plannerService.generateWeekShell(week);
            toast.success(`Generated planner shell for ${week}`);
          } catch (error) {
            toast.error('Failed to generate shell');
          }
        }} />
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
                onRegenerate={() => handleRegenerateDay(day)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="bg-[#0a0a0c]" />
        </ScrollArea>
      )}
    </div>
  );
}
