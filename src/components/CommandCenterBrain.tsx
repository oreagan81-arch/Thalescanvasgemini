import { useEffect, useState } from "react"
import {
  fetchSystemConfig,
  updateSystemConfig,
  fetchMetrics,
  fetchJobs
} from "../services/service.controlPlane"

import { cn } from "@/lib/utils"

export function CommandCenterBrain({ jobId, onReset }: { jobId: string | null; onReset: () => void }) {
  const [config, setConfig] = useState<any>({})
  const [metrics, setMetrics] = useState<any>({})
  const [jobs, setJobs] = useState<any[]>([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setConfig(await fetchSystemConfig())
    setMetrics(await fetchMetrics())
    setJobs(await fetchJobs())
  }

  return (
    <div id="command-center-brain" className="p-6 space-y-6 font-sans text-stone-900 bg-stone-50 h-full overflow-y-auto">
      <header className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-stone-950 uppercase italic">Intelligence Hub</h1>
        <p className="font-serif italic text-stone-500 text-xs mt-1">Real-time system state & AI orchestration</p>
      </header>

      {/* SYSTEM CONFIG */}
      <section id="system-config" className="border border-stone-200 p-4 rounded-xl bg-white shadow-sm">
        <h2 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-4">Core Model Configuration</h2>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="model-select" className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Active Engine</label>
          <select
            id="model-select"
            className="bg-stone-50 border border-stone-200 p-2 rounded-lg text-[11px] font-medium w-32 shadow-sm focus:ring-1 focus:ring-stone-400 focus:outline-none"
            value={config.model}
            onChange={(e) =>
              updateSystemConfig({ model: e.target.value })
            }
          >
            <option value="gemini-1.5-pro">Gemini Pro</option>
            <option value="gemini-1.5-flash">Gemini Flash</option>
          </select>
        </div>
      </section>

      {/* METRICS */}
      <section id="metrics" className="border border-stone-200 p-4 rounded-xl bg-white shadow-sm">
        <h2 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-4">Network Ingress & Compute</h2>
        <div className="grid grid-cols-2 gap-4 font-mono">
            <div className="border-r border-stone-100 pr-2">
                <span className="block text-[9px] uppercase tracking-widest text-stone-400 mb-1">Tokens Synthesis</span>
                <span className="text-xl font-bold tracking-tighter tabular-nums text-stone-800">{metrics.totalTokens?.toLocaleString() || 0}</span>
            </div>
            <div className="pl-2">
                <span className="block text-[9px] uppercase tracking-widest text-stone-400 mb-1">API Handshakes</span>
                <span className="text-xl font-bold tracking-tighter tabular-nums text-stone-800">{metrics.totalRequests || 0}</span>
            </div>
        </div>
      </section>

      {/* JOBS */}
      <section id="jobs" className="border border-stone-200 p-4 rounded-xl bg-white shadow-sm overflow-hidden">
        <h2 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-4">Pipeline Status</h2>
        <div className="space-y-3 max-h-[300px] overflow-y-auto disable-scrollbars">
            {jobs.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-stone-200 rounded-lg">
                <p className="text-[10px] text-stone-400 italic">No active synthesis pipelines.</p>
              </div>
            ) : jobs.map((job) => (
            <div key={job.id} id={`job-${job.id}`} className="data-row flex flex-col gap-2 border-b border-stone-50 pb-3 last:border-b-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-stone-400">#ORD-{job.id.substring(0, 6)}</span>
                  <span className={cn(
                    "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                    job.status === 'completed' ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-600"
                  )}>{job.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  <progress className="flex-1 h-1 rounded-full overflow-hidden bg-stone-100 accent-stone-900" value={job.progress} max="100" />
                  <span className="text-[10px] font-bold tabular-nums">{job.progress}%</span>
                </div>
            </div>
            ))}
        </div>
      </section>
    </div>
  )
}
