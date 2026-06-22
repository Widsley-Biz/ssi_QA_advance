import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Profile } from '../types';
import { supabase } from '../lib/supabase';
import { profiles as mockProfiles } from '../data/mockData';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  /** Mock login – only works in demo mode (no Supabase) */
  login: (userId: string) => void;
  /** Google OAuth – only works when Supabase is configured */
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
  const [loading, setLoading] = useState(!!supabase); // only loading when Supabase is active

  // --- Supabase mode helpers ------------------------------------------------

  const loadProfile = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();

    if (error) {
      console.error('Failed to load profile:', error.message);
      setUser(null);
    } else if (data) {
      setUser(data as unknown as Profile);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setUser(null);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // --- Auth actions ---------------------------------------------------------

  /** Mock login – demo mode only */
  const login = useCallback((userId: string) => {
    if (supabase) {
      console.warn('login() is for demo mode only. Use signInWithGoogle() instead.');
      return;
    }
    const found = mockProfiles.find((p) => p.id === userId);
    if (found) setUser(found);
  }, []);

  /** Google OAuth via Supabase */
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      console.warn('Supabase is not configured. Use login() for demo mode.');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) console.error('Google sign-in error:', error.message);
  }, []);

  /** Sign out – works in both modes */
  const signOut = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Sign-out error:', error.message);
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
