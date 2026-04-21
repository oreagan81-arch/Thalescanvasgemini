import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export function Assignments() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Assignments</h1>
        <p className="text-slate-400">Create Canvas assignments based on deterministic rules.</p>
      </div>
      <Card className="rounded-xl border border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Assignment Generation</CardTitle>
          <CardDescription className="text-slate-400">Pending Assignments for Week 24</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border border-dashed border-white/10 bg-black/20 rounded-lg text-slate-500 font-medium">
            List of generated assignments
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
