import React from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  RefreshCw,
  ArrowRight,
  Save,
  X
} from 'lucide-react';
import { AIPlannerResult, AIPlanDay } from '../../services/plannerAIService';
import { PlannerRow } from '../../services/service.planner';
import { cn } from '@/lib/utils';

interface CommandReviewModalProps {
  plan: AIPlannerResult;
  existingRows: PlannerRow[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CommandReviewModal({ plan, existingRows, onConfirm, onCancel }: CommandReviewModalProps) {
  const preservedIds = new Set(plan.days.map(d => d.id).filter(Boolean));
  const toDelete = existingRows.filter(r => !preservedIds.has(r.id));
  const toUpdate = plan.days.filter(d => d.id);
  const toAdd = plan.days.filter(d => !d.id);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-4xl max-h-[80vh] bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <RefreshCw className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Review Neural Synthesis</h2>
              <p className="text-xs text-slate-500">The Command Brain suggests the following curriculum adjustments.</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                <Plus className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">New Lessons</span>
              </div>
              <span className="text-2xl font-bold text-white">{toAdd.length}</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <ArrowRight className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Adjustments</span>
              </div>
              <span className="text-2xl font-bold text-white">{toUpdate.length}</span>
            </div>
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <Trash2 className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Marked for Deletion</span>
              </div>
              <span className="text-2xl font-bold text-white">{toDelete.length}</span>
            </div>
          </div>

          {/* Change Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pacing Proposal: {plan.course} - {plan.week}</h3>
            
            <div className="space-y-3">
              {plan.days.map((dayPlan, idx) => (
                <div key={idx} className="group relative overflow-hidden bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className={cn(
                        "inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter mb-2",
                        dayPlan.id ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"
                      )}>
                        {dayPlan.id ? 'Proposed Edit' : 'New Integration'}
                      </div>
                      <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        {dayPlan.day} 
                        <span className="text-slate-500 text-xs">—</span>
                        <span className="text-slate-300">{dayPlan.lesson || 'Independent Study'}</span>
                      </h4>
                      {dayPlan.homework && (
                        <p className="text-[11px] text-slate-500 bg-white/5 p-2 rounded italic">
                          HW: {dayPlan.homework}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {toDelete.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <h4 className="text-[10px] font-bold text-red-500/50 uppercase tracking-widest">Resources Marked for Archival</h4>
                  {toDelete.map((row, idx) => (
                    <div key={idx} className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex items-center justify-between opacity-60">
                       <span className="text-xs text-red-200/50 font-mono tracking-tight">{row.day}: {row.lessonTitle}</span>
                       <Trash2 className="w-3 h-3 text-red-500/50" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
           <button 
             onClick={onCancel}
             className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
           >
             Discard Synthesis
           </button>
           <button 
             onClick={onConfirm}
             className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
           >
             <Save className="w-4 h-4" />
             Commit to Planner
           </button>
        </div>
      </motion.div>
    </div>
  );
}
