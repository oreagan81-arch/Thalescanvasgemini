import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Icons
import { 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  AlertTriangle, 
  RefreshCcw,
  ShieldCheck,
  Search,
  XCircle,
  ExternalLink
} from 'lucide-react';

import { useThalesStore } from '@/src/store';
import { pacingImportService, PacingWeek } from '@/src/services/service.pacingImport';
import { rulesEngine } from '@/src/lib/thales/rulesEngine';

export const SyllabusMapper: React.FC<{ weekId?: string }> = () => {
  const store = useThalesStore();
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<PacingWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const auditResults = useMemo(() => {
    if (!previewData) return [];
    
    return previewData.map(week => {
      const mathTestNum = typeof week.mathLesson === 'string' 
        ? week.mathLesson.toLowerCase().match(/test\s*(\d+)/)?.[1] 
        : null;

      if (mathTestNum) {
        const audit = rulesEngine.verifyCurriculum('math', parseInt(mathTestNum), week.mathLesson);
        return audit.isValid ? null : { week: week.weekNumber, errors: audit.errors };
      }
      return null;
    }).filter(Boolean) as { week: number; errors: string[] }[];
  }, [previewData]);

  const handleImport = async () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    setError(null);

    try {
      if (!store.geminiApiKey) {
        throw new Error("Missing Gemini API Key. Please visit the Settings page.");
      }

      const data = await pacingImportService.parse(rawText, store.geminiApiKey);
      setPreviewData(data);
    } catch (err: any) {
      setError(err.message || "Failed to parse curriculum.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (previewData) {
      store.setPlannerData(previewData);
      setPreviewData(null);
      setRawText('');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 animate-in fade-in slide-in-from-top-2">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!previewData ? (
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                  Pacing Guide Intelligence Importer
                </CardTitle>
                <CardDescription className="text-zinc-500 dark:text-zinc-400">
                  Select all from your Google Sheet and paste here. AI will extract 40 weeks and audit accuracy against Thales Academy standards.
                </CardDescription>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                {store.plannerData && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Existing Data Active
                  </Badge>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => window.open(store.pacingGuideUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Master Pacing Guide
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative group">
              <div className="absolute -top-3 left-4 px-2 bg-white dark:bg-zinc-950 text-[10px] font-bold text-zinc-400 uppercase tracking-widest z-10">
                Spreadsheet Raw Content
              </div>
              <Textarea 
                placeholder="Click 'Open Master Pacing Guide', hit Cmd+A to select all, copy, and paste the contents here..."
                className="min-h-[400px] font-mono text-[11px] leading-relaxed resize-none focus-visible:ring-emerald-500 border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 p-6 rounded-xl transition-all"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <div className="absolute bottom-4 right-4 opacity-20 group-hover:opacity-100 transition-opacity">
                <Search className="w-5 h-5 text-zinc-400" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 p-6 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <span>Deterministic Rules Audit Active</span>
              </div>
            </div>
            <Button 
              onClick={handleImport} 
              disabled={isProcessing || !rawText.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 px-6 font-semibold shadow-lg shadow-emerald-500/20"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing 40 Weeks...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Run Intelligence Mapping</>
              )}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="border-blue-200 dark:border-blue-900 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-500">
          <CardHeader className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-blue-900 dark:text-blue-300 flex items-center gap-2">
                  Mapping Results <Badge variant="secondary" className="bg-blue-100 text-blue-700">{previewData.length} Weeks Found</Badge>
                </CardTitle>
                <CardDescription>Verify extraction. Audit errors are highlighted in red rows.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewData(null)} className="h-9">
                  <RefreshCcw className="w-4 h-4 mr-2" /> Start Over
                </Button>
                <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 font-bold shadow-md shadow-blue-500/20">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Sync Dashboard
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {auditResults.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 border-b border-amber-100 dark:border-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Intelligence Audit Warnings</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    We found {auditResults.length} weeks where pacing deviates from Thales deterministic rules.
                  </p>
                </div>
              </div>
            )}
            <div className="max-h-[550px] overflow-auto">
              <Table>
                <TableHeader className="bg-zinc-50/80 dark:bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-md">
                  <TableRow>
                    <TableHead className="w-16 font-bold">Week</TableHead>
                    <TableHead className="font-bold">Math Focus</TableHead>
                    <TableHead className="font-bold">Reading Week</TableHead>
                    <TableHead className="font-bold">ELA Focus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => {
                    const hasAuditError = auditResults.some(a => a.week === row.weekNumber);
                    return (
                      <TableRow 
                        key={i} 
                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors ${hasAuditError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                      >
                        <TableCell className="font-bold">W{row.weekNumber}</TableCell>
                        <TableCell className="text-sm">{row.mathLesson}</TableCell>
                        <TableCell className="text-sm">Reading W{row.readingWeek}</TableCell>
                        <TableCell className="text-sm italic text-zinc-600 dark:text-zinc-400">{row.elaChapter}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SyllabusMapper;
