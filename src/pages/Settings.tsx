import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Settings as SettingsIcon, 
  Key, 
  Globe, 
  Save, 
  ShieldCheck,
  ExternalLink,
  Loader2,
  TableProperties,
  User,
  PenTool
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { settingsService, UserSettings } from '../services/service.settings'
import { COURSE_IDS } from '../constants'
import { toast } from 'sonner'
import { getAuth } from 'firebase/auth'

export function Settings() {
  const auth = getAuth();
  const user = auth.currentUser;
  
  const [settings, setSettings] = useState<UserSettings>({
    teacherName: 'Owen Reagan',
    schoolName: 'Thales Academy',
    signature: 'Owen Reagan',
    tone: 'Warm',
    canvasDomain: 'thales.instructure.com',
    canvasToken: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = settingsService.subscribeSettings(user.uid, (data) => {
      setSettings(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleUpdate = async (field: keyof UserSettings, value: string) => {
    if (!user) return;
    try {
      setSaving(field);
      await settingsService.updateSettings(user.uid, { [field]: value });
      toast.success(`${field} updated`);
    } catch (err) {
      toast.error('Failed to update');
    } finally {
      setSaving(null);
    }
  };

  const handleBulkUpdate = async () => {
    if (!user) return;
    try {
      setSaving('all');
      await settingsService.updateSettings(user.uid, settings);
      toast.success('System settings synchronized');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">System Control</h1>
          <p className="text-slate-400">Deterministic routing and integration configurations.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 flex-1">
        <div className="col-span-2 space-y-6">
          <Card className="rounded-2xl border border-white/10 bg-[#121216]">
            <CardHeader className="border-b border-white/5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-white text-sm uppercase tracking-widest">Canvas LMS Core</CardTitle>
              </div>
              <CardDescription className="text-slate-500 text-xs mt-1">Primary connection to the Thales Academy instance.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="canvas_domain" className="text-xs text-slate-400 uppercase font-bold">Canvas Instance URL</Label>
                  <div className="flex gap-3">
                    <Input 
                      id="canvas_domain"
                      value={settings.canvasDomain || ''}
                      onChange={(e) => setSettings({...settings, canvasDomain: e.target.value})}
                      placeholder="thales.instructure.com"
                      className="bg-black/40 border-white/10 text-white font-mono text-sm h-10"
                    />
                    <Button 
                      onClick={() => handleUpdate('canvasDomain', settings.canvasDomain || '')}
                      disabled={saving === 'canvasDomain'}
                      className="bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                    >
                      {saving === 'canvasDomain' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="canvas_token" className="text-xs text-slate-400 uppercase font-bold">LMS API Access Token</Label>
                  <div className="flex gap-3">
                    <Input 
                      id="canvas_token"
                      type="password"
                      value={settings.canvasToken || ''}
                      onChange={(e) => setSettings({...settings, canvasToken: e.target.value})}
                      placeholder="••••••••••••••••••••••••••••"
                      className="bg-black/40 border-white/10 text-white font-mono text-sm h-10 text-amber-500"
                    />
                    <Button 
                      onClick={() => handleUpdate('canvasToken', settings.canvasToken || '')}
                      disabled={saving === 'canvasToken'}
                      className="bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                    >
                      {saving === 'canvasToken' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-600">Issued via Canvas Settings &gt; New Access Token.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                 <div className="flex items-center gap-3 text-emerald-500/80 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Secure Token Handshake Protocol Active</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-white/10 bg-[#121216]">
            <CardHeader className="border-b border-white/5">
               <div className="flex items-center gap-2">
                  <TableProperties className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-white text-sm uppercase tracking-widest">Deterministic Route Map</CardTitle>
               </div>
               <CardDescription className="text-slate-500 text-xs mt-1">Fixed Course IDs for subject routing.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-white/5">
                  {Object.entries(COURSE_IDS).map(([subject, id]) => (
                    <div key={subject} className="flex items-center justify-between p-4 px-6 hover:bg-white/[0.02]">
                       <span className="text-sm font-bold text-slate-100">{subject}</span>
                       <Badge variant="outline" className="bg-black/40 border-white/10 text-amber-500 font-mono text-xs">
                          {id}
                       </Badge>
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 space-y-6">
           <div className="p-8 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <SettingsIcon className="w-10 h-10 text-amber-500 mb-4 opacity-40" />
              <h3 className="text-white font-bold mb-2">Subject Routing</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                These settings control the "Deterministic Bridge". Ensure your Domain and Course ID match your official Canvas dashboard URLs exactly.
              </p>
              <Button variant="link" className="text-amber-500 p-0 h-auto text-xs font-bold mt-4">
                 View Implementation Docs
                 <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
           </div>

           <Card className="rounded-2xl border border-white/10 bg-[#121216]">
            <CardHeader className="border-b border-white/5">
                <div className="flex items-center gap-2">
                   <User className="w-4 h-4 text-amber-500" />
                   <CardTitle className="text-white text-xs uppercase tracking-widest">Teacher Profile</CardTitle>
                </div>
             </CardHeader>
             <CardContent className="p-6 space-y-4">
                <div className="grid gap-2">
                   <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Full Name</Label>
                   <Input 
                     value={settings.teacherName}
                     onChange={(e) => setSettings({...settings, teacherName: e.target.value})}
                     placeholder="e.g. Owen Reagan"
                     className="bg-black/40 border-white/10 text-white text-xs h-10"
                   />
                </div>
                <div className="grid gap-2">
                   <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Email Signature</Label>
                   <Input 
                     value={settings.signature}
                     onChange={(e) => setSettings({...settings, signature: e.target.value})}
                     placeholder="e.g. Owen Reagan, 4th Grade Teacher"
                     className="bg-black/40 border-white/10 text-white text-xs h-10"
                   />
                </div>
             </CardContent>
           </Card>

           <Card className="rounded-2xl border border-white/10 bg-[#121216]">
              <CardHeader className="border-b border-white/5">
                 <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-amber-500" />
                    <CardTitle className="text-white text-xs uppercase tracking-widest">AI Communication Tone</CardTitle>
                 </div>
              </CardHeader>
              <CardContent className="p-6">
                 <Select value={settings.tone} onValueChange={(val: any) => handleUpdate('tone', val)}>
                    <SelectTrigger className="bg-black/40 border-white/10 text-white text-xs h-10">
                       <SelectValue placeholder="Select Tone" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121216] border-white/10 text-white">
                       <SelectItem value="Warm">Warm & Encouraging</SelectItem>
                       <SelectItem value="Formal">Formal & Professional</SelectItem>
                       <SelectItem value="Friendly">Friendly & Casual</SelectItem>
                       <SelectItem value="Direct">Concise & Direct</SelectItem>
                    </SelectContent>
                 </Select>
                 <p className="text-[10px] text-slate-500 mt-2 italic">Controls the "Voice" of the AI communication assistant.</p>
              </CardContent>
           </Card>

           <Button 
             onClick={handleBulkUpdate}
             className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-12 rounded-xl"
           >
             {saving === 'all' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
             Sync All Terminal Settings
           </Button>
        </div>
      </div>
    </div>
  )
}


