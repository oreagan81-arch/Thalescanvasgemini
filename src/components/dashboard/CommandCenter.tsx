import React, { useState } from 'react';
import { Search, Sparkles, Send } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStore } from '@/src/store';
import { useNavigate } from 'react-router-dom';

const SUGGESTIONS = ["Math Test", "Reading Test", "Weekly Update", "Science Quiz"];

export const CommandCenter: React.FC = React.memo(() => {
  const [query, setQuery] = useState('');
  const addRecentCommand = useStore((state) => state.addRecentCommand);
  const setLastUsedSubject = useStore((state) => state.setLastUsedSubject);
  const navigate = useNavigate();

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    // Persist to store
    addRecentCommand(query);
    
    // Simple heuristic for subject tracking
    if (query.toLowerCase().includes('math')) setLastUsedSubject('Math');
    else if (query.toLowerCase().includes('reading')) setLastUsedSubject('Reading');
    else if (query.toLowerCase().includes('science')) setLastUsedSubject('Science');

    // Route to announcements with the query
    navigate(`/announcements?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="relative group max-w-4xl mx-auto w-full">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200"></div>
      
      <form onSubmit={handleSubmit} className="relative bg-[#121216] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center px-6 py-5">
          <Search className="w-5 h-5 text-slate-500 mr-4" />
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Deploy automation... (e.g., 'Math Test 18 Friday')"
            className="flex-1 bg-transparent border-none text-xl font-light text-white placeholder:text-slate-600 focus:outline-none focus:ring-0"
          />
          <button 
            type="submit"
            className="p-2 bg-amber-500 rounded-lg text-black hover:bg-amber-400 transition-all ml-2"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 pb-6 pt-2 flex flex-wrap gap-2 items-center">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mr-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Suggested
          </span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => {
                setQuery(suggestion);
                // Optional: auto-submit suggestions or just set the query?
                // Let's just set it for better UX so they can add details.
              }}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
});
