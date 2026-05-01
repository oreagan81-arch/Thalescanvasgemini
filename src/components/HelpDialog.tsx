import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HelpCircle } from "lucide-react"

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" className="w-10 h-10 lg:w-full flex lg:justify-start lg:px-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-md">
            <HelpCircle className="h-[18px] w-[18px]" />
            <span className="ml-3 hidden lg:block text-sm font-medium">Getting Started</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thales Academy OS Guide</DialogTitle>
          <DialogDescription>
            Follow these steps to post your curriculum to Canvas seamlessly.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
            <li><strong>Planner:</strong> Ensure your curriculum for the week is mapped in the Planner.</li>
            <li><strong>Syllabus/Canvas Pages:</strong> Review and refine generated pages.</li>
            <li><strong>Assignment Sync:</strong> Trigger the assignment sync to populate Canvas.</li>
            <li><strong>Announcements:</strong> Draft and preview your weekly announcement.</li>
            <li><strong>Deploy:</strong> Ensure everything is synced, then publish via Canvas.</li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  )
}
