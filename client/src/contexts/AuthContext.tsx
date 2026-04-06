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
import { acceptOrganizationInvite, requestPasswordReset } from '@/lib/api/backend';

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
  isAuthenticating: boolean;
  isTrial: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ requiresEmailVerification: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  startOAuth: (provider?: 'google') => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
  openModal: (view?: 'signin' | 'signup' | 'forgot') => void;
  closeModal: () => void;
  modalOpen: boolean;
  modalView: 'signin' | 'signup' | 'forgot';
}

const AuthContext = createContext<AuthContextType | null>(null);
const USER_STORAGE_KEY = 'journi_auth_user';
const ORG_STORAGE_KEY = 'journi_active_org_id';
const PENDING_INVITE_KEY = 'journi_pending_invite_token';

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

function parseOAuthHash(): { session: ApiSession; type: string | null } | null {
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
    session: {
      accessToken,
      refreshToken,
      expiresAt: expiresAtRaw ? Number(expiresAtRaw) : null,
    },
    type: params.get('type'),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readPersistedUser);
  const [memberships, setMemberships] = useState<OrganizationMembershipDTO[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(() => {
    return localStorage.getItem(ORG_STORAGE_KEY);
  });
  // Start not-loading if we already have a persisted user — bootstrap will silently re-validate
  const [isLoading, setIsLoading] = useState(() => readPersistedUser() === null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'signin' | 'signup' | 'forgot'>('signin');

  const stashInviteTokenFromUrl = useCallback(() => {
    const url = new URL(window.location.href);
    const inviteToken = url.searchParams.get('inviteToken');
    if (!inviteToken) return;
    localStorage.setItem(PENDING_INVITE_KEY, inviteToken);
    url.searchParams.delete('inviteToken');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const acceptPendingInvite = useCallback(async () => {
    const inviteToken = localStorage.getItem(PENDING_INVITE_KEY);
    if (!inviteToken) return;
    try {
      await acceptOrganizationInvite(inviteToken);
      localStorage.removeItem(PENDING_INVITE_KEY);
      const me = await apiFetch<{ user: ApiUser; memberships?: OrganizationMembershipDTO[] }>('/auth/me', {
        method: 'GET',
      });
      setMemberships(me.memberships ?? []);
    } catch {
      // Keep token for later retry after next authenticated bootstrap.
    }
  }, []);

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
        stashInviteTokenFromUrl();

        // PKCE OAuth callback — Supabase redirects back with ?code=
        const urlParams = new URLSearchParams(window.location.search);
        const oauthCode = urlParams.get('code');
        const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
        if (oauthCode && codeVerifier) {
          sessionStorage.removeItem('oauth_code_verifier');
          // Clear code from URL immediately
          window.history.replaceState({}, document.title, window.location.pathname);
          const exchanged = await apiFetchNoAuth<{ session: ApiSession }>('/auth/oauth/callback', {
            method: 'POST',
            body: JSON.stringify({ code: oauthCode, codeVerifier }),
          });
          await hydrateFromSession(exchanged.session);
          await acceptPendingInvite();
          window.location.replace('/dashboard');
          return;
        }

        const oauthHash = parseOAuthHash();
        if (oauthHash) {
          await hydrateFromSession(oauthHash.session);
          await acceptPendingInvite();
          const isRecovery = oauthHash.type === 'recovery';
          if (isRecovery) {
            window.history.replaceState({}, document.title, '/reset-password');
            setIsLoading(false);
            return;
          }
          // Session stored — redirect to dashboard (clears the hash fragment too)
          window.location.replace('/dashboard');
          return;
        }

        const existingSession = getStoredSession();
        if (existingSession?.accessToken) {
          try {
            await hydrateFromSession(existingSession);
            await acceptPendingInvite();
            return;
          } catch {
            if (existingSession.refreshToken) {
              const refreshed = await apiFetchNoAuth<{ session: ApiSession; user: ApiUser | null }>('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refreshToken: existingSession.refreshToken }),
              });
              if (refreshed.session?.accessToken) {
                await hydrateFromSession(refreshed.session);
                await acceptPendingInvite();
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
  }, [acceptPendingInvite, hydrateFromSession, stashInviteTokenFromUrl]);

  /** Apply user + session + memberships from a signin/signup response (no extra /auth/me call). */
  const applyAuthResponse = useCallback(
    (nextUser: AuthUser, session: ApiSession | null, responseMemberships?: OrganizationMembershipDTO[], responseProjects?: any[]) => {
      // Clear stale trial/sample project data so Dashboard never flashes old content
      localStorage.removeItem('journi_projects');
      localStorage.removeItem('journi_active_project_id');
      localStorage.removeItem('journi_activities');
      localStorage.removeItem('journi_project_overlays');

      setUser(nextUser);
      persistUser(nextUser);
      setIsTrial(false);
      setIsLoading(false);

      if (session) {
        setStoredSession(session);
      }

      const nextMemberships = responseMemberships ?? [];
      setMemberships(nextMemberships);

      if (responseProjects) {
        localStorage.setItem('journi_preloaded_api_projects', JSON.stringify(responseProjects));
      }

      const storedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
      const preferredOrgId =
        storedOrgId && nextMemberships.some((m) => m.organizationId === storedOrgId)
          ? storedOrgId
          : nextMemberships[0]?.organizationId ?? null;
      setActiveOrganizationIdState(preferredOrgId);
      if (preferredOrgId) {
        localStorage.setItem(ORG_STORAGE_KEY, preferredOrgId);
      } else {
        localStorage.removeItem(ORG_STORAGE_KEY);
      }
    },
    [],
  );

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setIsAuthenticating(true);
    try {
      const response = await apiFetchNoAuth<{
        user: ApiUser;
        session: ApiSession | null;
        memberships?: OrganizationMembershipDTO[];
        projects?: any[];
        requiresEmailVerification?: boolean;
      }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ fullName: name, email, password }),
      });

      if (response.requiresEmailVerification || !response.session) {
        return { requiresEmailVerification: true };
      }

      applyAuthResponse(toAuthUser(response.user), response.session, response.memberships, response.projects);
      await acceptPendingInvite();
      return { requiresEmailVerification: false };
    } finally {
      setIsAuthenticating(false);
    }
  }, [acceptPendingInvite, applyAuthResponse]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true);
    try {
      const response = await apiFetchNoAuth<{
        user: ApiUser;
        session: ApiSession | null;
        memberships?: OrganizationMembershipDTO[];
        projects?: any[];
      }>('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      applyAuthResponse(toAuthUser(response.user), response.session, response.memberships, response.projects);
      await acceptPendingInvite();
    } finally {
      setIsAuthenticating(false);
    }
  }, [acceptPendingInvite, applyAuthResponse]);

  const startOAuth = useCallback(async (provider: 'google' = 'google') => {
    const response = await apiFetchNoAuth<{ url: string; codeVerifier: string }>('/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        redirectTo: `${window.location.origin}/`,
      }),
    });
    // Store verifier so the callback can exchange the PKCE code for a session
    sessionStorage.setItem('oauth_code_verifier', response.codeVerifier);
    window.location.assign(response.url);
  }, []);

  const requestPasswordResetAction = useCallback(async (email: string) => {
    await requestPasswordReset(email);
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
      localStorage.removeItem('journi_preloaded_api_projects');
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

  const openModal = useCallback((view: 'signin' | 'signup' | 'forgot' = 'signin') => {
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
        activeOrganizationId: activeOrganization?.organizationId ?? activeOrganizationId ?? null,
        setActiveOrganizationId,
        isLoading,
        isAuthenticating,
        isTrial,
        signIn,
        signUp,
        requestPasswordReset: requestPasswordResetAction,
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
