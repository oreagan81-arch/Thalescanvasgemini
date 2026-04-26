import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { format } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  RefreshCcw, 
  Send, 
  AlertCircle, 
  Trash2, 
  Plus, 
  Eye, 
  PenLine,
  Layout,
  Info
} from "lucide-react";

import { CanvasAnnouncement } from "../../services/service.aiAnnouncement";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface AnnouncementReviewerProps {
  announcement: CanvasAnnouncement;
  onApprove: (final: CanvasAnnouncement) => void;
  onRegenerate: () => void;
  isProcessing?: boolean;
}

export const AnnouncementReviewer = React.memo(({ 
  announcement, 
  onApprove, 
  onRegenerate,
  isProcessing = false 
}: AnnouncementReviewerProps) => {
  const [editedTitle, setEditedTitle] = useState(announcement.title);
  const [editedBody, setEditedBody] = useState(announcement.bodyHTML);
  const [postDate, setPostDate] = useState<Date>(
    announcement.suggestedPostDate ? new Date(announcement.suggestedPostDate) : new Date()
  );
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Sync internal state ONLY when announcement payload actually changes
  useEffect(() => {
    setEditedTitle(announcement.title);
    setEditedBody(announcement.bodyHTML);
    setChecklist(announcement.requiredAttachments.reduce((acc, item) => ({ ...acc, [item]: false }), {}));
    if (announcement.suggestedPostDate) {
      setPostDate(new Date(announcement.suggestedPostDate));
    }
  }, [announcement.title, announcement.bodyHTML, announcement.suggestedPostDate]);

  const handleToggleChecklist = (item: string) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const handleApprove = () => {
    onApprove({
      ...announcement,
      title: editedTitle,
      bodyHTML: editedBody,
      suggestedPostDate: postDate.toISOString(),
      requiredAttachments: Object.keys(checklist)
    });
  };

  const allItemsChecked = Object.values(checklist).every(v => v);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* LEFT SIDE: THE EDITOR */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <PenLine className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Draft Editor</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Real-time Preview</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" />
            AI Generated
          </Badge>
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5 bg-background/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="space-y-1">
              <Label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Announcement Title</Label>
              <Input 
                id="title"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-lg font-bold bg-transparent border-none focus-visible:ring-0 p-0 h-auto placeholder:opacity-50"
                placeholder="Enter title..."
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="min-h-[400px] flex flex-col">
              <div className="p-4 border-b bg-muted/10 flex items-center gap-2">
                <Layout className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground font-mono uppercase tracking-tighter">HTML Source Editor</span>
              </div>
              <Textarea 
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                className="flex-1 min-h-[350px] p-6 bg-transparent border-none focus-visible:ring-0 font-sans leading-relaxed resize-none text-base"
                placeholder="Drafting your update..."
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t p-4 flex justify-between items-center text-[11px] text-muted-foreground font-mono">
            <span>Character count: {editedBody.length}</span>
            <div className="flex items-center gap-2">
              <Eye className="w-3 h-3" />
              <span>Canvas Direct Preview</span>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* RIGHT SIDE: THE LOGIC PANEL */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        {/* SCHEDULING UNIT */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
              <CalendarIcon className="w-4 h-4 text-primary" />
              Schedule Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 border-border/50 bg-muted/20",
                    !postDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {postDate ? format(postDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={postDate}
                  onSelect={(date) => date && setPostDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {/* RESOURCE CHECKLIST */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
              <Layout className="w-4 h-4 text-primary" />
              Prep Checklist
            </CardTitle>
            <CardDescription className="text-[10px]">Verify files are attached to Canvas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {announcement.requiredAttachments.length > 0 ? (
              announcement.requiredAttachments.map((item) => (
                <div key={item} className="flex items-center space-x-3 group">
                  <Checkbox 
                    id={item} 
                    checked={checklist[item]} 
                    onCheckedChange={() => handleToggleChecklist(item)}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <Label 
                    htmlFor={item} 
                    className={cn(
                      "text-xs font-medium cursor-pointer transition-colors",
                      checklist[item] ? "text-muted-foreground line-through" : "text-foreground hover:text-primary"
                    )}
                  >
                    {item}
                  </Label>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-muted-foreground text-center py-2 border-2 border-dashed rounded-lg">No physical attachments detected.</p>
            )}
          </CardContent>
        </Card>

        {/* AI INSIGHTS */}
        <Card className="bg-primary/5 border-primary/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1">
            <Badge variant="ghost" className="bg-primary/10 text-primary text-[8px] h-4">Beta</Badge>
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-primary">
              <Info className="w-3.5 h-3.5" />
              AI Tone Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs italic leading-relaxed text-foreground/80">
              "{announcement.toneAnalysis}"
            </p>
          </CardContent>
        </Card>

        {/* MASTER ACTIONS */}
        <div className="space-y-3 pt-2">
          <Button 
            variant="outline" 
            className="w-full h-11 bg-background hover:bg-muted font-bold transition-all transform active:scale-95"
            onClick={onRegenerate}
            disabled={isProcessing}
          >
            <RefreshCcw className={cn("w-4 h-4 mr-2", isProcessing && "animate-spin")} />
            Regenerate Tweak
          </Button>
          <Button 
            className="w-full h-11 bg-primary text-primary-foreground font-bold shadow-xl shadow-primary/20 transition-all transform active:scale-95 disabled:grayscale"
            onClick={handleApprove}
            disabled={isProcessing || !allItemsChecked}
          >
            <Send className="w-4 h-4 mr-2" />
            Schedule to Canvas
          </Button>
          {!allItemsChecked && announcement.requiredAttachments.length > 0 && (
            <div className="flex items-center gap-1 justify-center text-[10px] text-destructive font-bold animate-pulse">
              <AlertCircle className="w-3 h-3" />
              <span>Verify all resources before scheduling</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
