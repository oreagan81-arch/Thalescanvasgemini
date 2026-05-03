import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Plus, 
  Search, 
  Trash2, 
  Play, 
  Layout, 
  Sparkles,
  Loader2,
  FileText
} from 'lucide-react'
import { templateService, Template } from '../services/service.template'
import { getAuth } from 'firebase/auth'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Input } from "@/components/ui/input"
import { cn } from '@/lib/utils'
import { commandParser } from '../lib/commandParser'

export function Templates() {
  const auth = getAuth();
  const user = auth.currentUser;
  const navigate = useNavigate();
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubscribe = templateService.subscribeTemplates(user.uid, (data) => {
      setTemplates(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (id: string) => {
    try {
      await templateService.deleteTemplate(id);
      toast.success("Template deleted");
    } catch (err) {
      toast.error("Failed to delete template");
    }
  };

  const handleUseTemplate = (command: string) => {
    navigate('/announcements', { state: { initialCommand: command } });
  };

  const filteredTemplates = templates.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.command.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 underline decoration-amber-500/30 underline-offset-8">Announcement Blueprints</h1>
          <p className="text-slate-400">Save your most frequent logic patterns for one-click generation.</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-400 text-black font-bold h-10 px-6 gap-2">
          <Plus className="w-4 h-4" />
          Create Blueprint
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input 
          placeholder="Search blueprints..." 
          className="pl-10 bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-amber-500/50 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 pb-10">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 opacity-20" />
            <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Loading Repository...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full border-2 border-dashed border-white/5 rounded-3xl p-20 flex flex-col items-center justify-center text-center opacity-40">
            <Layout className="w-12 h-12 text-slate-500 mb-4" />
            <p className="text-sm font-bold text-white uppercase tracking-widest">No Blueprints Found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Save a generated announcement as a template to see it here.</p>
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const intent = commandParser.parse(template.command);
            const parsed = commandParser.getLegacyMetadata(intent);
            return (
              <Card key={template.id} className="group rounded-2xl border border-white/10 bg-[#121216] hover:border-amber-500/30 transition-all overflow-hidden flex flex-col">
                <div className="p-1 bg-white/5 border-b border-white/5 flex items-center justify-between px-4 h-10">
                   <div className="flex items-center gap-2">
                     <span className="text-xs">{parsed.icon}</span>
                     <span className={cn("text-[8px] font-bold uppercase tracking-tighter opacity-60", parsed.color.split(' ')[0])}>
                       {parsed.subject}
                     </span>
                   </div>
                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-500 hover:text-red-400"
                        onClick={() => handleDelete(template.id!)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                   </div>
                </div>
                <CardContent className="p-6 flex-1 space-y-4">
                  <div>
                    <h3 className="text-white font-bold text-lg mb-1 line-clamp-1">{template.title}</h3>
                    <p className="text-[10px] font-mono text-amber-500/60 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" />
                      {template.command}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={() => handleUseTemplate(template.command)}
                      className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest h-9 rounded-lg gap-2"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Execute
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10 h-9 px-3 rounded-lg shadow-lg shadow-amber-500/5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  );
}
