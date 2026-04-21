import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export function CanvasPages() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Canvas Pages</h1>
        <p className="text-slate-400">Generate and preview weekly agenda pages for Canvas LMS.</p>
      </div>
      <Card className="rounded-xl border border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Page Builder - Week 24</CardTitle>
          <CardDescription className="text-slate-400">Deploy your weekly agenda safely.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed border-white/10 bg-black/20 rounded-lg text-slate-500 font-medium">
            Preview will appear here
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
