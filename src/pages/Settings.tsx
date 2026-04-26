import React, { useState } from 'react';
import { Save, Key, Calendar, RefreshCw } from 'lucide-react';
import { useThalesStore } from '@/src/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { calendarSyncService } from '../services/service.calendarSync';

export function Settings() {
  const store = useThalesStore();
  
  const [geminiKey, setGeminiKey] = useState(store.geminiApiKey);
  const [canvasToken, setCanvasToken] = useState(store.canvasApiToken);
  const [pacingUrl, setPacingUrl] = useState(store.pacingGuideUrl);
  const [startDate, setStartDate] = useState(store.schoolStartDate || '');
  
  // Subject States mapped to canvasCourseIds
  const [courseIds, setCourseIds] = useState(store.canvasCourseIds);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleIdChange = (subject: string, id: string) => {
    setCourseIds(prev => ({ ...prev, [subject]: id }));
  };

  const handleSave = () => {
    store.setSettings({
      geminiApiKey: geminiKey,
      canvasApiToken: canvasToken,
      pacingGuideUrl: pacingUrl,
      schoolStartDate: startDate,
      canvasCourseIds: courseIds
    });
    toast.success("Settings saved successfully!"); 
  };

  const handleSyncCalendar = async () => {
    if (!geminiKey) {
      toast.error("Gemini API Key required for Calendar Sync.");
      return;
    }

    setIsSyncing(true);
    try {
      const breaks = await calendarSyncService.syncCalendar(geminiKey);
      console.log("Synced Breaks:", breaks);
      toast.success(`Successfully synced ${breaks.length} academic events using AI!`);
    } catch (error: any) {
      toast.error(error.message || "Failed to sync calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-white">System Settings</h1>
      
      <Card className="rounded-2xl border border-white/10 bg-[#121216]">
        <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Key className="w-5 h-5 text-purple-500" /> API Connections
            </CardTitle>
            <CardDescription className="text-slate-400">Securely store your API keys locally in your browser.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Gemini API Key</label>
            <Input 
              type="password" 
              value={geminiKey} 
              onChange={e => setGeminiKey(e.target.value)} 
              placeholder="AIzaSy..." 
              className="bg-black/40 border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Canvas LMS Token</label>
            <Input 
              type="password" 
              value={canvasToken} 
              onChange={e => setCanvasToken(e.target.value)} 
              placeholder="7~abcdef..." 
              className="bg-black/40 border-white/10 text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-white/10 bg-[#121216]">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-white">
            <Calendar className="w-5 h-5 text-blue-500" /> Pacing Engine Setup
          </CardTitle>
          <CardDescription className="text-slate-400">Set the first day of school and link your central pacing resources.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Pacing Guide Google Sheet URL</label>
            <Input 
              value={pacingUrl} 
              onChange={e => setPacingUrl(e.target.value)} 
              placeholder="https://docs.google.com/spreadsheets/d/..." 
              className="bg-black/40 border-white/10 text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">First Day of School</label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="bg-black/40 border-white/10 text-white"
            />
          </div>

          <div className="pt-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Canvas Subject Mappings</h3>
            <p className="text-xs text-slate-500 mb-4">Map each subject to the corresponding Canvas Course ID used for deep linking and sync.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Math Course ID
                </label>
                <Input 
                  value={courseIds['Math'] || ''} 
                  onChange={e => handleIdChange('Math', e.target.value)} 
                  className="bg-black/20 border-white/10 h-10 text-white placeholder:text-slate-600"
                  placeholder="21957"
                />
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  Reading Course ID
                </label>
                <Input 
                  value={courseIds['Reading'] || ''} 
                  onChange={e => handleIdChange('Reading', e.target.value)} 
                  className="bg-black/20 border-white/10 h-10 text-white placeholder:text-slate-600"
                  placeholder="21919"
                />
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  ELA Course ID
                </label>
                <Input 
                  value={courseIds['ELA'] || ''} 
                  onChange={e => handleIdChange('ELA', e.target.value)} 
                  className="bg-black/20 border-white/10 h-10 text-white placeholder:text-slate-600"
                  placeholder="21944"
                />
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                  History Course ID
                </label>
                <Input 
                  value={courseIds['History'] || ''} 
                  onChange={e => handleIdChange('History', e.target.value)} 
                  className="bg-black/20 border-white/10 h-10 text-white placeholder:text-slate-600"
                  placeholder="21934"
                />
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                  Science Course ID
                </label>
                <Input 
                  value={courseIds['Science'] || ''} 
                  onChange={e => handleIdChange('Science', e.target.value)} 
                  className="bg-black/20 border-white/10 h-10 text-white placeholder:text-slate-600"
                  placeholder="21970"
                />
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                  Homeroom ID (Optional)
                </label>
                <Input 
                  value={courseIds['Homeroom'] || ''} 
                  onChange={e => handleIdChange('Homeroom', e.target.value)} 
                  className="bg-black/20 border-white/5 h-10 text-slate-400 border-dashed"
                  placeholder="22254"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-black/20 flex justify-between p-4 border-t border-white/5">
          <Button 
            variant="outline" 
            onClick={handleSyncCalendar} 
            disabled={isSyncing}
            className="gap-2 border-white/10 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Academic Calendar'}
          </Button>
          <Button onClick={handleSave} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="w-4 h-4" /> Save Configuration
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
