import { Copy, RefreshCw, Loader2, Save, FileDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface PreviewCardProps {
  content: string;
  setContent: (val: string) => void;
  subject: string;
  setSubject: (val: string) => void;
  loading: boolean;
  onCopy: () => void;
  onRetry: () => void;
  onSaveTemplate?: () => void;
}

export function PreviewCard({ 
  content, 
  setContent, 
  subject, 
  setSubject, 
  loading, 
  onCopy, 
  onRetry, 
  onSaveTemplate 
}: PreviewCardProps) {
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Thales Announcement Export</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; padding: 40px; color: #1a1a1a; }
            pre { white-space: pre-wrap; font-family: inherit; }
            .header { border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 20px; }
            .school { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; }
            .subject { font-weight: bold; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school">Thales Academy Parent Communication</div>
            <h1>Email Announcement</h1>
          </div>
          <div class="subject">Subject: ${subject}</div>
          <pre>${content}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Card className="flex-1 rounded-2xl border border-white/10 bg-[#121216] flex flex-col overflow-hidden relative group">
      {loading && (
        <div className="absolute inset-x-0 top-0 h-1 bg-amber-500/20 overflow-hidden z-20">
          <div className="h-full bg-amber-500 animate-pulse origin-left w-full" />
        </div>
      )}
      
      <CardHeader className="border-b border-white/5 bg-white/5 flex flex-row items-center justify-between shrink-0 h-14">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <CardTitle className="text-white text-xs uppercase tracking-widest font-bold">
            Email Preview Card
          </CardTitle>
        </div>
        
        <div className="flex items-center gap-2">
          {onSaveTemplate && (
            <Button 
              onClick={onSaveTemplate}
              variant="ghost" 
              size="sm" 
              className="h-8 text-slate-400 hover:text-amber-500 hover:bg-amber-500/5 gap-2 px-3"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase">Blueprint</span>
            </Button>
          )}
          <Button 
            onClick={handleExportPDF}
            variant="ghost" 
            size="sm" 
            className="h-8 text-slate-400 hover:text-white hover:bg-white/5 gap-2 px-3"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase">PDF</span>
          </Button>
          <Button 
            onClick={onCopy}
            variant="ghost" 
            size="sm" 
            className="h-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/5 gap-2 px-3"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase">Copy All</span>
          </Button>
          <Button 
            onClick={onRetry}
            variant="ghost" 
            size="sm" 
            className="h-8 text-slate-400 hover:text-white hover:bg-white/5 gap-2 px-3"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col relative bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="px-8 pt-6">
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest shrink-0">Subject:</span>
            <Input 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject Line..."
              className="bg-transparent border-0 h-8 focus-visible:ring-0 text-slate-100 text-sm font-medium p-0"
            />
          </div>
        </div>
        
        <div className="flex-1 relative mt-2">
          <Textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="The AI engine is ready. Input a command or sync with your planner."
            className="absolute inset-0 w-full h-full bg-transparent border-0 resize-none px-8 py-4 text-slate-100 font-sans leading-relaxed focus-visible:ring-0 text-base"
          />
        </div>
      </CardContent>
    </Card>
  );
}
