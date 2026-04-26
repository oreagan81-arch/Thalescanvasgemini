import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Copy, 
  CheckCircle2, 
  History, 
  Wand2, 
  Calendar as CalendarIcon,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar as UICalendar } from '../../components/ui/calendar';
import { Calendar } from 'lucide-react';

import { aiAnnouncementService, GeneratedAnnouncement } from '../services/aiAnnouncementService';
import { canvasApiService } from '../services/canvasApiService';
import { useStore } from '../store';
import { rulesEngine } from '../lib/thales/rulesEngine';
import { toast } from 'sonner';

const SUGGESTIONS = [
  "Math Test 18 Friday",
  "Reading Week 11",
  "Grammar Chapter 3 Test",
  "Weekly Friday Update"
];

export default function AnnouncementCommandCenter() {
  const { geminiApiKey, canvasApiToken, canvasCourseIds, addRecentCommand } = useStore();
  const [command, setCommand] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [result, setResult] = useState<GeneratedAnnouncement | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showApiKeyError, setShowApiKeyError] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['Homeroom']);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

  const handleGenerate = async () => {
    if (!command.trim()) return;
    
    if (!geminiApiKey) {
      setShowApiKeyError(true);
      return;
    }

    setIsGenerating(true);
    setResult(null);
    setValidationErrors([]);
    setShowApiKeyError(false);
    
    try {
      const resp = await aiAnnouncementService.generateCanvasAnnouncement(
        command, 
        new Date().toLocaleDateString(),
        geminiApiKey
      );
      
      if (resp) {
        // 1. Sanitize for Canvas (Strip styles, add headers)
        resp.bodyHTML = rulesEngine.sanitizeForCanvas(resp.bodyHTML, resp.title);
        
        // Update suggested date from AI if available
        if (resp.suggestedPostDate) {
          setScheduledDate(new Date(resp.suggestedPostDate));
        }

        // 2. Perform Curriculum Verification (Detect halluncinations)
        const lowerCmd = command.toLowerCase();
        let verificationResult = { isValid: true, errors: [] as string[] };

        if (lowerCmd.includes('math test')) {
          const match = lowerCmd.match(/math test (\d+)/);
          if (match) {
            verificationResult = rulesEngine.verifyCurriculum('math', parseInt(match[1]), resp.bodyHTML);
          }
        } else if (lowerCmd.includes('reading week')) {
          const match = lowerCmd.match(/reading week (\d+)/);
          if (match) {
            verificationResult = rulesEngine.verifyCurriculum('reading', parseInt(match[1]), resp.bodyHTML);
          }
        }

        setValidationErrors(verificationResult.errors);
        setResult(resp);
        
        // 3. Add to history
        addRecentCommand(command);
      }
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      toast.error(error.message || "Failed to generate announcement.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePostToCanvas = async () => {
    if (!result || selectedCourses.length === 0 || !canvasApiToken) {
      toast.error("Please select at least one course and ensure announcement is generated.");
      return;
    }

    setIsPosting(true);
    let successCount = 0;
    
    try {
      for (const subject of selectedCourses) {
        const courseId = canvasCourseIds[subject];
        if (!courseId) continue;

        await canvasApiService.postAnnouncement(
          result.title,
          result.bodyHTML,
          courseId,
          { 
            delayed_post_at: scheduledDate ? scheduledDate.toISOString() : undefined 
          }
        );
        successCount++;
      }
      
      toast.success(`Broadcasting Complete: Posted to ${successCount} courses.`);
    } catch (error: any) {
      console.error("Canvas Post Error:", error);
      toast.error(error.message || "Failed to post to one or more courses.");
    } finally {
      setIsPosting(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      // Create a temporary element to safely copy HTML/Text
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = result.bodyHTML;
      navigator.clipboard.writeText(tempDiv.innerText || tempDiv.textContent || "");
      toast.success("Announcement text copied to clipboard!");
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl h-full flex flex-col space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-blue-500" />
            Announcement Command Center
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Type a curriculum command. The Intelligence Engine handles the rest.
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <History className="w-4 h-4" />
          Recent Commands
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
        {/* Left Column: The Command Input */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm flex-grow flex flex-col">
            <CardHeader>
              {showApiKeyError && (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3 text-amber-800 dark:text-amber-400">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Missing Gemini API Key</p>
                    <p className="text-xs mt-1">
                      To use AI features, please add your <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">GEMINI_API_KEY</code> 
                      in the Settings page.
                    </p>
                  </div>
                </div>
              )}
              <CardTitle className="text-lg flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-500" />
                Prompt Generator
              </CardTitle>
              <CardDescription>
                Use natural language. e.g., "Math Test 18 on Friday"
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4">
              <Textarea 
                placeholder="What do we need to announce to parents?" 
                className="flex-grow min-h-[200px] text-base resize-none focus-visible:ring-blue-500"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
              
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Badge 
                    key={suggestion} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1 text-sm font-normal"
                    onClick={() => setCommand(suggestion)}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" 
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || !command.trim()}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 animate-spin" /> Analyzing Curriculum...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-5 h-5" /> Generate Announcement
                  </span>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Review & Schedule UI */}
        <div className="lg:col-span-7 flex flex-col">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm flex-grow flex flex-col">
            {!result && !isGenerating && (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-12 text-center">
                <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                <p>Awaiting command...</p>
                <p className="text-sm mt-2 opacity-60">The generated announcement, tone analysis, and required attachments will appear here.</p>
              </div>
            )}
            
            {isGenerating && (
              <div className="flex flex-col items-center justify-center h-full text-blue-500 p-12">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-medium animate-pulse">Running Intelligence Engine Rules...</p>
              </div>
            )}

            {result && !isGenerating && (
              <>
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{result.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                          AI Tone: {result.toneAnalysis}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0 flex-grow flex flex-col">
                  <Tabs defaultValue="preview" className="flex-grow flex flex-col">
                    <div className="px-6 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                      <TabsList>
                        <TabsTrigger value="preview">Email Preview</TabsTrigger>
                        <TabsTrigger value="checklist" className="flex items-center gap-2">
                          Attachments <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full">{result.requiredAttachments.length}</Badge>
                        </TabsTrigger>
                      </TabsList>

                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase gap-2">
                              {scheduledDate ? (
                                <>
                                  <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
                                  Ready to Post: {scheduledDate.toLocaleDateString()}
                                </>
                              ) : (
                                <>
                                  <CalendarIcon className="w-3.5 h-3.5" />
                                  Post Immediately
                                </>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                             <UICalendar
                              mode="single"
                              selected={scheduledDate || undefined}
                              onSelect={(date) => setScheduledDate(date || null)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase gap-2">
                              Target: {selectedCourses.length} Courses
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                            <h4 className="text-[10px] uppercase font-bold text-zinc-500 mb-3 tracking-widest">Multi-Cast Selection</h4>
                            <div className="space-y-2">
                               {Object.keys(canvasCourseIds).map(subject => (
                                 <div key={subject} className="flex items-center gap-2">
                                   <Checkbox 
                                    id={`course-${subject}`} 
                                    checked={selectedCourses.includes(subject)}
                                    onCheckedChange={(checked) => {
                                      if (checked) setSelectedCourses([...selectedCourses, subject]);
                                      else setSelectedCourses(selectedCourses.filter(s => s !== subject));
                                    }}
                                   />
                                   <label htmlFor={`course-${subject}`} className="text-xs font-medium cursor-pointer">{subject}</label>
                                 </div>
                               ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    
                    <TabsContent value="preview" className="flex-grow p-6 m-0 outline-none">
                      {/* Validation Errors Alert */}
                      {validationErrors.length > 0 && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400">
                          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-bold text-sm">Curriculum Accuracy Warning</p>
                            <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                              {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}
                      
                      {/* Using a content-editable div to allow quick tweaks by the teacher before sending */}
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px]"
                        dangerouslySetInnerHTML={{ __html: result.bodyHTML }}
                        contentEditable
                        suppressContentEditableWarning
                      />
                    </TabsContent>
                    
                    <TabsContent value="checklist" className="flex-grow p-6 m-0">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm font-medium">Verify these resources are attached in Canvas before posting.</p>
                        </div>
                        {result.requiredAttachments.map((attachment, i) => (
                          <div key={i} className="flex items-center space-x-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                            <Checkbox id={`attachment-${i}`} />
                            <label htmlFor={`attachment-${i}`} className="text-sm font-medium leading-none cursor-pointer">
                              {attachment}
                            </label>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                
                <CardFooter className="border-t border-zinc-100 dark:border-zinc-800 p-6 flex justify-between bg-zinc-50 dark:bg-zinc-950/50 rounded-b-xl">
                  <Button variant="ghost" onClick={handleCopy} className="gap-2">
                    <Copy className="w-4 h-4" /> Copy Text
                  </Button>
                  <div className="flex gap-3">
                    <Button variant="outline">Save as Draft</Button>
                    <Button 
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                      disabled={isPosting}
                      onClick={handlePostToCanvas}
                    >
                      {isPosting ? <Sparkles className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isPosting ? 'Posting...' : 'Schedule to Canvas'}
                    </Button>
                  </div>
                </CardFooter>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
