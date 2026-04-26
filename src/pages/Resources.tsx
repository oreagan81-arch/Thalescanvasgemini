import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  FileText, 
  RefreshCcw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import { resourceService, ResourceFile } from '../services/service.resource'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function Resources() {
  const [resources, setResources] = useState<ResourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubscribe = resourceService.subscribeAll((data) => {
      setResources(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await resourceService.syncCanvasFiles();
      toast.success('Canvas Registry Synced');
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const filteredResources = resources.filter(res => 
    res.cleanName.toLowerCase().includes(search.toLowerCase()) ||
    res.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Resource Brain</h1>
          <p className="text-slate-400">Intelligent file mapping engine synced with Canvas LMS.</p>
        </div>
        <Button 
          onClick={handleSync} 
          disabled={syncing}
          variant="outline" 
          className="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
        >
          {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
          Sync Canvas Files
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-6 flex-1">
        <div className="col-span-1 space-y-6">
          <Card className="rounded-2xl border border-white/10 bg-white/5">
            <CardHeader>
               <CardTitle className="text-white text-sm uppercase tracking-widest">Global Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                  <span className="text-xs text-slate-400 font-bold uppercase">Total Files</span>
                  <span className="text-white font-mono">{resources.length}</span>
               </div>
               <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                  <span className="text-xs text-slate-400 font-bold uppercase">Mapped</span>
                  <span className="text-emerald-500 font-mono">{resources.filter(r => r.mappedTo).length}</span>
               </div>
               <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                  <span className="text-xs text-slate-400 font-bold uppercase">Orphans</span>
                  <span className={cn(
                    "font-mono",
                    resources.filter(r => !r.mappedTo).length > 0 ? "text-amber-500" : "text-slate-500"
                  )}>
                    {resources.filter(r => !r.mappedTo).length}
                  </span>
               </div>
            </CardContent>
          </Card>

          <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
             <h4 className="text-blue-500 text-[10px] font-bold uppercase tracking-widest mb-3">Intelligence Tip</h4>
             <p className="text-slate-400 text-xs leading-normal">
               The "Brain" automatically strips version numbers and dates from Canvas filenames to keep your Planner clean.
             </p>
          </div>
        </div>

        <Card className="col-span-3 rounded-2xl border border-white/10 bg-[#121216] flex flex-col overflow-hidden">
          <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white text-sm uppercase tracking-widest">File Registry</CardTitle>
              <CardDescription className="text-slate-500 text-xs mt-1">Direct link to Canvas assets.</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <Input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources..."
                className="pl-9 bg-[#0a0a0c] border-white/10 text-white text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-slate-600">
                 <FileText className="w-12 h-12 mb-4 opacity-20" />
                 <p className="text-xs uppercase font-bold tracking-widest">Registry Empty</p>
                 <p className="text-[10px] mt-1">Run sync to pull from Canvas.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredResources.map((file) => (
                  <div key={file.id} className="group p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                          <FileText className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                       </div>
                       <div>
                          <div className="flex items-center gap-2">
                             <h4 className="text-sm font-bold text-slate-100">{file.cleanName}</h4>
                             <Badge variant="outline" className="bg-white/5 text-[9px] border-white/10 text-slate-500 uppercase tracking-tighter">
                               {file.subject}
                             </Badge>
                          </div>
                          <p className="text-[10px] text-slate-600 mt-0.5 font-mono">{file.rawName}</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                       {file.mappedTo ? (
                         <div className="flex items-center gap-2 text-emerald-500/70">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase">Mapped</span>
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 text-amber-500/50">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase">Orphan</span>
                         </div>
                       )}
                       
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-600 hover:text-white hover:bg-white/5">
                          <ExternalLink className="w-4 h-4" />
                       </Button>
                       <ChevronRight className="w-4 h-4 text-slate-800" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
