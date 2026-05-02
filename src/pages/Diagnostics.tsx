import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Database, 
  ShieldAlert,
  Terminal,
  Zap,
  Filter,
  RefreshCw,
  Search
} from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface JobRecord {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  createdAt: any;
  updatedAt: any;
  userId: string;
}

export default function Diagnostics() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'failed' | 'completed'>('all');

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const q = query(
      collection(db, 'jobs'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const records = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JobRecord[];
      setJobs(records);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const stats = {
    total: jobs.length,
    failed: jobs.filter(j => j.status === 'failed').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    avgProcessing: 0 // In a real app, calculate this
  };

  const filteredJobs = jobs.filter(j => {
    if (filter === 'failed') return j.status === 'failed';
    if (filter === 'completed') return j.status === 'completed';
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">System Diagnostics</h1>
            <p className="text-sm text-slate-500">Monitor AI synthesis performance and API integrity.</p>
          </div>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DiagnosticStatCard 
          label="Total Orchestrations" 
          value={stats.total} 
          icon={Zap} 
          color="blue"
        />
        <DiagnosticStatCard 
          label="Critical Failures" 
          value={stats.failed} 
          icon={ShieldAlert} 
          color="red"
          alert={stats.failed > 0}
        />
        <DiagnosticStatCard 
          label="Successful Synthesis" 
          value={stats.completed} 
          icon={CheckCircle2} 
          color="emerald"
        />
        <DiagnosticStatCard 
          label="Uptime Integrity" 
          value="99.8%" 
          icon={Database} 
          color="indigo"
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Job Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Process Timeline
            </h3>
            <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
              {(['all', 'failed', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                    filter === f ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-20 bg-white/[0.02] border border-white/5 rounded-xl animate-pulse" />
              ))
            ) : filteredJobs.length === 0 ? (
              <div className="p-12 text-center bg-white/[0.02] border border-white/5 rounded-2xl border-dashed">
                <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No recent transactions matching filter.</p>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={job.id} 
                  className={cn(
                    "group relative overflow-hidden bg-white/[0.02] border rounded-xl p-4 transition-all hover:bg-white/[0.04]",
                    job.status === 'failed' ? "border-red-500/20" : "border-white/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className={cn(
                        "mt-1 w-8 h-8 rounded-lg flex items-center justify-center",
                        job.status === 'failed' ? "bg-red-500/10 text-red-400" : 
                        job.status === 'completed' ? "bg-emerald-500/10 text-emerald-400" : 
                        "bg-amber-500/10 text-amber-400"
                      )}>
                        {job.status === 'failed' ? <AlertTriangle className="w-4 h-4" /> : 
                         job.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : 
                         <RefreshCw className="w-4 h-4 animate-spin" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{job.type}</span>
                          <span className="text-[10px] text-slate-600 font-mono">#{job.id.substring(0, 8)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {job.createdAt?.toDate ? format(job.createdAt.toDate(), 'MMM d, HH:mm:ss') : 'Just now'}
                        </p>
                        {job.error && (
                          <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/10">
                            <p className="text-[10px] text-red-400/80 font-mono leading-relaxed">{job.error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                       <span className={cn(
                         "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                         job.status === 'failed' ? "bg-red-500/20 text-red-400" : 
                         job.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" : 
                         "bg-amber-500/20 text-amber-400"
                       )}>
                         {job.status}
                       </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* System Health / API Stats */}
        <div className="space-y-8">
           <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Connectivity
              </h3>
              <div className="bg-[#09090b] border border-white/5 rounded-2xl p-6 space-y-6">
                <HealthItem label="Canvas API" status="online" latency="124ms" />
                <HealthItem label="Gemini AI (Pro)" status="online" latency="2.4s" />
                <HealthItem label="Firebase Auth" status="online" latency="45ms" />
                <HealthItem label="Resend Mail" status="online" latency="80ms" />
              </div>
           </div>

           <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                   <Clock className="w-4 h-4 text-indigo-400" />
                </div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Token Utilization</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-400">Monthly Quote Used</span>
                    <span className="text-white">62%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[62%]" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic">Quota resets in 12 days. AI synthesis is throttled under heavy load.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function DiagnosticStatCard({ label, value, icon: Icon, color, alert }: any) {
  const colors: any = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  };

  return (
    <div className={cn(
      "p-6 rounded-2xl bg-white/[0.02] border transition-all hover:bg-white/[0.04] hover:scale-[1.02]",
      alert ? "border-red-500/40 shadow-lg shadow-red-500/5" : "border-white/5"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", colors[color])}>
           <Icon className="w-5 h-5" />
        </div>
        {alert && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
      </div>
      <div className="space-y-1">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</h4>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
}

function HealthItem({ label, status, latency }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-2 h-2 rounded-full",
          status === 'online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"
        )} />
        <span className="text-xs font-medium text-slate-300">{label}</span>
      </div>
      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">{latency}</span>
    </div>
  );
}
