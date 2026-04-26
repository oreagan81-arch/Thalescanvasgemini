import React from 'react';
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface DashboardHeaderProps {
  name: string;
  greeting?: string;
  currentDate?: string;
  schoolWeek?: number | null;
  schoolStatus?: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = React.memo(({ name, greeting = 'Welcome', currentDate, schoolWeek, schoolStatus }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white px-2 mb-1 underline decoration-amber-500 decoration-4 underline-offset-[12px]">
          {greeting}, {name}.
        </h1>
        <p className="text-slate-400 px-2 mt-4 text-sm max-w-lg leading-relaxed">
          {currentDate ? `Today is ${currentDate}. ` : ''}
          {schoolWeek != null && schoolStatus === "In Session" && (
            <span className="text-emerald-400 font-semibold">We are currently in <span className="text-white border-b border-emerald-500/50">Week {schoolWeek}</span>. </span>
          )}
          {schoolWeek != null && schoolStatus !== "In Session" && (
            <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              <span className="mr-1">⏸️</span> Pacing Paused: {schoolStatus}
            </span>
          )}
          {!schoolWeek && (
            <span className="text-slate-500 italic">Pacing engine inactive.</span>
          )}
          <br />
          Welcome back to <span className="text-white font-bold tracking-widest uppercase text-xs px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">Thales OS</span>. 
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
  );
});
