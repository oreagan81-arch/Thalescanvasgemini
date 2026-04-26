import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2, FileSearch } from 'lucide-react';
import { PlannerRow } from '../../services/service.planner';

interface PlannerCardProps {
  row: PlannerRow;
  onUpdate: (id: string, updates: Partial<PlannerRow>) => Promise<void>;
}

const SUBJECTS = ['Math', 'Reading', 'Spelling', 'Language Arts', 'Science', 'History'];
const TYPES = ['Lesson', 'Test', 'Quiz', 'Project', 'Review', 'CP'];

export const PlannerCard: React.FC<PlannerCardProps> = React.memo(({ row, onUpdate }) => {
  const [localTitle, setLocalTitle] = useState(row.lessonTitle);
  const [localNum, setLocalNum] = useState(row.lessonNum);

  useEffect(() => {
    setLocalTitle(row.lessonTitle);
    setLocalNum(row.lessonNum);
  }, [row.lessonTitle, row.lessonNum]);

  const handleBlur = (field: 'lessonTitle' | 'lessonNum', value: string) => {
    if (value !== row[field]) {
      onUpdate(row.id!, { [field]: value });
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-all group backdrop-blur relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/5 group-hover:bg-amber-500/50 transition-colors" />
      
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between space-y-0 pl-4">
        <div className="w-full space-y-2">
          {/* Top Row: Subject & Type (Now Editable Selects) */}
          <div className="flex justify-between items-center h-6">
            <Select 
              value={row.subject} 
              onValueChange={(val) => onUpdate(row.id!, { subject: val })}
            >
              <SelectTrigger className="h-6 w-auto bg-white/5 border-white/10 text-[10px] font-bold tracking-wider uppercase px-2 hover:bg-white/10 transition-colors">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent className="bg-[#121216] border-white/10 text-white">
                {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select 
              value={row.type} 
              onValueChange={(val: any) => onUpdate(row.id!, { type: val })}
            >
              <SelectTrigger className="h-6 w-auto bg-transparent border-0 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase px-0 shadow-none focus:ring-0">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-[#121216] border-white/10 text-white">
                {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Lesson Title Input */}
          <input 
            className="w-full bg-transparent border-0 text-sm font-bold text-white leading-tight focus:ring-0 p-0 placeholder:text-slate-700 hover:bg-white/5 rounded px-1 -ml-1 transition-colors"
            value={localTitle}
            placeholder="Untitled Lesson..."
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={() => handleBlur('lessonTitle', localTitle)}
          />

          {/* Lesson Number Input */}
          <div className="flex items-center gap-2">
             <span className="text-[10px] text-emerald-400 font-bold uppercase shrink-0">Lesson</span>
             <input 
               className="flex-1 bg-white/5 border-0 text-[10px] font-bold text-emerald-400 focus:ring-1 focus:ring-emerald-500/50 p-0.5 px-1 rounded placeholder:text-emerald-900 hover:bg-white/10 transition-colors"
               value={localNum}
               placeholder="ID..."
               onChange={(e) => setLocalNum(e.target.value)}
               onBlur={() => handleBlur('lessonNum', localNum)}
             />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 pl-4">
        <div className="flex items-center justify-between mt-2">
           <div className="flex items-center text-xs text-slate-400 gap-1.5 bg-[#0a0a0c] px-2 py-1 rounded border border-white/5">
             <FileSearch className="w-3 h-3" />
             {row.resources?.length || 0} files
           </div>
           
           <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400">
             <Wand2 className="w-3 h-3" />
           </Button>
        </div>
      </CardContent>
    </Card>
  );
});
