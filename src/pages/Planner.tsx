import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { 
  FileDown, 
  Wand2, 
  Plus, 
  FileSearch, 
  Loader2, 
  CalendarRange, 
  CloudDownload, 
  Snowflake, 
  Eraser,
  RefreshCw
} from 'lucide-react'
import { plannerService, PlannerRow } from '../services/plannerService'
import { calendarService } from '../services/calendarService'
import { assignmentService } from '../services/assignmentService'
import { toast } from 'sonner'
import { PlannerCard } from '../components/planner/PlannerCard'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function Planner() {
  const currentContext = calendarService.getAcademicContext();
  const [week, setWeek] = useState(calendarService.getWeekId(currentContext));
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Derive dates for the current view
  const qStr = week.split('_')[0].substring(1);
  const wStr = week.split('_')[1].substring(1);
  const weekDates = calendarService.getDatesForContext(parseInt(qStr), parseInt(wStr));

  useEffect(() => {
    setLoading(true);
    const unsubscribe = plannerService.subscribeToWeek(week, (fetchedRows) => {
      setRows(fetchedRows);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [week]);

  const handleCreateShell = async () => {
    try {
      setLoading(true);
      await plannerService.generateWeekShell(week);
      toast.success(`Generated planner shell for ${week}`);
    } catch (error) {
      toast.error('Failed to generate shell');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncSheet = async () => {
    try {
      setSyncing(true);
      const res = await plannerService.syncFromGoogleSheet(week);
      toast.success(res.message);
    } catch (err) {
      toast.error("Google Sheet Sync Failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSnowDay = async () => {
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
  };

  const handleCleanData = async () => {
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
  };

  const handleUpdate = async (id: string, updates: Partial<PlannerRow>) => {
    try {
      await plannerService.updateRow(id, updates);
    } catch (err) {
      toast.error('Failed to save change');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Weekly Planner</h1>
          <p className="text-slate-400">Design and validate weekly lesson flows.</p>
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
          
          <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300">
            <CalendarRange className="w-4 h-4 mr-2" />
            Dates
          </Button>
          
          {rows.length === 0 && !loading && (
            <Button onClick={handleCreateShell} variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
              <Plus className="w-4 h-4 mr-2" />
              Initialize Week
            </Button>
          )}

          <Button onClick={handleSyncSheet} disabled={syncing} variant="outline" className="border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10">
            {syncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CloudDownload className="w-4 h-4 mr-2" />}
            Sync Sheet
          </Button>

          <Button onClick={handleSnowDay} variant="outline" className="border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10">
            <Snowflake className="w-4 h-4 mr-2" />
            Snow Day
          </Button>

          <Button onClick={handleCleanData} disabled={syncing} variant="outline" className="border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10">
            <Eraser className="w-4 h-4 mr-2" />
            Clean
          </Button>

          <Button className="bg-amber-500 hover:bg-amber-400 text-black border-0 font-bold">
            <Wand2 className="w-4 h-4 mr-2" />
            AI Auto-Fill
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Syncing with Thales OS Cloud...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-white/10 rounded-2xl bg-white/5 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-slate-700" />
            </div>
            <h3 className="text-white font-bold mb-2">No Planner Data</h3>
            <p className="text-slate-400 text-sm max-w-xs mb-6">This week is clean. Use the initialize button to create a standard Thales lesson shell.</p>
            <Button onClick={handleCreateShell} className="bg-amber-500 text-black hover:bg-amber-400 font-bold">
              Initialize Structure
            </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
          <div className="min-w-max p-6 flex gap-4 h-full">
            {DAYS.map(day => {
              const dayRows = rows.filter(r => r.day === day);
              return (
                <div key={day} className="w-[320px] flex flex-col gap-3 shrink-0">
                  <div className="sticky top-0 z-10 bg-[#0a0a0c]/80 backdrop-blur p-3 rounded-lg border border-white/10 shadow-sm flex items-center justify-between">
                    <div className="flex flex-col">
                       <h3 className="text-xs font-bold uppercase tracking-widest text-slate-100">{day}</h3>
                       <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                         {weekDates.find(d => d.label === day)?.formatted}
                       </span>
                    </div>
                    {day === 'Friday' && <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10 text-[10px] uppercase">Auto-Test Day</Badge>}
                  </div>
                  
                  <div className="flex flex-col gap-3 pb-8">
                    {dayRows.map((row, idx) => (
                      <PlannerCard 
                        key={row.id || `row-${idx}`} 
                        row={row} 
                        onUpdate={handleUpdate} 
                      />
                    ))}
                    
                    <Button 
                      onClick={() => plannerService.addRow({ weekId: week, day, subject: 'New', lessonNum: '', lessonTitle: '', type: 'Lesson', resources: [], homework: '', reminder: '', notes: '', deployStatus: 'Draft' })}
                      variant="outline" 
                      className="w-full border-dashed border-white/10 bg-transparent text-slate-500 hover:text-slate-300 hover:border-white/20 hover:bg-white/5 justify-start h-10 mt-1 uppercase text-xs font-bold tracking-widest"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Block
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="bg-[#0a0a0c]" />
        </ScrollArea>
      )}
    </div>
  );
}
