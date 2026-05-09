import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stethoscope, AlertTriangle, CheckCircle, Info, Download, Copy, Loader2 } from "lucide-react";
import { Finding, validateCanvasAudit } from "../lib/canvas-audit-validator";

export default function CanvasAuditorPage() {
  const [weekSlug, setWeekSlug] = useState("q4w5");
  const [weekStartDate, setWeekStartDate] = useState("2024-04-15");
  const [courseIds, setCourseIds] = useState("12345, 67890"); // Default example
  
  const [loading, setLoading] = useState(false);
  const [rawAuditData, setRawAuditData] = useState<any>(null);
  const [findings, setFindings] = useState<Finding[]>([]);

  const runAudit = async () => {
    setLoading(true);
    setFindings([]);
    setRawAuditData(null);
    
    try {
      const parsedIds = courseIds.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
      
      const functions = getFunctions();
      const canvasAuditCall = httpsCallable(functions, 'canvasAudit');
      
      // Call Firebase function
      const result = await canvasAuditCall({
        weekSlug,
        courseIds: parsedIds,
        weekStartDate
      });

      const auditData = result.data;
      setRawAuditData(auditData);
      
      // Run validator
      const newFindings = validateCanvasAudit(auditData);
      
      // Sort findings: ERROR -> WARN -> INFO
      newFindings.sort((a, b) => {
        const order = { ERROR: 0, WARN: 1, INFO: 2 };
        return order[a.severity] - order[b.severity];
      });
      
      setFindings(newFindings);
    } catch (error: any) {
      console.error("Audit failed", error);
      alert("Failed to run audit. Ensure Canvas API Key is set in Firebase and network is stable.");
    } finally {
      setLoading(false);
    }
  };

  const exportJSON = () => {
    if (!rawAuditData) return;
    const errors = findings.filter(f => f.severity === 'ERROR').length;
    const warnings = findings.filter(f => f.severity === 'WARN').length;
    
    const exportData = {
      meta: {
        generated_at: new Date().toISOString(),
        week_slug: weekSlug,
        week_start_date: weekStartDate,
        app_version: "Thales OS v21.0",
        total_errors: errors,
        total_warnings: warnings,
        health_score: Math.max(0, 100 - (errors * 5) - (warnings * 2))
      },
      findings,
      raw_audit: rawAuditData
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canvas-audit-${weekSlug}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const copyReport = () => {
    if (!findings.length) return;
    const errors = findings.filter(f => f.severity === 'ERROR').length;
    const report = `# Thales OS Canvas Audit (${weekSlug})\n\nErrors: ${errors}\nWarnings: ${findings.length - errors}\n\n` + 
      findings.map(f => `- [${f.severity}] ${f.course}: ${f.rule} (Expected: ${f.expected}, Actual: ${f.actual})`).join('\n');
    
    navigator.clipboard.writeText(report);
    alert("Report copied to clipboard.");
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'ERROR': return "bg-red-100 text-red-800 border-red-300";
      case 'WARN': return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default: return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  const errorCount = findings.filter(f => f.severity === 'ERROR').length;
  const warnCount = findings.filter(f => f.severity === 'WARN').length;
  const healthScore = rawAuditData ? Math.max(0, 100 - (errorCount * 5) - (warnCount * 2)) : null;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Stethoscope className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold tracking-tight">Canvas Audit Engine</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={copyReport} disabled={!rawAuditData}>
            <Copy className="w-4 h-4 mr-2" /> Copy Report
          </Button>
          <Button variant="outline" onClick={exportJSON} disabled={!rawAuditData}>
            <Download className="w-4 h-4 mr-2" /> Export JSON
          </Button>
        </div>
      </div>

      <Card className="bg-white shadow-sm">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Week Slug</Label>
            <Input value={weekSlug} onChange={e => setWeekSlug(e.target.value)} placeholder="e.g. q4w5" />
          </div>
          <div className="space-y-2">
            <Label>Week Start Date</Label>
            <Input type="date" value={weekStartDate} onChange={e => setWeekStartDate(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Course IDs (Comma Separated)</Label>
            <div className="flex space-x-2">
              <Input value={courseIds} onChange={e => setCourseIds(e.target.value)} placeholder="1234, 5678" />
              <Button onClick={runAudit} disabled={loading} className="whitespace-nowrap">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Run Full Audit"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {rawAuditData && (
        <>
          {/* Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="bg-slate-50">
              <CardContent className="pt-6 text-center">
                <div className="text-sm font-medium text-slate-500">Health Score</div>
                <div className={`text-4xl font-bold mt-2 ${healthScore! > 80 ? 'text-green-600' : healthScore! > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {healthScore}%
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-6 text-center">
                <div className="text-sm font-medium text-slate-500">Errors</div>
                <div className="text-4xl font-bold mt-2 text-red-600 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 mr-2" /> {errorCount}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-6 text-center">
                <div className="text-sm font-medium text-slate-500">Warnings</div>
                <div className="text-4xl font-bold mt-2 text-yellow-600 flex items-center justify-center">
                  <Info className="w-6 h-6 mr-2" /> {warnCount}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-6 text-center">
                <div className="text-sm font-medium text-slate-500">Courses Checked</div>
                <div className="text-4xl font-bold mt-2 text-slate-700">
                  {Object.keys(rawAuditData.courses).length}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50">
              <CardContent className="pt-6 text-center">
                <div className="text-sm font-medium text-slate-500">Pages Checked</div>
                <div className="text-4xl font-bold mt-2 text-slate-700 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 mr-2" /> 
                  {Object.values(rawAuditData.courses).filter((c: any) => c.page).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Findings Table */}
          <Card>
            <CardHeader>
              <CardTitle>Validation Findings ({findings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Severity</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Actual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {findings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-slate-500">
                          No findings! Perfect canonical alignment.
                        </TableCell>
                      </TableRow>
                    ) : (
                      findings.map((finding, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge variant="outline" className={getSeverityColor(finding.severity)}>
                              {finding.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-xs max-w-[150px] truncate" title={finding.course}>
                            {finding.course}
                          </TableCell>
                          <TableCell className="capitalize">{finding.category}</TableCell>
                          <TableCell>
                            {finding.rule}
                            {finding.field && <div className="text-xs text-slate-400 truncate max-w-[200px]" title={finding.field}>{finding.field}</div>}
                          </TableCell>
                          <TableCell className="text-green-600 text-sm">{finding.expected}</TableCell>
                          <TableCell className="text-red-600 text-sm">{finding.actual}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Course Cards */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold mt-8">Raw Course Data</h2>
            {Object.entries(rawAuditData.courses).map(([courseName, data]: [string, any]) => (
              <Card key={courseName} className="border border-slate-200">
                <CardHeader className="bg-slate-50 pb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">{courseName}</CardTitle>
                      <div className="text-sm text-slate-500 mt-1 flex items-center space-x-2">
                        <span>ID: {data.course_id}</span>
                        <span>•</span>
                        <Badge variant={data.course_info?.workflow_state === 'available' ? 'default' : 'secondary'}>
                          {data.course_info?.workflow_state || 'unknown'}
                        </Badge>
                        {data.page && (
                           <>
                            <span>•</span>
                            <span className="text-slate-600">{data.page.word_count} words</span>
                            <span>•</span>
                            <span>{data.page.published ? '✅ Published' : '❌ Unpublished'}</span>
                           </>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{data.assignments?.length || 0} Assignments</div>
                      <div className="text-slate-500">{data.fetch_errors?.length || 0} API Errors</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {data.page?.body && (
                    <details className="group border-b border-slate-100 last:border-0">
                      <summary className="cursor-pointer p-4 font-medium hover:bg-slate-50 transition-colors">
                        View Raw Page HTML Render
                      </summary>
                      <div className="p-4 bg-white">
                         <iframe 
                           srcDoc={data.page.body} 
                           className="w-full h-96 border rounded-md shadow-inner bg-white"
                           title="HTML Preview"
                         />
                      </div>
                    </details>
                  )}
                  {data.assignments?.length > 0 && (
                     <details className="group border-b border-slate-100 last:border-0">
                      <summary className="cursor-pointer p-4 font-medium hover:bg-slate-50 transition-colors">
                        View Assignment Metadata
                      </summary>
                      <div className="p-4 bg-slate-50">
                        <Table className="text-xs bg-white rounded-md">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Points</TableHead>
                              <TableHead>Grading</TableHead>
                              <TableHead>Due At</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.assignments.map((a: any) => (
                              <TableRow key={a.id}>
                                <TableCell>{a.name}</TableCell>
                                <TableCell>{a.points_possible}</TableCell>
                                <TableCell>{a.grading_type}</TableCell>
                                <TableCell>{new Date(a.due_at).toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
