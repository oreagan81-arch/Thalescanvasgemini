import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  RefreshCcw, 
  FileJson,
  Layout,
  BookOpen,
  ArrowRight,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ThalesHeader } from '../thales/ThalesHeader';
import { extractCurriculumFromSyllabus, SyllabusExtractionResult } from '@/src/services/service.curriculumExtraction';
import { useSettings } from '@/src/hooks/hook.useSettings';

interface SyllabusMapperProps {
  weekId: string;
}

export function SyllabusMapper({ weekId }: SyllabusMapperProps) {
  const [rawText, setRawText] = useState('');
  const [subject, setSubject] = useState('Math');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SyllabusExtractionResult | null>(null);
  const { settings } = useSettings();

  const handleProcess = async () => {
    if (!rawText.trim()) {
      toast.error("Please paste a syllabus first.");
      return;
    }

    setIsProcessing(true);
    try {
      const extracted = await extractCurriculumFromSyllabus(rawText, subject, weekId, settings);
      if (extracted) {
        setResult(extracted);
        toast.success("Curriculum mapped successfully!");
      } else {
        toast.error("AI couldn't parse that syllabus. Try simplifying the text.");
      }
    } catch (error) {
      toast.error("An error occurred during extraction.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8 min-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4 mb-12">
        <div className="p-3 bg-amber-500/10 rounded-2xl">
          <Sparkles className="w-10 h-10 text-amber-500" />
        </div>
        <ThalesHeader 
          title="Syllabus Mapping Engine" 
          subtitle="Content Decomposition Protocol" 
          className="items-center border-l-0 pl-0 mt-4" 
        />
        <p className="max-w-2xl text-slate-400 text-lg leading-relaxed">
          Paste your raw curriculum text. Our intelligence engine will extract assignments, 
          draft announcements, and generate Canvas-ready HTML.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Input Side */}
        <div className="space-y-6">
          <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                Raw Curriculum Source
              </CardTitle>
              <CardDescription>Paste your raw document text here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {['Math', 'Reading', 'Spelling', 'Science', 'History'].map(sub => (
                  <Button 
                    key={sub}
                    variant={subject === sub ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSubject(sub)}
                    className={subject === sub ? "bg-amber-500 hover:bg-amber-400 text-black" : "border-white/10 text-slate-400"}
                  >
                    {sub}
                  </Button>
                ))}
              </div>
              <Textarea 
                placeholder="Ex: Monday: Lesson 15 + Study Guide. Homework: Worksheet 15A. ..."
                className="min-h-[400px] bg-white/5 border-white/10 focus:border-amber-500/50 resize-none font-mono text-sm leading-relaxed"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleProcess} 
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold h-12 text-lg shadow-lg shadow-amber-500/20"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <RefreshCcw className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Curriculum...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Run Mapping Engine
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Result Side */}
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-3xl p-12 text-center"
            >
              <div className="space-y-4 max-w-xs">
                <div className="mx-auto w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                  <ArrowRight className="w-8 h-8 text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-500">Awaiting Input</h3>
                <p className="text-sm text-slate-600">The engine is primed. Provide a syllabus to begin the decomposition process.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Tabs defaultValue="visual" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-white/5 p-1 rounded-xl">
                  <TabsTrigger value="visual" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                    <Layout className="w-4 h-4 mr-2" /> Visual
                  </TabsTrigger>
                  <TabsTrigger value="json" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                    <FileJson className="w-4 h-4 mr-2" /> JSON
                  </TabsTrigger>
                  <TabsTrigger value="html" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                    <BookOpen className="w-4 h-4 mr-2" /> HTML
                  </TabsTrigger>
                </TabsList>

                {/* VISUAL PREVIEW */}
                <TabsContent value="visual" className="mt-4 focus-visible:ring-0">
                  <Card className="border-white/10 bg-slate-900/40 backdrop-blur-md">
                    <ScrollArea className="h-[600px] w-full p-6">
                      <div className="space-y-8">
                        {result.aiAuditorWarnings && result.aiAuditorWarnings.length > 0 && (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-amber-500 mb-1">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">AI Auditor Warnings</span>
                            </div>
                            <ul className="space-y-1">
                              {result.aiAuditorWarnings.map((warning, i) => (
                                <li key={i} className="text-sm text-amber-200/80">• {warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500 mb-4 h-6 border-b border-amber-500/20">Extracted Assignments</h3>
                          <div className="space-y-2">
                            {result.pacingPlan.rows.map((row, i) => (
                              <div key={i} className="flex gap-4 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/20 transition-all">
                                <Badge variant="outline" className="h-fit shrink-0 bg-amber-500/10 text-amber-500 border-amber-500/20">{row.day}</Badge>
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-white leading-none">{row.lessonTitle}</p>
                                  <p className="text-xs text-slate-400 italic">HW: {row.homework}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-4 h-6 border-b border-blue-400/20">Draft Announcements</h3>
                          {result.announcements.map((ann, i) => (
                            <div key={i} className="p-4 bg-blue-500/5 rounded-lg border border-blue-500/10 space-y-2">
                               <p className="text-sm font-bold text-blue-400">{ann.title}</p>
                               <div className="text-xs text-slate-300 line-clamp-3 opacity-80" dangerouslySetInnerHTML={{ __html: ann.bodyHTML }} />
                            </div>
                          ))}
                        </div>

                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-4 h-6 border-b border-emerald-400/20">Mapped Resources</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {result.resources.map((res, i) => (
                              <div key={i} className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10 flex items-center justify-between">
                                <div className="space-y-1 min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{res.title}</p>
                                  <p className="text-[10px] text-emerald-500/60 font-mono truncate">{res.friendlyUrl}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500" onClick={() => copyToClipboard(res.friendlyUrl)}>
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </Card>
                </TabsContent>

                {/* JSON OUTPUT */}
                <TabsContent value="json" className="mt-4 focus-visible:ring-0">
                  <Card className="border-white/10 bg-[#0c0c0e]">
                    <div className="absolute top-4 right-4 z-10">
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(JSON.stringify(result.pacingPlan, null, 2))}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <ScrollArea className="h-[600px] w-full">
                      <pre className="p-6 text-[10px] font-mono text-amber-500/80 leading-relaxed">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </ScrollArea>
                  </Card>
                </TabsContent>

                {/* HTML PAGE BLOCK */}
                <TabsContent value="html" className="mt-4 focus-visible:ring-0">
                  <Card className="border-white/10 bg-white">
                    <div className="absolute top-4 right-4 z-10">
                      <Button variant="secondary" size="sm" onClick={() => copyToClipboard(result.htmlBlock)} className="gap-2">
                        <Copy className="w-4 h-4" /> Copy Boilerplate
                      </Button>
                    </div>
                    <ScrollArea className="h-[600px] w-full p-8 text-slate-800">
                      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: result.htmlBlock }} />
                    </ScrollArea>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex gap-4">
                <Button className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-12 text-lg">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Apply to Planner
                </Button>
                <Button variant="outline" className="h-12 w-12 border-white/10" onClick={() => setResult(null)}>
                  <RefreshCcw className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
