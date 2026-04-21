import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { FileDown, Wand2, Plus, GripVertical, FileSearch } from 'lucide-react'

// Dummy Data for Preview
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const INITIAL_ROWS = [
  { id: 1, subject: 'Math', lesson: 'L102', title: 'Subtracting Decimals', type: 'Lesson', resources: '3 files mapped' },
  { id: 2, subject: 'Reading', lesson: 'Ch 4', title: 'Because of Winn-Dixie', type: 'Lesson', resources: '1 file mapped' },
  { id: 3, subject: 'Science', lesson: '2.1', title: 'Ecosystems', type: 'Lesson', resources: '0 files' },
];

export function Planner() {
  const [week, setWeek] = useState('2024-W24');

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
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
              <SelectItem value="2024-W23">Week 23 (Feb 19-23)</SelectItem>
              <SelectItem value="2024-W24">Week 24 (Feb 26-Mar 1)</SelectItem>
              <SelectItem value="2024-W25">Week 25 (Mar 4-8)</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300">
            <FileDown className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button className="bg-amber-500 hover:bg-amber-400 text-black border-0 font-bold">
            <Wand2 className="w-4 h-4 mr-2" />
            AI Auto-Fill
          </Button>
        </div>
      </div>

      {/* Grid Canvas */}
      <ScrollArea className="flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
        <div className="min-w-max p-6 flex gap-4 h-full">
          {DAYS.map(day => (
            <div key={day} className="w-[320px] flex flex-col gap-3 shrink-0">
               {/* Day Header */}
               <div className="sticky top-0 z-10 bg-[#0a0a0c]/80 backdrop-blur p-3 rounded-lg border border-white/10 shadow-sm flex items-center justify-between">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-slate-100">{day}</h3>
                 {day === 'Friday' && <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10 text-[10px] uppercase">Auto-Test Day</Badge>}
               </div>
               
               {/* Lesson Cards */}
               <div className="flex flex-col gap-3 pb-8">
                 {INITIAL_ROWS.map((row) => (
                    <Card key={row.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-all group backdrop-blur relative overflow-hidden">
                      {/* Left Grip Indicator */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/5 group-hover:bg-amber-500/50 transition-colors cursor-grab" />
                      
                      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between space-y-0 pl-4">
                        <div>
                          <Badge variant="outline" className="bg-white/5 text-slate-300 border-white/10 font-bold text-[10px] tracking-wider uppercase mb-1.5">{row.subject}</Badge>
                          <CardTitle className="text-sm font-bold text-white leading-tight">
                            <span className="text-emerald-400 mr-1.5">{row.lesson}</span>
                            {row.title}
                          </CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <GripVertical className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 pl-4">
                        <div className="flex items-center justify-between mt-2">
                           <div className="flex items-center text-xs text-slate-400 gap-1.5 bg-[#0a0a0c] px-2 py-1 rounded border border-white/5">
                             <FileSearch className="w-3 h-3" />
                             {row.resources}
                           </div>
                           
                           <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400">
                             <Wand2 className="w-3 h-3" />
                           </Button>
                        </div>
                      </CardContent>
                    </Card>
                 ))}
                 
                 <Button variant="outline" className="w-full border-dashed border-white/10 bg-transparent text-slate-500 hover:text-slate-300 hover:border-white/20 hover:bg-white/5 justify-start h-10 mt-1 uppercase text-xs font-bold tracking-widest">
                   <Plus className="w-4 h-4 mr-2" /> Add Block
                 </Button>
               </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="bg-[#0a0a0c]" />
      </ScrollArea>
    </div>
  );
}
