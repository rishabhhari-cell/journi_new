import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ApiSession, ApiUser, OrganizationMembershipDTO } from '@shared/backend';
import {
  apiFetch,
  apiFetchNoAuth,
  clearStoredSession,
  getStoredSession,
  setStoredSession,
} from '@/lib/api/client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  provider: 'local' | 'google';
}

interface AuthContextType {
  user: AuthUser | null;
  memberships: OrganizationMembershipDTO[];
  activeOrganization: OrganizationMembershipDTO | null;
  activeOrganizationId: string | null;
  setActiveOrganizationId: (organizationId: string) => void;
  isLoading: boolean;
  isTrial: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  startOAuth: (provider?: 'google') => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
  openModal: (view?: 'signin' | 'signup') => void;
  closeModal: () => void;
  modalOpen: boolean;
  modalView: 'signin' | 'signup';
}

const AuthContext = createContext<AuthContextType | null>(null);
const USER_STORAGE_KEY = 'journi_auth_user';
const ORG_STORAGE_KEY = 'journi_active_org_id';

function makeInitials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function toAuthUser(user: ApiUser): AuthUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    initials: user.initials || makeInitials(user.fullName),
    provider: user.provider === 'google' ? 'google' : 'local',
  };
}

function persistUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function readPersistedUser(): AuthUser | null {
  try {
    const value = localStorage.getItem(USER_STORAGE_KEY);
    if (!value) return null;
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}

function parseOAuthHash(): ApiSession | null {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresAtRaw = params.get('expires_at');

  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAtRaw ? Number(expiresAtRaw) : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readPersistedUser);
  const [memberships, setMemberships] = useState<OrganizationMembershipDTO[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(() => {
    return localStorage.getItem(ORG_STORAGE_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTrial, setIsTrial] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'signin' | 'signup'>('signin');

  const hydrateFromSession = useCallback(async (session: ApiSession) => {
    const me = await apiFetch<{ user: ApiUser; memberships?: OrganizationMembershipDTO[] }>('/auth/me', {
      method: 'GET',
      token: session.accessToken,
    });
    const nextUser = toAuthUser(me.user);
    const nextMemberships = me.memberships ?? [];
    const storedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
    const preferredOrgId =
      storedOrgId && nextMemberships.some((membership) => membership.organizationId === storedOrgId)
        ? storedOrgId
        : nextMemberships[0]?.organizationId ?? null;

    setStoredSession(session);
    setUser(nextUser);
    setMemberships(nextMemberships);
    setActiveOrganizationIdState(preferredOrgId);
    if (preferredOrgId) {
      localStorage.setItem(ORG_STORAGE_KEY, preferredOrgId);
    } else {
      localStorage.removeItem(ORG_STORAGE_KEY);
    }
    persistUser(nextUser);
    setIsTrial(false);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const oauthSession = parseOAuthHash();
        if (oauthSession) {
          await hydrateFromSession(oauthSession);
          // Session stored — redirect to dashboard (clears the hash fragment too)
          window.location.replace('/dashboard');
          return;
        }

        const existingSession = getStoredSession();
        if (existingSession?.accessToken) {
          try {
            await hydrateFromSession(existingSession);
            return;
          } catch {
            if (existingSession.refreshToken) {
              const refreshed = await apiFetchNoAuth<{ session: ApiSession; user: ApiUser | null }>('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refreshToken: existingSession.refreshToken }),
              });
              if (refreshed.session?.accessToken) {
                await hydrateFromSession(refreshed.session);
                return;
              }
            }
          }
        }

        const persistedUser = readPersistedUser();
        if (persistedUser) {
          setUser(persistedUser);
        }
      } catch {
        clearStoredSession();
        persistUser(null);
        setMemberships([]);
        setActiveOrganizationIdState(null);
        localStorage.removeItem(ORG_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [hydrateFromSession]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const response = await apiFetchNoAuth<{ user: ApiUser; session: ApiSession | null }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        fullName: name,
        email,
        password,
      }),
    });

    const nextUser = toAuthUser(response.user);
    setUser(nextUser);
    persistUser(nextUser);
    setIsTrial(false);
    if (response.session) {
      await hydrateFromSession(response.session);
    } else {
      setMemberships([]);
      setActiveOrganizationIdState(null);
      localStorage.removeItem(ORG_STORAGE_KEY);
    }
  }, [hydrateFromSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await apiFetchNoAuth<{ user: ApiUser; session: ApiSession | null }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const nextUser = toAuthUser(response.user);
    setUser(nextUser);
    persistUser(nextUser);
    setIsTrial(false);
    if (response.session) {
      await hydrateFromSession(response.session);
    }
  }, [hydrateFromSession]);

  const startOAuth = useCallback(async (provider: 'google' = 'google') => {
    const response = await apiFetchNoAuth<{ url: string }>('/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        redirectTo: `${window.location.origin}/`,
      }),
    });
    window.location.assign(response.url);
  }, []);

  const updateProfile = useCallback(async (name: string) => {
    const response = await apiFetch<{ user: ApiUser }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ fullName: name }),
    });
    const nextUser = toAuthUser(response.user);
    setUser(nextUser);
    persistUser(nextUser);
  }, []);

  const signInAsGuest = useCallback(() => {
    const guest: AuthUser = {
      id: 'guest',
      name: 'Trial User',
      email: 'trial@journi.app',
      initials: 'TU',
      provider: 'local',
    };
    clearStoredSession();
    setUser(guest);
    setMemberships([]);
    setActiveOrganizationIdState(null);
    localStorage.removeItem(ORG_STORAGE_KEY);
    setIsTrial(true);
    persistUser(guest);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/auth/signout', { method: 'POST' });
    } catch {
      // Ignore network/signout failures and clear local state.
    } finally {
      clearStoredSession();
      persistUser(null);
      setUser(null);
      setMemberships([]);
      setActiveOrganizationIdState(null);
      localStorage.removeItem(ORG_STORAGE_KEY);
      // Clear project data so next session starts fresh
      localStorage.removeItem('journi_projects');
      localStorage.removeItem('journi_active_project_id');
      localStorage.removeItem('journi_activities');
      localStorage.removeItem('journi_project_overlays');
      setIsTrial(false);
    }
  }, []);

  const setActiveOrganizationId = useCallback((organizationId: string) => {
    setActiveOrganizationIdState(organizationId);
    localStorage.setItem(ORG_STORAGE_KEY, organizationId);
  }, []);

  const activeOrganization =
    memberships.find((membership) => membership.organizationId === activeOrganizationId) ??
    memberships[0] ??
    null;

  const openModal = useCallback((view: 'signin' | 'signup' = 'signin') => {
    setModalView(view);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeOrganization,
        activeOrganizationId: activeOrganization?.organizationId ?? null,
        setActiveOrganizationId,
        isLoading,
        isTrial,
        signIn,
        signUp,
        startOAuth,
        updateProfile,
        signInAsGuest,
        signOut,
        openModal,
        closeModal,
        modalOpen,
        modalView,
      }}
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
