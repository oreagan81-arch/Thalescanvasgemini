import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export function Resources() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Resource Brain</h1>
        <p className="text-slate-400">Intelligent file mapping engine synced with Canvas.</p>
      </div>
      <Card className="rounded-xl border border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">File Registry</CardTitle>
          <CardDescription className="text-slate-400">Current mappings and orphans.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed border-white/10 bg-black/20 rounded-lg text-slate-500 font-medium">
            Resource lists and mapping suggestions
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
