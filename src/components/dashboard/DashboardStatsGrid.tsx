import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

interface StatsProps {
  selectedWeek: string;
  selectedQuarter: number;
  totalFiles: number;
  orphans: number;
  healthScore: number;
  lessonCount: number;
  schoolWeek?: number | null;
  schoolStatus?: string;
}

export const DashboardStatsGrid: React.FC<StatsProps> = React.memo(({
  selectedWeek,
  selectedQuarter,
  totalFiles,
  orphans,
  healthScore,
  lessonCount,
  schoolWeek,
  schoolStatus
}) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="rounded-xl border border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-5 pt-5">
          <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">
            {schoolWeek != null ? "Pacing Engine" : "Academic Period"}
          </CardTitle>
          <CalendarDays className="w-4 h-4 text-emerald-500" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-3xl font-light text-white">
            {schoolWeek != null ? `Week ${schoolWeek}` : `Q${selectedQuarter} - ${selectedWeek.split('_')[1]}`}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 rounded ${
              schoolWeek != null ? 
                (schoolStatus === "In Session" ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10") 
                : "text-emerald-500 bg-emerald-500/10"
            }`}>
              {schoolWeek != null ? (schoolStatus === "In Session" ? "Mapping Active" : `Break: ${schoolStatus}`) : "Active Session"}
            </p>
            {schoolWeek != null && schoolStatus !== "In Session" && (
              <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-5 pt-5">
          <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Resource Registry</CardTitle>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-3xl font-light text-white">{totalFiles.toString().padStart(2, '0')}</div>
          <p className="mt-2 text-[10px] text-slate-400 font-medium uppercase tracking-wider">Canvas Files Discovered</p>
        </CardContent>
      </Card>

      <Card className={cn(
        "rounded-xl border bg-white/5 transition-colors",
        healthScore < 100 ? "border-amber-500/30" : "border-white/10"
      )}>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-5 pt-5">
          <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Mapping Health</CardTitle>
          <AlertCircle className={cn(
            "w-4 h-4",
            healthScore < 100 ? "text-amber-500" : "text-emerald-500"
          )} />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-3xl font-light text-white">{healthScore}%</div>
          <p className={cn(
            "mt-2 text-[10px] font-medium uppercase tracking-wider",
            orphans > 0 ? "text-amber-400" : "text-slate-400"
          )}>
            {orphans} Orphaned Files
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-5 pt-5">
          <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Planner Density</CardTitle>
          <Clock className="w-4 h-4 text-slate-500" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-3xl font-light text-white">{lessonCount}</div>
          <p className="mt-2 text-[10px] text-slate-400 font-medium uppercase tracking-wider">Lessons Quantified</p>
        </CardContent>
      </Card>
    </div>
  );
});
