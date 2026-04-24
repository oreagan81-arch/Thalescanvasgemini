import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { ShieldAlert, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="h-20 w-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center shadow-2xl">
        <ShieldAlert className="h-10 w-10 text-red-500" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold tracking-tight text-white">System Exception Detected</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          The Thales OS runtime encountered a critical logic failure. The error has been logged for audit.
        </p>
        <pre className="mt-4 p-4 bg-black/40 border border-white/5 rounded-xl text-[10px] font-mono text-red-400/70 overflow-auto text-left whitespace-pre-wrap">
          {error.message}
        </pre>
      </div>
      <Button 
        onClick={resetErrorBoundary}
        className="bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 px-8"
      >
        <RefreshCcw className="w-4 h-4 mr-2" />
        Restart Terminal
      </Button>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: import('react').ReactNode }) {
  return (
    <ReactErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset the state of your app so the error doesn't happen again
        window.location.reload();
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
