export interface Intent {
  action: 'create' | 'regenerate' | 'update' | 'delete' | 'audit' | 'sync' | 'unknown';
  subject?: string;
  day?: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  modifiers: string[];
  raw: string;
}

export const commandParser = {
  /**
   * INTENT ENGINE: Transforms natural language into structured actions.
   * High-speed deterministic extraction for real-time UI mapping.
   */
  parse: (text: string): Intent => {
    const raw = text.trim();
    const clean = raw.toLowerCase();
    
    const intent: Intent = {
      action: 'unknown',
      modifiers: [],
      raw: raw
    };

    // 1. Action Extraction
    if (clean.includes('regenerate') || clean.includes('rewrite') || clean.includes('redo')) {
      intent.action = 'regenerate';
    } else if (clean.includes('sync') || clean.includes('push') || clean.includes('deploy')) {
      intent.action = 'sync';
    } else if (clean.includes('audit') || clean.includes('check') || clean.includes('validate')) {
      intent.action = 'audit';
    } else if (clean.includes('create') || clean.includes('add') || clean.includes('new')) {
      intent.action = 'create';
    } else if (clean.includes('update') || clean.includes('fix') || clean.includes('change')) {
      intent.action = 'update';
    } else if (clean.includes('delete') || clean.includes('remove') || clean.includes('clear')) {
      intent.action = 'delete';
    }

    // 2. Day Extraction
    const days: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday')[] = 
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    for (const d of days) {
      if (clean.includes(d.toLowerCase())) {
        intent.day = d;
        break;
      }
    }

    // 3. Subject Extraction
    const subjects = ['math', 'reading', 'spelling', 'grammar', 'english', 'history', 'science', 'shurley', 'social studies'];
    for (const s of subjects) {
      if (clean.includes(s)) {
        intent.subject = s.charAt(0).toUpperCase() + s.slice(1);
        break;
      }
    }

    // 4. Modifier Extraction
    if (clean.includes('rigor') || clean.includes('harder') || clean.includes('advanced')) {
      intent.modifiers.push('increase_rigor');
    }
    if (clean.includes('simple') || clean.includes('easier') || clean.includes('remedial')) {
      intent.modifiers.push('decrease_complexity');
    }
    if (clean.includes('fast') || clean.includes('quick')) {
      intent.modifiers.push('speed_optimized');
    }
    if (clean.includes('creative') || clean.includes('fun')) {
      intent.modifiers.push('creative_flair');
    }

    return intent;
  },

  /**
   * LEGACY COMPATIBILITY: Map intent back to visual metadata.
   */
  getLegacyMetadata: (intent: Intent) => {
    const subject = intent.subject || 'Custom';
    
    if (subject === 'Math') {
      return { subject: 'Math', icon: '➗', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Mathematics' };
    }
    if (subject === 'Reading') {
       return { subject: 'Reading', icon: '📚', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Literacy' };
    }
    // ... other mappings can be added as needed
    return { subject, icon: '✨', color: 'text-slate-400 bg-white/5 border-white/10', label: subject };
  }
};
