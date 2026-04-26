import React, { useState } from 'react';
import { 
  Wand2, 
  Send, 
  Calendar as CalendarIcon, 
  Cake, 
  Layout,
  RefreshCcw,
  Copy,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

import { useStore } from '../store';
import { newsletterService, getBirthdaysForMonth } from '../services/service.newsletter';
import { canvasApiService } from '../services/canvasApiService';

import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';

export default function NewsletterBuilder() {
  const [pastedText, setPastedText] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDate] = useState(new Date());

  const activeBirthdays = getBirthdaysForMonth(currentDate);

  const handleGenerate = async () => {
    if (!pastedText.trim()) {
      toast.error("Please paste your raw newsletter updates first.");
      return;
    }

    setIsGenerating(true);
    toast.info("Gemini is formatting your newsletter...");
    
    try {
      const html = await newsletterService.generateNewsletter(pastedText, currentDate);
      setGeneratedHtml(html);
      toast.success("Newsletter ready for Canvas!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate newsletter.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (generatedHtml) {
      navigator.clipboard.writeText(generatedHtml);
      toast.success("HTML copied to clipboard!");
    }
  };

  const handlePushToCanvas = async () => {
    if (!generatedHtml) return;
    setIsGenerating(true);
    try {
      const { canvasCourseIds } = useStore.getState();
      const homeroomId = canvasCourseIds['Homeroom'] || '22254';
      
      await canvasApiService.postAnnouncement(
        `Weekly Newsletter: ${currentDate.toLocaleDateString()}`,
        generatedHtml,
        homeroomId
      );
      toast.success("Newsletter posted as a Homeroom Announcement!");
    } catch (error) {
      toast.error("Failed to post to Canvas.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Newsletter Engine</h1>
          <p className="text-muted-foreground">Paste your weekly updates, and AI will handle the Cidi Labs formatting and birthday logic.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Input & System Context */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-[#0d0d10] border-white/10">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-500">
                <Cake className="w-4 h-4" />
                System Context: Birthdays
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 text-sm text-slate-300">
              <p className="font-bold mb-2">{activeBirthdays.title}</p>
              {/* Safely render the basic HTML list of birthdays */}
              <div 
                className="pl-4 space-y-1 list-disc"
                dangerouslySetInnerHTML={{ __html: activeBirthdays.html }}
              />
              <p className="text-[10px] text-slate-500 mt-4 italic">
                *The system will automatically inject this into the Cidi Labs template.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#0d0d10] border-white/10">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-500" />
                Raw Update Draft
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea 
                placeholder="Paste your rough notes here... e.g. Dates to Know, Homeroom Notes, Links..."
                className="min-h-[300px] bg-black/20 border-white/10 font-sans text-sm resize-none focus:ring-amber-500/50"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating || !pastedText}
                className="w-full mt-4 bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                {isGenerating ? "Formatting & Purging Dates..." : "Generate Cidi Labs HTML"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Output Preview */}
        <div className="lg:col-span-8">
          <Card className="bg-white text-black min-h-[600px] shadow-2xl relative overflow-hidden flex flex-col">
            {/* Header Toolbar */}
            <div className="bg-slate-100 border-b p-2 flex justify-between items-center z-10">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-mono text-[10px]">
                Canvas Preview Mode
              </Badge>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleCopyToClipboard} disabled={!generatedHtml} className="h-7 text-xs text-slate-600 hover:bg-slate-200">
                  <Copy className="w-3 h-3 mr-1" /> Copy HTML
                </Button>
                <Button 
                  size="sm" 
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" 
                  disabled={!generatedHtml || isGenerating}
                  onClick={handlePushToCanvas}
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                  Push to Canvas
                </Button>
              </div>
            </div>

            {/* Canvas Simulation Area */}
            <div className="flex-1 p-8 overflow-y-auto bg-white">
              {generatedHtml ? (
                <div 
                  className="canvas-content-wrapper prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: generatedHtml }} 
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-32">
                  <Layout className="w-12 h-12 mb-4 opacity-20 text-slate-900" />
                  <p className="text-slate-500 font-medium">Paste your content and generate to see the preview.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
