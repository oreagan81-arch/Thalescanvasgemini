import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react'
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { plannerService, PlannerRow } from '../services/service.planner'
import { calendarService } from '../services/service.calendar'
import { assignmentService } from '../services/service.assignment'
import { toast } from 'sonner'
import { PlannerHeader } from '../components/planner/PlannerHeader'
import { PlannerEmptyState } from '../components/planner/PlannerEmptyState'
import { PlannerColumn } from '../components/planner/PlannerColumn'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function Planner() {
  const currentContext = calendarService.getAcademicContext();
  const [week, setWeek] = useState(calendarService.getWeekId(currentContext));
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Memoize week dates to avoid recalculation on every render
  const weekDates = useMemo(() => {
    const qStr = week.split('_')[0].substring(1);
    const wStr = week.split('_')[1].substring(1);
    return calendarService.getDatesForContext(parseInt(qStr), parseInt(wStr));
  }, [week]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = plannerService.subscribeToWeek(week, (fetchedRows) => {
      setRows(fetchedRows);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [week]);

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

  const handleSnowDay = useCallback(async () => {
    const today = new Date();
    const dayName = DAYS[today.getDay() - 1] || 'Monday';
    
    const confirm = window.confirm(`Trigger Snow Day protocol for ${dayName}? Lessons will shift forward and "In-Class" will be status cleared.`);
    if (!confirm) return;

    try {
      setLoading(true);
      await plannerService.triggerSnowDay(week, dayName);
      toast.success("Snow Day Protocol Complete: Schedule Shifted");
    } catch (err) {
      toast.error("Protocol Error");
    } finally {
      setLoading(false);
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

  return (
    <div className="flex flex-col h-full space-y-6">
      <PlannerHeader 
        week={week}
        setWeek={setWeek}
        rowsCount={rows.length}
        loading={loading}
        syncing={syncing}
        onCreateShell={handleCreateShell}
        onSyncSheet={handleSyncSheet}
        onSnowDay={handleSnowDay}
        onCleanData={handleCleanData}
      />

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
