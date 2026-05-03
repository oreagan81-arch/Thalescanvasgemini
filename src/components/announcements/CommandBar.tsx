import { Sparkles, Terminal, Loader2, Command } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import { commandParser } from '../../lib/commandParser';
import { useState, useRef, useEffect } from 'react';

const COMMON_COMMANDS = [
  'Math Test',
  'Reading Test',
  'Grammar Quiz',
  'Spelling Test',
  'Science Quiz',
  'History Assessment',
  'Weekly Update'
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface CommandBarProps {
  command: string;
  setCommand: (cmd: string) => void;
  onRun: (cmd: string) => void;
  loading: boolean;
  chips: string[];
}

export function CommandBar({ command, setCommand, onRun, loading, chips }: CommandBarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const intent = commandParser.parse(command);
  const parsed = commandParser.getLegacyMetadata(intent);

  // Simple auto-suggestion logic
  const suggestions = command.length > 1 
    ? COMMON_COMMANDS.flatMap(base => 
        DAYS.map(day => `${base} ${day}`)
      ).filter(s => s.toLowerCase().includes(command.toLowerCase()) && s.toLowerCase() !== command.toLowerCase()).slice(0, 5)
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3" ref={containerRef}>
      <Card className="rounded-xl border border-white/10 bg-white/5 p-1 px-4 relative group focus-within:border-amber-500/50 transition-all z-30">
        <div className="flex items-center gap-3 h-12">
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-black/40 border border-white/5">
            <span className="text-lg">{parsed.icon}</span>
            <span className={cn("text-[10px] font-bold uppercase tracking-widest", parsed.color.split(' ')[0])}>
              {parsed.subject}
            </span>
          </div>
          <Input 
            value={command}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setCommand(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRun(command);
                setShowSuggestions(false);
              }
            }}
            placeholder="Ask Owen OS: e.g. 'Math Test 18 Friday'"
            className="bg-transparent border-0 text-sm focus-visible:ring-0 text-white placeholder:text-slate-600 h-full flex-1"
          />
          <Button 
            onClick={() => {
              onRun(command);
              setShowSuggestions(false);
            }}
            disabled={!command || loading}
            className="bg-amber-500 text-black hover:bg-amber-400 font-bold h-8 rounded-lg shadow-lg shadow-amber-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
            {loading ? 'Processing...' : 'Apply Logic'}
          </Button>
        </div>

        {/* Instant Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-[#0d0d10] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest px-3 py-1 mb-1">Owen OS Intelligent completion</p>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCommand(s);
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Command className="w-3 h-3 text-slate-600 group-hover:text-amber-500" />
                  <span className="text-sm text-slate-300 group-hover:text-white">{s}</span>
                </div>
                <span className="text-[10px] text-slate-600 group-hover:text-amber-500 font-mono">TAB</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mr-2 shrink-0">Shortcuts:</span>
        {chips.map(chip => (
          <button 
            key={chip}
            onClick={() => setCommand(chip)}
            className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-medium text-slate-400 hover:text-white hover:border-white/20 transition-all shrink-0"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
