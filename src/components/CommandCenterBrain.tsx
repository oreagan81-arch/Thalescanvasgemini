import { useEffect, useState } from "react"
import {
  fetchSystemConfig,
  updateSystemConfig,
  fetchMetrics,
  fetchJobs
} from "../services/service.controlPlane"

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
    <div id="command-center-brain" className="p-6 space-y-8 font-sans text-stone-900 bg-stone-50 min-h-screen">
      <header className="border-b border-stone-800 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tighter text-stone-950">Command Center</h1>
        <p className="font-serif italic text-stone-600 mt-1">Operational view and system control</p>
      </header>

      {/* SYSTEM CONFIG */}
      <section id="system-config" className="border border-stone-800 p-6 rounded-xl bg-white shadow-sm">
        <h2 className="font-serif italic text-xl opacity-70 mb-6">System Configuration</h2>
        <div className="flex items-center gap-6">
          <label htmlFor="model-select" className="text-sm font-semibold uppercase tracking-wider text-stone-500">Active AI Model</label>
          <select
            id="model-select"
            className="bg-white border border-stone-300 p-3 rounded-lg text-sm w-48 shadow-inner"
            value={config.model}
            onChange={(e) =>
              updateSystemConfig({ model: e.target.value })
            }
          >
            <option value="gemini-1.5-pro">Pro</option>
            <option value="gemini-1.5-flash">Flash</option>
          </select>
        </div>
      </section>

      {/* METRICS */}
      <section id="metrics" className="border border-stone-800 p-6 rounded-xl bg-white shadow-sm">
        <h2 className="font-serif italic text-xl opacity-70 mb-6">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-sm">
            <div className="border-b md:border-b-0 md:border-r border-stone-200 pb-4 md:pb-0">
                <span className="block text-xs uppercase tracking-widest text-stone-500 mb-1">Total Tokens</span>
                <span className="text-3xl font-bold">{metrics.totalTokens || 0}</span>
            </div>
            <div className="border-b md:border-b-0 md:border-r border-stone-200 pb-4 md:pb-0">
                <span className="block text-xs uppercase tracking-widest text-stone-500 mb-1">Total Requests</span>
                <span className="text-3xl font-bold">{metrics.totalRequests || 0}</span>
            </div>
            <div>
                <span className="block text-xs uppercase tracking-widest text-stone-500 mb-1">Cache Hit Rate</span>
                <span className="text-3xl font-bold">{metrics.cacheHits || 0}</span>
            </div>
        </div>
      </section>

      {/* JOBS */}
      <section id="jobs" className="border border-stone-800 p-6 rounded-xl bg-white shadow-sm">
        <h2 className="font-serif italic text-xl opacity-70 mb-6">Active Jobs</h2>
        <div className="space-y-4">
            {jobs.map((job) => (
            <div key={job.id} id={`job-${job.id}`} className="data-row flex items-center justify-between gap-6 border-b border-stone-100 py-3 last:border-b-0">
                <span className="font-mono text-xs text-stone-500">{job.id}</span>
                <span className="text-sm font-medium w-24">{job.status}</span>
                <progress className="w-full h-2 rounded-full overflow-hidden bg-stone-200 accent-stone-900" value={job.progress} max="100" />
            </div>
            ))}
        </div>
      </section>
    </div>
  )
}
