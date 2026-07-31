import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Profile } from '../types';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { fetchMe } from '../lib/data';
import { profiles as mockProfiles } from '../data/mockData';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  /** Mock login – only works in demo mode (no Identity Platform設定) */
  login: (userId: string) => void;
  /** Google OAuth – only works when Identity Platformが設定されている場合 */
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Alias kept for backward-compat with existing components */
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!auth); // only loading when Identity Platform is active

  // --- Identity Platform mode helpers ------------------------------------------------

  const loadProfile = useCallback(async () => {
    try {
      const profile = await fetchMe();
      setUser(profile);
    } catch (err) {
      console.error('Failed to load profile:', (err as Error).message);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await loadProfile();
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadProfile]);

  // --- Auth actions ---------------------------------------------------------

  /** Mock login – demo mode only */
  const login = useCallback((userId: string) => {
    if (auth) {
      console.warn('login() is for demo mode only. Use signInWithGoogle() instead.');
      return;
    }
    const found = mockProfiles.find((p) => p.id === userId);
    if (found) setUser(found);
  }, []);

  /** Google OAuth via Identity Platform */
  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      console.warn('Identity Platform is not configured. Use login() for demo mode.');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in error:', (err as Error).message);
    }
  }, []);

  /** Sign out – works in both modes */
  const signOut = useCallback(async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
  }, []);

  /** Alias for backward-compat */
  const logout = useCallback(() => {
    void signOut();
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signInWithGoogle, signOut, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
