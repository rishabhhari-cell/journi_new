/**
 * AuthContext — lightweight client-side auth
 * Stores users in localStorage (demo only — not for production).
 * Swap signIn / signUp implementations for real API calls when ready.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  provider: 'local' | 'google';
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  openModal: (view?: 'signin' | 'signup') => void;
  closeModal: () => void;
  modalOpen: boolean;
  modalView: 'signin' | 'signup';
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'journi_auth_user';
const ACCOUNTS_KEY = 'journi_accounts';

function makeInitials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type StoredAccount = { id: string; name: string; email: string; passwordHash: string };

// Minimal hash — demo only, not cryptographically secure
async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password + 'journi_salt')
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'signin' | 'signup'>('signin');

  // Restore session
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  const persistUser = (u: AuthUser) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const getAccounts = (): StoredAccount[] => {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const accounts = getAccounts();
    if (accounts.find((a) => a.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const passwordHash = await hashPassword(password);
    const newAccount: StoredAccount = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase(),
      passwordHash,
    };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, newAccount]));
    persistUser({
      id: newAccount.id,
      name,
      email: newAccount.email,
      initials: makeInitials(name),
      provider: 'local',
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const accounts = getAccounts();
    const account = accounts.find((a) => a.email === email.toLowerCase());
    if (!account) throw new Error('No account found with that email.');
    const hash = await hashPassword(password);
    if (hash !== account.passwordHash) throw new Error('Incorrect password.');
    persistUser({
      id: account.id,
      name: account.name,
      email: account.email,
      initials: makeInitials(account.name),
      provider: 'local',
    });
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const openModal = useCallback((view: 'signin' | 'signup' = 'signin') => {
    setModalView(view);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signIn, signUp, signOut, openModal, closeModal, modalOpen, modalView }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
