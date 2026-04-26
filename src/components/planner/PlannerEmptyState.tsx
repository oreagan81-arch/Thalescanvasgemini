import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';

interface PlannerEmptyStateProps {
  onCreateShell: () => void;
}

export const PlannerEmptyState: React.FC<PlannerEmptyStateProps> = React.memo(({ onCreateShell }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-white/10 rounded-2xl bg-white/5 text-center">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
          <Plus className="w-8 h-8 text-slate-700" />
        </div>
        <h3 className="text-white font-bold mb-2">No Planner Data</h3>
        <p className="text-slate-400 text-sm max-w-xs mb-6">This week is clean. Use the initialize button to create a standard Thales lesson shell.</p>
        <Button onClick={onCreateShell} className="bg-amber-500 text-black hover:bg-amber-400 font-bold">
          Initialize Structure
        </Button>
    </div>
  );
});
