import React, { useMemo } from 'react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from 'lucide-react';
import { PlannerCard } from './PlannerCard';
import { PlannerRow, plannerService } from '../../services/service.planner';

interface PlannerColumnProps {
  day: string;
  rows: PlannerRow[];
  dateLabel?: string;
  onUpdate: (id: string, updates: Partial<PlannerRow>) => Promise<void>;
  onAddBlock: () => void;
  onRegenerate?: () => void;
}

export const PlannerColumn: React.FC<PlannerColumnProps> = React.memo(({
  day,
  rows,
  dateLabel,
  onUpdate,
  onAddBlock,
  onRegenerate,
}) => {

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
        const oldIndex = rows.findIndex((r) => r.id === active.id);
        const newIndex = rows.findIndex((r) => r.id === over?.id);
        
        const newRows = arrayMove(rows, oldIndex, newIndex) as PlannerRow[];
        
        // Update Firestore with new orders
        for(let i=0; i<newRows.length; i++) {
            if (newRows[i].id) {
                await onUpdate(newRows[i].id!, { order: i });
            }
        }
    }
  };

  return (
    <div className="w-[320px] flex flex-col gap-3 shrink-0">
      <div className="sticky top-0 z-10 bg-[#0a0a0c]/80 backdrop-blur p-3 rounded-lg border border-white/10 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-100">{day}</h3>
          <span className="text-[10px] text-slate-500 font-mono mt-0.5">
            {dateLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {day === 'Friday' && <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10 text-[10px] uppercase">Auto-Test Day</Badge>}
          {onRegenerate && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 rounded-full"
              onClick={onRegenerate}
              title={`Regenerate ${day}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map(r => r.id!)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3 pb-8">
            {rows.map((row) => (
              <PlannerCard 
                key={row.id}
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
        </SortableContext>
      </DndContext>
    </div>
  );
});
