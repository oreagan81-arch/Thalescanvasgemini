export interface ParsedCommand {
  subject: string;
  icon: string;
  color: string;
  label: string;
}

export const commandParser = {
  parse: (command: string): ParsedCommand => {
    const cmd = command.toLowerCase();
    
    if (cmd.includes('math')) {
      return { subject: 'Math', icon: '➗', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Mathematics' };
    }
    if (cmd.includes('reading')) {
      return { subject: 'Reading', icon: '📚', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Literacy' };
    }
    if (cmd.includes('shurley') || cmd.includes('english') || cmd.includes('grammar')) {
      return { subject: 'Shurley', icon: '📝', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Grammar' };
    }
    if (cmd.includes('spelling')) {
      return { subject: 'Spelling', icon: '✏️', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20', label: 'Spelling' };
    }
    if (cmd.includes('science')) {
      return { subject: 'Science', icon: '🔬', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', label: 'Science' };
    }
    if (cmd.includes('history') || cmd.includes('social studies')) {
      return { subject: 'History', icon: '🌎', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'History' };
    }
    if (cmd.includes('weekly') || cmd.includes('update')) {
      return { subject: 'Weekly Update', icon: '📅', color: 'text-white bg-white/5 border-white/10', label: 'General' };
    }

    return { subject: 'Custom', icon: '✨', color: 'text-slate-400 bg-white/5 border-white/10', label: 'Announcement' };
  }
};
