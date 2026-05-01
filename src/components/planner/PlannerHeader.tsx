import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CloudDownload, Wand2 } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { PastePlanDialog } from './PastePlanDialog';

interface PlannerHeaderProps {
  week: string;
  setWeek: (week: string) => void;
  syncing: boolean;
  onSyncSheet: () => void;
  onSyncResources: () => void;
  onAiAutofill: () => void;
  onPastePlan: (text: string) => void;
}

export const PlannerHeader: React.FC<PlannerHeaderProps> = React.memo(({
  week,
  setWeek,
  syncing,
  onSyncSheet,
  onSyncResources,
  onAiAutofill,
  onPastePlan,
}) => {
  return (
    <div className="flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Weekly Planner</h1>
        <p className="text-slate-400">Design and validate weekly lesson flows.</p>
      </div>
      
      <div className="flex items-center gap-3">
        <ThemeToggle />
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
        
        <PastePlanDialog onPaste={onPastePlan} />

        <Button onClick={onSyncSheet} disabled={syncing} variant="outline" className="border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10">
          {syncing ? <CloudDownload className="w-4 h-4 mr-2 animate-spin" /> : <CloudDownload className="w-4 h-4 mr-2" />}
          Sync Google Sheet
        </Button>

        <Button onClick={onSyncResources} disabled={syncing} variant="outline" className="border-teal-500/30 bg-teal-500/5 text-teal-400 hover:bg-teal-500/10">
          <CloudDownload className="w-4 h-4 mr-2" />
          Grab Resources
        </Button>

        <Button onClick={onAiAutofill} className="bg-amber-500 hover:bg-amber-400 text-black border-0 font-bold">
          <Wand2 className="w-4 h-4 mr-2" />
          ✨ Auto-Fill Week
        </Button>
      </div>
    </div>
  );
});
