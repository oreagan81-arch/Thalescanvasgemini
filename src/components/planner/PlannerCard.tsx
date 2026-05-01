import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, Tag } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlannerRow } from '../../services/service.planner';

interface PlannerCardProps {
  row: PlannerRow;
  onUpdate: (id: string, updates: Partial<PlannerRow>) => Promise<void>;
}

export const PlannerCard: React.FC<PlannerCardProps> = React.memo(({ row, onUpdate }) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
  } = useSortable({ id: row.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [fields, setFields] = useState({
    subject: row.subject || '',
    lessonTitle: row.lessonTitle || '',
    homework: row.homework || '',
    resources: row.resources || [],
  });

  useEffect(() => {
    setFields({
      subject: row.subject || '',
      lessonTitle: row.lessonTitle || '',
      homework: row.homework || '',
      resources: row.resources || [],
    });
  }, [row]);

  const handleBlur = (field: keyof typeof fields, value: any) => {
    if (JSON.stringify(value) !== JSON.stringify(row[field as keyof PlannerRow])) {
      onUpdate(row.id!, { [field]: value });
    }
  };

  const addResource = () => {
    const newResources = [...fields.resources, ''];
    setFields(prev => ({ ...prev, resources: newResources }));
  };

  const removeResource = (index: number) => {
    const newResources = fields.resources.filter((_, i) => i !== index);
    setFields(prev => ({ ...prev, resources: newResources }));
    handleBlur('resources', newResources);
  };

  const updateResource = (index: number, value: string) => {
    const newResources = [...fields.resources];
    newResources[index] = value;
    setFields(prev => ({ ...prev, resources: newResources }));
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="bg-card border-border hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing">
        <CardContent className="p-4 space-y-3">
          {/* Subject */}
          <div>
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">Subject</label>
            <input 
              className="w-full bg-transparent border-0 text-sm font-bold text-foreground p-0 focus:ring-0 placeholder:text-muted-foreground/50"
              value={fields.subject}
              placeholder="Subject..."
              onChange={(e) => setFields(prev => ({ ...prev, subject: e.target.value }))}
              onBlur={() => handleBlur('subject', fields.subject)}
            />
          </div>

          {/* Lesson Title */}
          <div>
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">Lesson Focus</label>
            <input 
              className="w-full bg-transparent border-0 text-sm text-foreground p-0 focus:ring-0 placeholder:text-muted-foreground/50"
              value={fields.lessonTitle}
              placeholder="Enter lesson..."
              onChange={(e) => setFields(prev => ({ ...prev, lessonTitle: e.target.value }))}
              onBlur={() => handleBlur('lessonTitle', fields.lessonTitle)}
            />
          </div>

          {/* Homework */}
          <div>
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">Homework</label>
            <textarea 
              className="w-full bg-transparent border-0 text-xs text-muted-foreground p-0 focus:ring-0 placeholder:text-muted-foreground/50 resize-none"
              value={fields.homework}
              placeholder="No homework specified..."
              rows={2}
              onChange={(e) => setFields(prev => ({ ...prev, homework: e.target.value }))}
              onBlur={() => handleBlur('homework', fields.homework)}
            />
          </div>

          {/* Resources */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Resources</label>
                <button onClick={addResource} className="text-[10px] bg-[#00c0a5]/10 text-[#00c0a5] px-2 py-0.5 rounded hover:bg-[#00c0a5]/20 transition-colors font-bold">+ Add Resource</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fields.resources.map((res, index) => (
                <Badge key={index} variant="secondary" className="pl-2 pr-1 py-0.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-0">
                  <span className="max-w-[120px] truncate">{res || 'New Resource'}</span>
                  <button 
                    onClick={() => removeResource(index)} 
                    className="p-0.5 hover:bg-slate-300 rounded-full transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {fields.resources.length === 0 && (
                <p className="text-[10px] text-slate-400 italic">No resources attached yet.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
