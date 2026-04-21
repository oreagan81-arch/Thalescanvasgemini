import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, Clock, CalendarDays, ExternalLink, Activity } from 'lucide-react'
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

export function Dashboard() {
  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white px-2">Overview</h1>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300">
            Run Validator
          </Button>
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
            <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Current Week</CardTitle>
            <CalendarDays className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-light text-white">Week 24</div>
            <p className="mt-2 text-[10px] text-emerald-500 font-medium">+2 Days Ahead</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-5 pt-5">
            <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Canvas Modules</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-light text-white">08 / 12</div>
            <p className="mt-2 text-[10px] text-slate-400 font-medium">Sync 12m ago</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-5 pt-5">
            <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Resource Health</CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-light text-white">94%</div>
            <p className="mt-2 text-[10px] text-amber-400 font-medium">2 Missing Files</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-5 pt-5">
            <CardTitle className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">AI Memory</CardTitle>
            <Clock className="w-4 h-4 text-slate-500" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-3xl font-light text-white">428</div>
            <p className="mt-2 text-[10px] text-slate-400 font-medium">Patterns Cached</p>
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
               <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-none hover:bg-emerald-500/20">Online</Badge>
             </div>
             <div className="flex justify-between items-center bg-white/5 p-3 rounded-md border border-white/10">
               <span className="text-sm text-slate-300">Canvas Linker</span>
               <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-none hover:bg-emerald-500/20">Synced</Badge>
             </div>
             <div className="flex justify-between items-center bg-white/5 p-3 rounded-md border border-white/10">
               <span className="text-sm text-slate-300">Gemini 2.5 Flash</span>
               <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-none hover:bg-amber-500/20">Connected</Badge>
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-amber-500/30 bg-[#121216] col-span-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
             <div className="text-9xl font-bold">!</div>
          </div>
          <CardHeader>
            <CardTitle className="text-amber-500 text-sm uppercase tracking-widest">Pending Actions</CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">Tasks requiring your approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
             <div className="flex justify-between items-center bg-[#0a0a0c] p-3 rounded-md border border-white/10">
               <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-300">Review Announcements</span>
                  <span className="text-xs text-slate-500 mt-1">Generated by AI, awaits approval.</span>
               </div>
               <Button size="sm" variant="outline" className="border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white">Review</Button>
             </div>
             <div className="flex justify-between items-center bg-[#0a0a0c] p-3 rounded-md border border-white/10">
               <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-300">Deploy Week 24</span>
                  <span className="text-xs text-slate-500 mt-1">Pages & Assignments ready.</span>
               </div>
               <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 font-bold border-0">Deploy</Button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
