import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, Plus, CloudDownload, RefreshCw, Snowflake, Eraser, Wand2 } from 'lucide-react';

interface PlannerHeaderProps {
  week: string;
  setWeek: (week: string) => void;
  rowsCount: number;
  loading: boolean;
  syncing: boolean;
  onCreateShell: () => void;
  onSyncSheet: () => void;
  onSnowDay: () => void;
  onCleanData: () => void;
}

export const PlannerHeader: React.FC<PlannerHeaderProps> = React.memo(({
  week,
  setWeek,
  rowsCount,
  loading,
  syncing,
  onCreateShell,
  onSyncSheet,
  onSnowDay,
  onCleanData
}) => {
  return (
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
        
        {rowsCount === 0 && !loading && (
          <Button onClick={onCreateShell} variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
            <Plus className="w-4 h-4 mr-2" />
            Initialize Week
          </Button>
        )}

        <Button onClick={onSyncSheet} disabled={syncing} variant="outline" className="border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10">
          {syncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CloudDownload className="w-4 h-4 mr-2" />}
          Sync Sheet
        </Button>

        <Button onClick={onSnowDay} variant="outline" className="border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10">
          <Snowflake className="w-4 h-4 mr-2" />
          Snow Day
        </Button>

        <Button onClick={onCleanData} disabled={syncing} variant="outline" className="border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10">
          <Eraser className="w-4 h-4 mr-2" />
          Clean
        </Button>

        <Button className="bg-amber-500 hover:bg-amber-400 text-black border-0 font-bold">
          <Wand2 className="w-4 h-4 mr-2" />
          AI Auto-Fill
        </Button>
      </div>
    </div>
  );
});
