import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Edit3, 
  FileText, 
  Layers, 
  AlertTriangle,
  Calendar,
  Sparkles,
  Zap,
  ArrowRight,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { WeeklyPlan, DayPlan } from '@/src/services/service.plannerAI';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface PlannerCopilotProps {
  initialData: WeeklyPlan;
  onApprove: (data: WeeklyPlan) => void;
  onCancel: () => void;
  isSyncing?: boolean;
}

type EditTarget = {
  day: keyof WeeklyPlan['weekDays'];
  type: 'lessons' | 'assignments' | 'resources';
  index: number;
};

export function PlannerCopilot({ initialData, onApprove, onCancel, isSyncing = false }: PlannerCopilotProps) {
  const [data, setData] = useState<WeeklyPlan>(initialData);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState('');

  const days: (keyof WeeklyPlan['weekDays'])[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  const openEdit = (day: keyof WeeklyPlan['weekDays'], type: 'lessons' | 'assignments' | 'resources', index: number) => {
    setEditTarget({ day, type, index });
    setEditValue(data.weekDays[day][type][index]);
  };

  const saveEdit = () => {
    if (!editTarget) return;

    const newData = { ...data };
    newData.weekDays[editTarget.day][editTarget.type][editTarget.index] = editValue;
    setData(newData);
    setEditTarget(null);
  };

  const deleteItem = (day: keyof WeeklyPlan['weekDays'], type: 'lessons' | 'assignments' | 'resources', index: number) => {
    const newData = { ...data };
    newData.weekDays[day][type] = newData.weekDays[day][type].filter((_, i) => i !== index);
    setData(newData);
  };

  const addItem = (day: keyof WeeklyPlan['weekDays'], type: 'lessons' | 'assignments' | 'resources') => {
    const newData = { ...data };
    newData.weekDays[day][type] = [...newData.weekDays[day][type], "New Item"];
    setData(newData);
    // Automatically open edit for the new item
    openEdit(day, type, newData.weekDays[day][type].length - 1);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-slate-100 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      {/* Header / Auditor Panel */}
      <div className="shrink-0 p-6 border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                Weekly Planner <span className="text-amber-500">Copilot</span>
              </h1>
            </div>
            <p className="text-sm text-slate-400">AI-Augmented curriculum auditor enabled. Review and finalize your week.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onCancel} className="text-slate-400 hover:text-white hover:bg-white/5 border border-white/5">
              Cancel
            </Button>
            <Button 
              onClick={() => onApprove(data)} 
              disabled={isSyncing}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold border-none shadow-lg shadow-amber-500/20 px-8"
            >
              {isSyncing ? (
                <>
                  <Zap className="w-4 h-4 mr-2 animate-pulse" />
                  Syncing to Canvas...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve & Sync
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Auditor Warnings */}
        <div className="mt-6 space-y-3">
          {data.aiAuditorWarnings.length > 0 ? (
            <AnimatePresence>
              {data.aiAuditorWarnings.map((warning, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/20 text-amber-500 py-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-bold uppercase tracking-widest mb-0.5">Critical Insight</AlertTitle>
                    <AlertDescription className="text-sm opacity-90">{warning}</AlertDescription>
                  </Alert>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 py-3">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold uppercase tracking-widest mb-0.5">Curriculum Verified</AlertTitle>
              <AlertDescription className="text-sm opacity-90">All core Thales Academy pacing requirements detected for this week.</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Main Grid Section */}
      <ScrollArea className="flex-1 w-full bg-[#09090b]">
        <div className="flex p-6 gap-6 min-w-max pb-12">
          {days.map((day) => (
            <div key={day} className="w-[320px] flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">{day}</h3>
                </div>
                <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] text-slate-500 px-2 py-0">
                  {data.weekDays[day].lessons.length} LESSONS
                </Badge>
              </div>

              {/* Sections: Lessons, Assignments, Resources */}
              <div className="space-y-6">
                {/* Lessons Section */}
                <Section 
                  title="Lessons" 
                  icon={<Clock className="w-3.5 h-3.5 text-blue-400" />} 
                  items={data.weekDays[day].lessons} 
                  onEdit={(idx) => openEdit(day, 'lessons', idx)}
                  onDelete={(idx) => deleteItem(day, 'lessons', idx)}
                  onAdd={() => addItem(day, 'lessons')}
                  color="blue"
                />

                {/* Assignments Section */}
                <Section 
                  title="Homework & Tests" 
                  icon={<Edit3 className="w-3.5 h-3.5 text-amber-400" />} 
                  items={data.weekDays[day].assignments} 
                  onEdit={(idx) => openEdit(day, 'assignments', idx)}
                  onDelete={(idx) => deleteItem(day, 'assignments', idx)}
                  onAdd={() => addItem(day, 'assignments')}
                  color="amber"
                />

                {/* Resources Section */}
                <Section 
                  title="Resources" 
                  icon={<Layers className="w-3.5 h-3.5 text-emerald-400" />} 
                  items={data.weekDays[day].resources} 
                  onEdit={(idx) => openEdit(day, 'resources', idx)}
                  onDelete={(idx) => deleteItem(day, 'resources', idx)}
                  onAdd={() => addItem(day, 'resources')}
                  color="emerald"
                />
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="bg-white/5" />
      </ScrollArea>

      {/* Approve Floating Action Bar (Responsive Mobile View would use this) */}
      <div className="md:hidden p-4 border-t border-white/10 bg-[#0c0c0e] flex justify-end">
        <Button 
          onClick={() => onApprove(data)} 
          disabled={isSyncing}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-12"
        >
          {isSyncing ? "Syncing..." : "Finalize & Sync"}
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="bg-[#121216] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-white capitalize">
              Edit {editTarget?.type.slice(0, -1)}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content" className="text-xs font-bold uppercase tracking-widest text-slate-500">Content / Instruction</Label>
              <Input
                id="content"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                className="bg-white/5 border-white/10 focus:border-amber-500/50 text-white h-12"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-white">
              Discard
            </Button>
            <Button onClick={saveEdit} className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8">
              Update Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  items: string[];
  onEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
  onAdd: () => void;
  color: 'blue' | 'amber' | 'emerald';
}

function Section({ title, icon, items, onEdit, onDelete, onAdd, color }: SectionProps) {
  const colorMap = {
    blue: "text-blue-400 bg-blue-400/10 border-blue-400/20 hover:border-blue-400/40",
    amber: "text-amber-400 bg-amber-400/10 border-amber-400/20 hover:border-amber-400/40",
    emerald: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 hover:border-emerald-400/40",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between group">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
        </div>
        <button 
          onClick={onAdd}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/5 rounded text-slate-500 hover:text-amber-500"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        {items.length > 0 ? (
          items.map((item, idx) => (
            <motion.div
              layout
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "group relative flex flex-col p-4 rounded-xl border bg-white/[0.02] transition-all cursor-pointer",
                colorMap[color]
              )}
              onClick={() => onEdit(idx)}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-200 leading-snug">{item}</p>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(idx); }}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Logic Check Badges */}
              <div className="mt-2 flex items-center gap-2">
                {item.includes("[MATH TEST") && (
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[9px] h-4 font-bold uppercase py-0 leading-none">
                    Verified Curriculum
                  </Badge>
                )}
                {item.toLowerCase().includes("study guide") && (
                  <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-[9px] h-4 font-bold uppercase py-0 leading-none">
                    Revision Resource
                  </Badge>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-8 border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center gap-2 opacity-50">
            <span className="text-[10px] uppercase font-bold text-slate-600 tracking-widest">No Content</span>
            <Button variant="ghost" size="sm" onClick={onAdd} className="h-7 text-[10px] text-amber-500 hover:text-amber-400">
              Add Block
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
