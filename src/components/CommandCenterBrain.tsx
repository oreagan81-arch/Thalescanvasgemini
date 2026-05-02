import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BrainCircuit, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Terminal,
  Activity,
  X
} from 'lucide-react';
import { useJob, JobState } from '../hooks/useJob';
import { cn } from '@/lib/utils';

interface CommandCenterBrainProps {
  jobId: string | null;
  onComplete?: (result: any) => void;
  onReset?: () => void;
}

export function CommandCenterBrain({ jobId, onComplete, onReset }: CommandCenterBrainProps) {
  const { job, loading } = useJob(jobId);

  React.useEffect(() => {
    if (job?.status === 'completed' && onComplete) {
      onComplete(job.result);
    }
  }, [job?.status]);

  if (!jobId) return null;

  const getStatusText = (status: JobState['status']) => {
    switch (status) {
      case 'pending': return 'Enqueuing Command...';
      case 'processing': return 'Brain Active: Processing...';
      case 'completed': return 'Synthesis Complete';
      case 'failed': return 'Neural Deficit Detected';
      default: return 'Brain Offline';
    }
  };

  const status = job?.status || 'pending';
  const progress = job?.progress || 0;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed bottom-8 right-8 z-[100] w-80 bg-[#09090b]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header Area */}
      <div className={cn(
        "p-4 border-b border-white/5 flex items-center justify-between",
        status === 'completed' ? "bg-emerald-500/10" : 
        status === 'failed' ? "bg-red-500/10" : "bg-amber-500/10"
      )}>
        <div className="flex items-center gap-2">
          {status === 'processing' ? (
            <div className="relative">
              <BrainCircuit className="w-5 h-5 text-amber-500 animate-pulse" />
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-amber-500 rounded-full"
              />
            </div>
          ) : status === 'completed' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : status === 'failed' ? (
            <AlertCircle className="w-5 h-5 text-red-500" />
          ) : (
            <Zap className="w-5 h-5 text-slate-400" />
          )}
          <span className="text-xs font-bold uppercase tracking-widest text-slate-200">
            {status === 'processing' ? 'Brain Computing' : 'Command Pulse'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'completed' && (
            <button onClick={onReset} className="p-1 hover:bg-white/10 rounded">
               <X className="w-3 h-3 text-slate-500 hover:text-white" />
            </button>
          )}
          {status === 'failed' && (
            <button onClick={onReset} className="text-red-500 hover:text-red-400 text-[10px] uppercase font-bold tracking-tighter">
              Reset Brain
            </button>
          )}
        </div>
      </div>

      {/* Body Area */}
      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-white">{getStatusText(status)}</h4>
          <p className="text-[10px] text-slate-500 font-mono tracking-tight leading-relaxed">
            {status === 'processing' ? 'Aggregating pacing markers and validating against Thales rules engine v1.4.' : 
             status === 'failed' ? `Error trace: ${job?.error || 'Unknown neuronal misfire'}` : 
             'Awaiting next command stream or finalizing sequence.'}
          </p>
        </div>

        {/* Progress Bar */}
        {(status === 'processing' || status === 'pending') && (
          <div className="space-y-2">
             <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-400">NEURAL LOAD</span>
                <span className="text-amber-500">{progress}%</span>
             </div>
             <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${progress}%` }}
                   className="h-full bg-amber-500"
                />
             </div>
          </div>
        )}

        {/* Activity Log (Simulated brain noise) */}
        <div className="bg-black/40 rounded-lg p-3 border border-white/5 font-mono text-[9px] text-slate-500 h-24 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1 text-slate-400">
              <Terminal className="w-3 h-3" />
              <span>LOGSTREAM_01</span>
            </div>
            <div className="space-y-1">
               {status === 'processing' && (
                 <>
                   <div className="flex items-center gap-2">
                     <span className="text-amber-500/50">→</span>
                     <span className="animate-pulse">Analyzing raw text blocks...</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-amber-500/50">→</span>
                     <span>Mapping to GRADE_4A_PACING...</span>
                   </div>
                   {progress > 50 && (
                     <div className="flex items-center gap-2">
                       <span className="text-amber-500/50">→</span>
                       <span>Finalizing CidiLabs HTML...</span>
                     </div>
                   )}
                 </>
               )}
               {status === 'completed' && <div className="text-emerald-500">SEQUENCE_SUCCESS: Result cached.</div>}
               {status === 'failed' && <div className="text-red-500">FATAL_ERROR_DUMP: Process aborted.</div>}
               {status === 'pending' && <div>IDLE: Awaiting pipeline slot.</div>}
            </div>
        </div>
      </div>

      {/* Decorative Pulse Line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent">
         <motion.div 
           animate={{ x: ['-100%', '100%'] }}
           transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
           className="w-1/3 h-full bg-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
         />
      </div>
    </motion.div>
  );
}
