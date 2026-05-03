export async function fetchSystemConfig() {
  const res = await fetch("/api/getSystemConfig")
  return res.json()
}

export async function updateSystemConfig(config: any) {
  await fetch("/api/updateSystemConfig", {
    method: "POST",
    body: JSON.stringify(config)
  })
}

export async function fetchMetrics() {
  const res = await fetch("/api/metrics")
  return res.json()
}

export async function fetchJobs() {
  const res = await fetch("/api/jobs")
  return res.json()
}
