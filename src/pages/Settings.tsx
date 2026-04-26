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
  const [courseId, setCourseId] = useState(store.canvasCourseId);
  const [startDate, setStartDate] = useState(store.schoolStartDate || '');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSave = () => {
    store.setSettings({
      geminiApiKey: geminiKey,
      canvasApiToken: canvasToken,
      canvasCourseId: courseId,
      schoolStartDate: startDate
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
      // In a real app, we'd save these to Firestore or the Store
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
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Canvas Course ID</label>
            <Input 
              value={courseId} 
              onChange={e => setCourseId(e.target.value)} 
              placeholder="e.g., 123456" 
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
          <CardDescription className="text-slate-400">Set the first day of school so the AI knows what week it is.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">First Day of School</label>
            <Input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="bg-black/40 border-white/10 text-white"
            />
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
