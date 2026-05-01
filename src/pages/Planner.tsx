import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../store';
import { plannerService, PlannerRow } from '../services/service.planner';
import { processPacingGuide } from '../services/service.plannerAI'; 
import { calendarService } from '../services/service.calendar';
import { useAuth } from '../contexts/AuthContext';

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
    plannerData
  } = useStore();
  
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const rowsRef = useRef<PlannerRow[]>([]);
  const autoFillTriggeredRef = useRef<Record<string, boolean>>({});

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
      toast.info("AI preparing your weekly plan...");

      const { useStore } = await import('../store');
      const store = useStore.getState();
      const url = store.pacingGuideUrl;
      const proxyUrl = `/api/proxy/google-sheets?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch Google Sheet");
      const rawText = await response.text();

      const plan = await processPacingGuide(rawText);
      
      if (!plan || !plan.weekDays) {
         toast.error("Failed to generate plan structure");
         return;
      }
      
      // Cleanup existing rows using current rows ref
      for (const row of rowsRef.current) {
        await plannerService.deleteRow(row.id!);
      }

      // Populate new rows
      const DAY_MAP = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday' };
      
      for (const [dayKey, dayPlan] of Object.entries(plan.weekDays)) {
        const day = DAY_MAP[dayKey as keyof typeof DAY_MAP];
        
        if (dayPlan.lessons.length === 0) {
            // Create at least one empty row per day if no lessons
            await plannerService.addRow({
                weekId: week, day, subject: '', lessonNum: '', lessonTitle: '', type: 'Lesson', resources: [], homework: '', reminder: '', notes: '', deployStatus: 'Draft', order: Date.now()
            });
            continue;
        }

        for (const lesson of dayPlan.lessons) {
             const parts = lesson.split(' ');
             const subject = parts.length > 1 ? parts[0] : 'Lesson';
             const title = parts.length > 1 ? parts.slice(1).join(' ') : lesson;

             await plannerService.addRow({
                weekId: week,
                day,
                subject,
                lessonNum: '',
                lessonTitle: title,
                type: 'Lesson',
                resources: dayPlan.resources,
                homework: getHomework(subject, title, dayPlan.assignments),
                reminder: '',
                notes: '',
                deployStatus: 'Draft',
                order: Date.now()
             });
        }
      }
      
      toast.success("AI Plan Generated! You can now make changes.");
    } catch (err) {
      console.error(err);
      toast.error("AI Autofill Failed");
    } finally {
      setSyncing(false);
    }
  }, [week]);

  const handlePastePlan = useCallback(async (text: string) => {
    try {
      setSyncing(true);
      toast.info("Processing pasted plan...");

      const plan = await processPacingGuide(text); 
      
      if (!plan || !plan.weekDays) {
         toast.error("Failed to generate plan structure");
         return;
      }
      
      // Cleanup existing rows using current rows ref
      for (const row of rowsRef.current) {
        await plannerService.deleteRow(row.id!);
      }

      // Populate new rows
      const DAY_MAP = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday' };
      
      for (const [dayKey, dayPlan] of Object.entries(plan.weekDays)) {
        const day = DAY_MAP[dayKey as keyof typeof DAY_MAP];
        
        if (dayPlan.lessons.length === 0) {
            // Create at least one empty row per day if no lessons
            await plannerService.addRow({
                weekId: week, day, subject: '', lessonNum: '', lessonTitle: '', type: 'Lesson', resources: [], homework: '', reminder: '', notes: '', deployStatus: 'Draft', order: Date.now()
            });
            continue;
        }

        for (const lesson of dayPlan.lessons) {
             const parts = lesson.split(' ');
             const subject = parts.length > 1 ? parts[0] : 'Lesson';
             const title = parts.length > 1 ? parts.slice(1).join(' ') : lesson;

             await plannerService.addRow({
                weekId: week,
                day,
                subject,
                lessonNum: '',
                lessonTitle: title,
                type: 'Lesson',
                resources: dayPlan.resources,
                homework: dayPlan.assignments.join(', '),
                reminder: '',
                notes: '',
                deployStatus: 'Draft',
                order: Date.now()
             });
        }
      }
      
      toast.success("Plan Imported! You can now make changes.");
    } catch (err) {
      console.error(err);
      toast.error("Paste Plan Failed");
    } finally {
      setSyncing(false);
    }
  }, [week]);

  return (
    <div className="flex flex-col h-full space-y-6">
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
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="bg-[#0a0a0c]" />
        </ScrollArea>
      )}
    </div>
  );
}
