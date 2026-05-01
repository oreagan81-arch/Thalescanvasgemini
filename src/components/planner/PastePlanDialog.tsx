import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clipboard } from "lucide-react";

interface PastePlanDialogProps {
  onPaste: (text: string) => void;
}

export function PastePlanDialog({ onPaste }: PastePlanDialogProps) {
  const [text, setText] = useState('');

  const handlePaste = () => {
    onPaste(text);
    setText('');
  };

  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 px-4 py-2 text-sm font-medium hover:bg-emerald-500/10 transition-colors">
          <Clipboard className="w-4 h-4 mr-2" />
          Paste Plan
        </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Paste Weekly Plan</DialogTitle>
          <DialogDescription>
            Paste the raw pacing guide text from your spreadsheet here.
          </DialogDescription>
        </DialogHeader>
        <textarea
          className="w-full h-64 p-2 bg-slate-950 border border-slate-700 text-slate-200 rounded-md text-sm"
          placeholder="Paste pacing guide text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <DialogFooter>
          <Button onClick={handlePaste}>Import Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
