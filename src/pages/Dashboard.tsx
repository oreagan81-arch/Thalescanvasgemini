import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, Clock, CalendarDays, Activity, Loader2 } from 'lucide-react'
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useDashboardStats } from '../hooks/useDashboardStats';
import { calendarService } from '../services/calendarService';

export function Dashboard() {
  const context = calendarService.getAcademicContext();
  const currentWeek = calendarService.getWeekId(context);
  const { resources, plannerRows, stats, loading } = useDashboardStats(currentWeek);

  const { totalFiles, orphans, healthScore, lessonCount } = stats;

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white px-2 mb-1 underline decoration-amber-500 decoration-4 underline-offset-[12px]">Good morning, Owen.</h1>
          <p className="text-slate-400 px-2 mt-4 text-sm max-w-lg leading-relaxed">
            Welcome to <span className="text-white font-bold tracking-widest uppercase text-xs px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">Thales OS</span>. 
            Generate polished parent communication and sync your curriculum in seconds.
          </p>
        </div>
        <div className="flex gap-4">
          <Link 
            to="/announcements" 
            className={cn(
              buttonVariants({ variant: "outline" }),
              "border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10 font-bold"
            )}
          >
            New Announcement
          </Link>
          <Link 
            to="/planner" 
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-amber-500 hover:bg-amber-400 text-black border-0 font-bold"
            )}
          >
            Open Planner
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Stat Cards */}
        <Card className="rounded-xl border border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-5 pt-5">
            <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Academic Period</CardTitle>
            <CalendarDays className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-light text-white">Q{context.quarter} - W{context.week}</div>
            <p className="mt-2 text-[10px] text-emerald-500 font-medium tracking-wider uppercase">Active Session</p>
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
             
             {plannerRows.length === 0 && !loading && (
               <div className="flex justify-between items-center bg-[#0a0a0c] p-3 rounded-md border border-white/10">
                 <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-300">Initialize {currentWeek}</span>
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
    </div>
  );
}

