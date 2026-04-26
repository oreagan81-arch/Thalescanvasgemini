import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';
import { PlannerCard } from './PlannerCard';
import { PlannerRow } from '../../services/service.planner';

interface PlannerColumnProps {
  day: string;
  rows: PlannerRow[];
  dateLabel?: string;
  onUpdate: (id: string, updates: Partial<PlannerRow>) => Promise<void>;
  onAddBlock: () => void;
}

export const PlannerColumn: React.FC<PlannerColumnProps> = React.memo(({
  day,
  rows,
  dateLabel,
  onUpdate,
  onAddBlock
}) => {
  return (
    <div className="w-[320px] flex flex-col gap-3 shrink-0">
      <div className="sticky top-0 z-10 bg-[#0a0a0c]/80 backdrop-blur p-3 rounded-lg border border-white/10 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-100">{day}</h3>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5">
            {dateLabel}
          </span>
        </div>
        {day === 'Friday' && <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10 text-[10px] uppercase">Auto-Test Day</Badge>}
      </div>
      
      <div className="flex flex-col gap-3 pb-8">
        {rows.map((row, idx) => (
          <PlannerCard 
            key={row.id || `row-${idx}`} 
            row={row} 
            onUpdate={onUpdate} 
          />
        ))}
        
        <Button 
          onClick={onAddBlock}
          variant="outline" 
          className="w-full border-dashed border-white/10 bg-transparent text-slate-500 hover:text-slate-300 hover:border-white/20 hover:bg-white/5 justify-start h-10 mt-1 uppercase text-xs font-bold tracking-widest"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Block
        </Button>
      </div>
    </div>
  );
});
