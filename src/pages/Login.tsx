import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { useState } from 'react';

export function Login() {
  const { user, signIn, isAllowedUser } = useAuth();
  const [error, setError] = useState('');

  if (user && isAllowedUser) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    try {
      setError('');
      await signIn();
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        setError('UNAUTHORIZED DOMAIN: Please add this URL to your Firebase Console "Authorized domains" list under Authentication > Settings.');
      } else {
        setError(err.message || 'Failed to sign in');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="h-12 w-12 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-2xl relative">
            <span className="text-xl font-bold text-black relative z-10">T</span>
          </div>
          <h2 className="text-3xl font-bold tracking-widest uppercase text-slate-100">
            Thales OS <span className="text-amber-500">v2</span>
          </h2>
          <p className="mt-2 text-[10px] uppercase font-bold tracking-widest text-slate-500">
            Enterprise Command Center
          </p>
        </div>

        <div className="bg-[#0d0d10] border border-white/10 p-8 rounded-2xl shadow-xl backdrop-blur-xl">
          <div className="space-y-6">
            <div className="space-y-2 text-center text-xs tracking-widest uppercase text-slate-500 font-bold mb-8">
              <p>Restricted Access System</p>
              <p>Authorized Personnel Only.</p>
            </div>
            
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[10px] uppercase font-bold text-center">
                {error}
              </div>
            )}
            
            {user && !isAllowedUser && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[10px] uppercase font-bold text-center">
                Access Denied: {user.email} is not authorized.
              </div>
            )}

            <Button 
              className="w-full bg-amber-500 text-black hover:bg-amber-400 font-bold" 
              size="lg"
              onClick={handleLogin}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
          </div>
        </div>
        
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-600">
          Built for Owen Reagan • Thales Academy
        </p>
      </div>
    </div>
  );
}
