import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export function Announcements() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Announcements</h1>
        <p className="text-slate-400">Generate parent-facing weekly communications.</p>
      </div>
      <Card className="rounded-xl border border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">AI Announcement Generator</CardTitle>
          <CardDescription className="text-slate-400">Draft content from Planner events.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed border-white/10 bg-black/20 rounded-lg text-slate-500 font-medium">
            Post drafting area
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
