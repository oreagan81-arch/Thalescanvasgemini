import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, AlertCircle, TrendingUp, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { useThalesStore } from '../../store';
import { plannerService, PlannerRow } from '../../services/service.planner';
import { useAuth } from '../../contexts/AuthContext';

export const UpcomingTests: React.FC = React.memo(() => {
  const { user } = useAuth();
  const selectedWeek = useThalesStore((state) => state.selectedWeek);
  const [tests, setTests] = useState<PlannerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = plannerService.subscribeToWeek(user.uid, selectedWeek, (rows) => {
      // Filter for items that are not just standard lessons
      const evaluationItems = rows.filter(row => 
        row.lessonTitle && (
          row.type === 'Test' || 
          row.type === 'Quiz' || 
          row.type === 'Project' ||
          row.lessonTitle.toLowerCase().includes('test') ||
          row.lessonTitle.toLowerCase().includes('quiz')
        )
      );
      setTests(evaluationItems);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedWeek]);

  return (
    <Card className="rounded-2xl border border-white/10 bg-[#121216] h-full overflow-hidden">
      <CardHeader className="border-b border-white/5 px-6 py-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 flex items-center gap-2 text-sm uppercase tracking-widest">
            <CalendarDays className="w-4 h-4 text-emerald-500" />
            Evaluation Pipeline
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-slate-500" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-[10px] text-slate-500 uppercase font-black animate-pulse">Scanning Planner...</p>
          </div>
        ) : tests.length > 0 ? (
          <div className="divide-y divide-white/5">
            {tests.map((test) => (
              <div key={test.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-tighter">{test.subject}</span>
                    <span className="text-white text-sm font-medium">{test.lessonTitle}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">{test.day}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={test.deployStatus === 'Ready' || test.deployStatus === 'Deployed'
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] font-bold uppercase tracking-wider"
                  }
                >
                  {test.deployStatus}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CalendarDays className="w-12 h-12 text-slate-800 mb-4" />
            <p className="text-slate-300 font-bold mb-1">No Tests Scheduled</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Your pipeline is clear for {selectedWeek}</p>
          </div>
        )}
        
        {tests.length > 0 && (
          <div className="p-6 bg-white/[0.01] border-t border-white/5">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
               </div>
               <div>
                  <p className="text-[11px] font-bold text-white uppercase tracking-tight">Pacing Health: Optimal</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Evaluations aligned with curriculum</p>
               </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
