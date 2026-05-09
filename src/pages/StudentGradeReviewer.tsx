
import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  GraduationCap, 
  Search, 
  AlertTriangle, 
  TrendingDown, 
  History, 
  MessageSquare,
  Loader2,
  ChevronRight,
  TrendingUp,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export default function StudentGradeReviewer() {
  const [courseId, setCourseId] = useState("10245"); // Default for Thales
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [inquiry, setInquiry] = useState<any>(null);
  const [mode, setMode] = useState<'alerts' | 'query'>('alerts');

  const runReview = async (forcedMode?: 'alerts' | 'query') => {
    const activeMode = forcedMode || (query ? 'query' : 'alerts');
    setLoading(true);
    setMode(activeMode);
    
    try {
      const functions = getFunctions();
      const gradeReviewCall = httpsCallable(functions, 'studentGradeReview');
      
      const result: any = await gradeReviewCall({
        courseId,
        mode: activeMode,
        query: activeMode === 'query' ? query : undefined
      });

      if (activeMode === 'alerts') {
        setAlerts(result.data.alerts || []);
        setResults([]);
      } else {
        setResults(result.data.results || []);
        setAlerts([]);
      }
      setInquiry(result.data.inquiry);
    } catch (error: any) {
      console.error("Grade review failed", error);
      alert("Failed to run grade review. Check Canvas token and course ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-amber-500" />
            Student Grade Reviewer
          </h1>
          <p className="text-slate-400 mt-1">Real-time academic performance monitoring and NLP grade inquiries.</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 p-1 rounded-lg border border-white/10">
          <Input 
            value={courseId} 
            onChange={(e) => setCourseId(e.target.value)}
            className="w-24 bg-transparent border-none text-amber-500 font-mono focus-visible:ring-0"
            placeholder="Course ID"
          />
          <Button 
            variant={mode === 'alerts' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => runReview('alerts')}
            className={cn("h-8 rounded", mode === 'alerts' && "bg-amber-500 text-black hover:bg-amber-400")}
          >
            Run Alerts
          </Button>
        </div>
      </div>

      {/* Main Inquiry Bar */}
      <Card className="bg-[#0d0d10] border-white/10 shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center px-4 py-3 gap-3">
            <Search className="h-5 w-5 text-slate-500" />
            <Input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runReview('query')}
              placeholder='Try "What is John Doe s test average for Q3?" or "Show me low homework scores for Jan"'
              className="flex-1 bg-transparent border-none focus-visible:ring-0 text-lg placeholder:text-slate-600"
            />
            <Button 
              onClick={() => runReview('query')}
              disabled={loading || !query}
              className="bg-amber-500 text-black font-bold uppercase tracking-wider h-10 hover:bg-amber-400"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Inquire
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inquiry Metadata */}
      {inquiry && mode === 'query' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2"
        >
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            Student: {inquiry.studentName || 'All'}
          </Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
            Metric: {inquiry.metric}
          </Badge>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
            Category: {inquiry.category}
          </Badge>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            Period: {inquiry.period}
          </Badge>
        </motion.div>
      )}

      {/* Results Section */}
      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="wait">
          {mode === 'alerts' ? (
            <motion.div
              key="alerts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h2 className="text-xl font-semibold text-white">Critical Alerts</h2>
                <Badge className="bg-red-500/20 text-red-500 border-none ml-2">
                  {loading ? 'Analyzing...' : `${alerts.length} Students At Risk`}
                </Badge>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-xl border border-white/10">
                  <Loader2 className="h-12 w-12 text-amber-500 animate-spin mb-4" />
                  <p className="text-slate-400 font-mono">Running Thales Academic Protocol: Grade Audit v4.1...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {alerts.map((student) => (
                    <Card key={student.studentId} className="bg-[#0d0d10] border-white/10 hover:border-red-500/30 transition-all group">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-white group-hover:text-amber-500 transition-colors uppercase tracking-tight">
                              {student.name}
                            </CardTitle>
                            <CardDescription className="text-slate-500 font-mono text-xs">
                              ID: {student.studentId}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-red-500">{student.lowGrades}</div>
                            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Low Scores</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Current Average</span>
                            <span className={cn(
                              "font-bold",
                              student.average && student.average < 80 ? "text-red-500" : "text-emerald-500"
                            )}>
                              {student.average || 'N/A'}%
                            </span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-1000",
                                student.average && student.average < 80 ? "bg-red-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${student.average || 0}%` }}
                            />
                          </div>
                          
                          <div className="pt-4 border-t border-white/5">
                            <details className="group/details">
                              <summary className="list-none cursor-pointer flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300">
                                View Violations
                                <ChevronRight className="h-3 w-3 group-open/details:rotate-90 transition-transform" />
                              </summary>
                              <div className="mt-3 space-y-2">
                                {student.details.filter((d: any) => d.percent < 80).map((det: any, i: number) => (
                                  <div key={i} className="flex justify-between items-center text-[11px] bg-red-500/5 p-2 rounded border border-red-500/10">
                                    <span className="text-slate-400 truncate max-w-[150px]">{det.assignmentName}</span>
                                    <span className="text-red-400 font-bold">{det.percent}%</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {alerts.length === 0 && !loading && (
                    <div className="col-span-full py-20 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                      <UserCheck className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-white">No Critical Alerts</h3>
                      <p className="text-slate-500 mt-1">All student averages currently meet Thales Academy standards.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-amber-500" />
                  <h2 className="text-xl font-semibold text-white">Inquiry Results</h2>
                </div>
                {results.length > 0 && (
                   <Badge variant="outline" className="border-white/10 text-slate-400">
                    {results.length} Match{results.length > 1 ? 'es' : ''} Found
                   </Badge>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-xl border border-white/10">
                  <Loader2 className="h-12 w-12 text-amber-500 animate-spin mb-4" />
                  <p className="text-slate-400 font-mono">Querying Canvas Cognitive API...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((r) => (
                    <Card key={r.studentId} className="bg-[#0d0d10] border-white/10 overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-4 items-center">
                        <div className="p-6 md:border-r border-white/10">
                           <div className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">Student</div>
                           <div className="text-lg font-bold text-white uppercase">{r.name}</div>
                           <div className="text-xs text-slate-600 font-mono mt-1">Ref: {r.studentId}</div>
                        </div>
                        <div className="p-6 md:border-r border-white/10 text-center">
                           <div className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">Average Grade</div>
                           <div className={cn(
                             "text-3xl font-black",
                             r.average && r.average < 80 ? "text-red-500" : "text-emerald-500"
                           )}>
                             {r.average ? `${r.average}%` : 'N/A'}
                           </div>
                           <div className="flex items-center justify-center gap-1 mt-1">
                             {r.average && r.average < 80 ? (
                               <TrendingDown className="h-3 w-3 text-red-500" />
                             ) : (
                               <TrendingUp className="h-3 w-3 text-emerald-500" />
                             )}
                             <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                               {r.average && r.average < 80 ? 'Below' : 'Above'} Parity
                             </span>
                           </div>
                        </div>
                        <div className="p-6 md:border-r border-white/10 text-center">
                           <div className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">Submissions</div>
                           <div className="text-3xl font-black text-white">{r.submissionCount}</div>
                           <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">In Selected Period</div>
                        </div>
                        <div className="p-4 bg-white/[0.02]">
                           <Button 
                            variant="ghost" 
                            className="w-full text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-amber-400 hover:bg-amber-400/5 group"
                            onClick={() => {
                              // Expand details logic could go here or just show them
                            }}
                           >
                             Full Transcript
                             <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                           </Button>
                        </div>
                      </div>

                      <div className="px-6 pb-6 pt-2">
                        <Table className="text-[11px] border-t border-white/5">
                           <TableHeader className="bg-white/[0.01]">
                             <TableRow className="border-white/5 hover:bg-transparent">
                               <TableHead className="text-slate-500 uppercase font-bold py-2">Assignment</TableHead>
                               <TableHead className="text-slate-500 uppercase font-bold py-2 text-right">Score</TableHead>
                               <TableHead className="text-slate-500 uppercase font-bold py-2 text-right">Percent</TableHead>
                             </TableRow>
                           </TableHeader>
                           <TableBody>
                             {r.details.map((d: any, i: number) => (
                               <TableRow key={i} className="border-white/5 hover:bg-white/[0.02]">
                                 <TableCell className="text-slate-300 py-2">{d.assignmentName}</TableCell>
                                 <TableCell className="text-right text-slate-400 py-2">{d.score}/{d.max}</TableCell>
                                 <TableCell className={cn(
                                   "text-right font-bold py-2",
                                   d.percent < 80 ? "text-red-500/80" : "text-emerald-500/80"
                                 )}>
                                   {d.percent}%
                                 </TableCell>
                               </TableRow>
                             ))}
                           </TableBody>
                        </Table>
                      </div>
                    </Card>
                  ))}
                  {results.length === 0 && !loading && (
                    <div className="py-20 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                      <Search className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-white">No Inquiry Matches</h3>
                      <p className="text-slate-500 mt-1">We couldn t find any data matching that specific query.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
