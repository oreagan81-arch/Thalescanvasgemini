import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from 'lucide-react';
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface StatusSectionProps {
  orphans: number;
  plannerRowCount: number;
  selectedWeek: string;
  loading: boolean;
}

export const StatusSection: React.FC<StatusSectionProps> = React.memo(({
  orphans,
  plannerRowCount,
  selectedWeek,
  loading
}) => {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="rounded-2xl border border-white/10 bg-[#121216] col-span-1">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2 text-sm uppercase tracking-widest">
            <Activity className="w-4 h-4 text-amber-500" />
            Intelligence Health
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">System integrators and rule engine status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center bg-white/5 p-3 rounded-md border border-white/10">
            <span className="text-sm text-slate-300">Determinism Engine</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-none hover:bg-emerald-500/20 uppercase text-[9px] font-bold">Online</Badge>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3 rounded-md border border-white/10">
            <span className="text-sm text-slate-300">Canvas Linker</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-none hover:bg-emerald-500/20 uppercase text-[9px] font-bold">Synced</Badge>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3 rounded-md border border-white/10">
            <span className="text-sm text-slate-300">Gemini 3.1 Pro</span>
            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-none hover:bg-amber-500/20 uppercase text-[9px] font-bold">Connected</Badge>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3 rounded-md border border-white/10">
            <span className="text-sm text-slate-300">Thales Protocol (CI)</span>
            <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-none hover:bg-blue-500/20 uppercase text-[9px] font-bold">Automated</Badge>
          </div>
          <div className="flex justify-between items-center bg-white/5 p-3 rounded-md border border-white/10">
            <span className="text-sm text-slate-300">GitHub Actions</span>
            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-none hover:bg-indigo-500/20 uppercase text-[9px] font-bold">Verified</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-amber-500/30 bg-[#121216] col-span-1 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <div className="text-9xl font-bold">!</div>
        </div>
        <CardHeader>
          <CardTitle className="text-amber-500 text-sm uppercase tracking-widest">System Alerts</CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">Integrity monitoring and action cues</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 relative z-10">
          {orphans > 0 && (
            <div className="flex justify-between items-center bg-[#0a0a0c] p-3 rounded-md border border-amber-500/20">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-amber-500">Unmapped Resources</span>
                <span className="text-xs text-slate-500 mt-1">{orphans} files detected in Canvas but not mapped to Planner.</span>
              </div>
              <Link to="/resources" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-amber-500/20 text-amber-500 hover:bg-amber-500/10 text-[10px] uppercase font-bold")}>Map Now</Link>
            </div>
          )}
          
          {plannerRowCount === 0 && !loading && (
            <div className="flex justify-between items-center bg-[#0a0a0c] p-3 rounded-md border border-white/10">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-300">Initialize {selectedWeek}</span>
                <span className="text-xs text-slate-500 mt-1">Planner structure is required before AI drafting.</span>
              </div>
              <Link to="/planner" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-white/10 bg-transparent text-slate-300 hover:bg-white/5 text-[10px] uppercase font-bold")}>Setup</Link>
            </div>
          )}

          <div className="p-3 bg-white/[0.02] rounded-md border border-white/5 text-center">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-loose">
              System operational. All background heartbeat signals functional.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
