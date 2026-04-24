import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  isAllowedUser: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
  isAllowedUser: false
});

export const useAuth = () => useContext(AuthContext);

const ALLOWED_EMAILS = [
  'owen.reagan@thalesacademy.org',
  'oreagan81@gmail.com'
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const isAllowedUser = !!user && !!user.email && ALLOWED_EMAILS.includes(user.email.toLowerCase());

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut, isAllowedUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
