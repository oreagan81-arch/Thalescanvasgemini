import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, AlertCircle, TrendingUp } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export const UpcomingTests: React.FC = React.memo(() => {
  // Mock data for the overhaul
  const tests = [
    { id: 1, subject: 'Math', title: 'Test 18: Multiplication', day: 'Friday', health: 'Ready' },
    { id: 2, subject: 'Spelling', title: 'Unit 4: Double Vowels', day: 'Thursday', health: 'Pacing Check' },
    { id: 3, subject: 'Reading', title: 'Comprehension: Call of the Wild', day: 'Wednesday', health: 'Ready' }
  ];

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
        <div className="divide-y divide-white/5">
          {tests.map((test) => (
            <div key={test.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-tighter">{test.subject}</span>
                  <span className="text-white text-sm font-medium">{test.title}</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">{test.day}</span>
              </div>
              <Badge 
                variant="outline" 
                className={test.health === 'Ready' 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] font-bold uppercase tracking-wider"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] font-bold uppercase tracking-wider"
                }
              >
                {test.health}
              </Badge>
            </div>
          ))}
        </div>
        
        <div className="p-6 bg-white/[0.01] border-t border-white/5">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-500" />
             </div>
             <div>
                <p className="text-[11px] font-bold text-white uppercase tracking-tight">Pacing Health: 92%</p>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Curriculum Sync Optimal</p>
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
