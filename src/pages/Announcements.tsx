import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Send, 
  CheckCircle2, 
  Loader2, 
  History, 
  Zap
} from 'lucide-react'
import { useAnnouncements, useDraftAnnouncement } from '../hooks/hook.useAnnouncementSync'
import { calendarService } from '../services/service.calendar'
import { announcementService, Announcement } from '../services/service.announcement'
import { settingsService, UserSettings } from '../services/service.settings'
import { templateService } from '../services/service.template'
import { toast } from 'sonner'
import { getAuth } from 'firebase/auth'
import { useLocation } from 'react-router-dom'
import { CommandBar } from '../components/announcements/CommandBar'
import { PreviewCard } from '../components/announcements/PreviewCard'

const SMART_CHIPS = ['Math Test', 'Reading Test', 'Spelling List', 'Shurley Quiz', 'Weekly Update'];

// Grouping helper
const groupHistory = (announcements: Announcement[]) => {
  const groups: Record<string, Announcement[]> = {
    'Today': [],
    'This Week': [],
    'Older': []
  };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Start of week (Sunday)
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

  announcements.forEach(ann => {
    const timestamp = ann.updatedAt?.toMillis() || Date.now();
    const date = new Date(timestamp);
    
    if (date >= startOfDay) {
      groups['Today'].push(ann);
    } else if (date >= startOfWeek) {
      groups['This Week'].push(ann);
    } else {
      groups['Older'].push(ann);
    }
  });

  return groups;
};

export function Announcements() {
  const auth = getAuth();
  const user = auth.currentUser;
  const location = useLocation();
  
  const currentContext = calendarService.getAcademicContext();
  const [week, setWeek] = useState(calendarService.getWeekId(currentContext));
  const [command, setCommand] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [settings, setSettings] = useState<UserSettings|null>(null);
  const [localContent, setLocalContent] = useState('');
  const [localSubject, setLocalSubject] = useState('');
  const [allHistory, setAllHistory] = useState<Announcement[]>([]);

  const { announcements, isLoading, save, isSaving } = useAnnouncements(week);
  const { draft, isDrafting } = useDraftAnnouncement();

  useEffect(() => {
    const unsub = announcementService.subscribeAll(setAllHistory);
    return () => unsub();
  }, []);

  const historyGroups = groupHistory(allHistory);

  useEffect(() => {
    if (location.state?.initialCommand) {
      setCommand(location.state.initialCommand);
      handleAiDraft(location.state.initialCommand);
      // Clear state after reading it
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!user) return;
    const unsub = settingsService.subscribeSettings(user.uid, setSettings);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (announcements && announcements.length > 0) {
      setLocalContent(announcements[0].content);
      setLocalSubject(announcements[0].subject || '');
    } else {
      setLocalContent('');
      setLocalSubject('');
    }
  }, [announcements]);

  const handleAiDraft = async (cmd?: string) => {
    if (!settings) return;
    const finalCmd = cmd || command;
    setLastCommand(finalCmd);
    const result = await draft(week, settings, finalCmd);
    if (result) {
      if (typeof result === 'object' && result.emailBody) {
        setLocalContent(result.emailBody);
        setLocalSubject(result.subject || '');
      } else {
        setLocalContent(result);
      }
      toast.success(finalCmd ? 'Intelligence Logic Applied' : 'Weekly Briefing Drafted');
      setCommand('');
    }
  };

  const handleCopy = () => {
    const fullText = localSubject ? `Subject: ${localSubject}\n\n${localContent}` : localContent;
    navigator.clipboard.writeText(fullText);
    toast.success("Copied to clipboard");
  };

  const handleSaveBlueprint = async () => {
    if (!user || !lastCommand) {
      toast.error("No active command to save");
      return;
    }
    try {
      const title = prompt("Enter Blueprint Title:", lastCommand) || lastCommand;
      await templateService.createTemplate(user.uid, title, lastCommand);
      toast.success("Blueprint Saved to Repository");
    } catch (err) {
      toast.error("Failed to save blueprint");
    }
  };

  const handlePost = () => {
    save({ content: localContent, subject: localSubject });
  };

  return (
    <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Thales Announcement OS</h1>
          <p className="text-slate-400">Owen Reagan's AI-Powered Parent Communication Engine.</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={() => handleAiDraft()} disabled={isDrafting} variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10 h-10 px-6 font-bold shadow-lg shadow-amber-500/5">
            {isDrafting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Auto-Briefing
          </Button>
          <Button 
            onClick={handlePost} 
            disabled={isSaving || isLoading} 
            className="bg-gradient-to-r from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 text-black font-bold h-10 px-8 shadow-xl shadow-amber-500/20 border-none transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Post to History
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6 flex-1 overflow-hidden min-h-0">
        <div className="col-span-3 flex flex-col space-y-4 min-h-0">
          <CommandBar 
            command={command}
            setCommand={setCommand}
            onRun={handleAiDraft}
            loading={isDrafting}
            chips={SMART_CHIPS}
          />

          <PreviewCard 
            content={localContent}
            setContent={setLocalContent}
            subject={localSubject}
            setSubject={setLocalSubject}
            loading={isDrafting}
            onCopy={handleCopy}
            onRetry={() => handleAiDraft(command || 'Regenerate')}
            onSaveTemplate={handleSaveBlueprint}
          />
        </div>

        <div className="col-span-1 space-y-6 overflow-y-auto pr-1">
          <Card className="rounded-2xl border border-white/10 bg-white/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <History className="w-12 h-12 text-white" />
             </div>
             <CardHeader>
               <CardTitle className="text-slate-100 text-xs uppercase tracking-widest font-bold">Local History</CardTitle>
               <CardDescription className="text-slate-500 text-[10px]">Previously deployed briefings.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
               {Object.entries(historyGroups).map(([groupName, groupItems]) => (
                 groupItems.length > 0 && (
                   <div key={groupName} className="space-y-2">
                     <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{groupName}</div>
                     {groupItems.slice(0, 3).map((ann, idx) => (
                       <div 
                         key={ann.id || idx} 
                         onClick={() => setLocalContent(ann.content)}
                         className="p-3 bg-white/5 border border-white/5 rounded-xl hover:border-amber-500/30 transition-all cursor-pointer group"
                       >
                         <div className="flex justify-between items-start mb-1 text-[8px] font-bold text-amber-500/60 uppercase">
                           {ann.weekId}
                         </div>
                         <p className="text-[10px] text-slate-400 line-clamp-2">{ann.content}</p>
                       </div>
                     ))}
                   </div>
                 )
               ))}
               {allHistory.length === 0 && (
                 <div className="text-center py-4 opacity-20">
                   <History className="w-8 h-8 mx-auto mb-2" />
                   <p className="text-[10px] font-bold uppercase">No History Found</p>
                 </div>
               )}
             </CardContent>
          </Card>

          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl relative overflow-hidden text-xs text-slate-400 leading-normal">
             <h4 className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
               <CheckCircle2 className="w-3.5 h-3.5" />
               Engine V4 Status
             </h4>
             System tone set to <span className="text-white font-bold">{settings?.tone || 'Warm'}</span>. All assessments automatically cross-referenced with your standard Thales curriculum nodes.
          </div>
        </div>
      </div>
    </div>
  );
}
