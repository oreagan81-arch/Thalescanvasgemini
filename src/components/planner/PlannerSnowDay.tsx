import React, { useState } from 'react';
import { Snowflake, Calendar as CalendarIcon, ArrowRight, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useStore } from '../../store';
import { calendarSync } from '../../services/service.calendarSync';

import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function PlannerSnowDay() {
  const { plannerData, setPlannerData } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [targetDate, setTargetDate] = useState<Date | undefined>(new Date());
  const [shiftDays, setShiftDays] = useState<number>(1);

  const handleApplyShift = () => {
    if (!plannerData || plannerData.length === 0) {
      toast.error("Planner is empty. Nothing to shift.");
      return;
    }
    if (!targetDate) {
      toast.error("Please select the date of the missed school day.");
      return;
    }

    try {
      // 1. Shift the dates locally in memory
      const updatedData = calendarSync.shiftDates(
        plannerData, 
        targetDate.toISOString(), 
        shiftDays
      );
      
      // 2. Save back to Zustand store
      setPlannerData(updatedData);
      
      toast.success(`Successfully shifted schedule forward by ${shiftDays} day(s).`, {
        description: "Run a Pre-Flight Sync to push these updated dates to Canvas."
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to shift dates.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-500 hover:bg-blue-500/20">
            <Snowflake className="w-4 h-4 mr-2" />
            Snow Day Shift
          </Button>
        }
      />
      
      <DialogContent className="sm:max-w-[425px] bg-[#0d0d10] border-white/10 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-400 font-bold">
            <Snowflake className="w-5 h-5" />
            Global Date Shifter
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Select a canceled school day. All assignments and week starts from this date onward will be shifted forward, skipping weekends automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-black tracking-widest text-slate-500">Date of Missed School Day</Label>
            <Popover>
              <PopoverTrigger render={
                <Button variant="outline" className="w-full justify-start text-left bg-black/20 border-white/10 text-slate-200">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {targetDate ? format(targetDate, 'PPP') : 'Pick a date'}
                </Button>
              } />
              <PopoverContent className="w-auto p-0 bg-[#0d0d10] border-white/10" align="start">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  initialFocus
                  className="bg-[#0d0d10] text-slate-200"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-black tracking-widest text-slate-500">Days to Shift Forward</Label>
            <div className="flex items-center gap-4">
              <Input 
                type="number" 
                min={1} 
                max={14}
                value={shiftDays}
                onChange={(e) => setShiftDays(parseInt(e.target.value) || 1)}
                className="bg-black/20 border-white/10 text-white w-24 h-10 font-mono font-bold"
              />
              <span className="text-sm text-slate-400 flex items-center gap-2">
                <ArrowRight className="w-4 h-4" /> 
                business days
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-slate-500 uppercase text-[10px] font-bold">Cancel</Button>
          <Button onClick={handleApplyShift} className="bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-[10px] px-6">
            <Check className="w-4 h-4 mr-2" />
            Apply Schedule Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
