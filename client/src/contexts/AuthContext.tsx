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
import { acceptOrganizationInvite, requestPasswordReset, resendVerificationEmail } from '@/lib/api/backend';
import { supabaseBrowser } from '@/lib/supabase-browser';

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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ requiresEmailVerification: boolean; verificationEmailSent: boolean; verificationRetryScheduled: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ sent: boolean; alreadyVerified: boolean }>;
  startOAuth: (provider?: 'google') => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  signOut: () => void;
  openModal: (view?: 'signin' | 'signup' | 'forgot' | 'verify') => void;
  closeModal: () => void;
  modalOpen: boolean;
  modalView: 'signin' | 'signup' | 'forgot' | 'verify';
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

function clearLocalWorkspaceData() {
  // journi_projects is no longer cached in localStorage — projects always load from backend.
  // journi_active_project_id is kept intentionally so the last-selected project survives a refresh.
  localStorage.removeItem('journi_activities');
  localStorage.removeItem('journi_manuscripts');
  localStorage.removeItem('journi_manuscript');
  localStorage.removeItem('journi_submissions');
  localStorage.removeItem('journi_project_overlays');
  localStorage.removeItem('journi_preloaded_api_projects');
}

function readPersistedUser(): AuthUser | null {
  try {
    const value = localStorage.getItem(USER_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as AuthUser;
    if (parsed?.id === 'guest' || parsed?.email === 'trial@journi.app') {
      localStorage.removeItem(USER_STORAGE_KEY);
      clearLocalWorkspaceData();
      return null;
    }
    return parsed;
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'signin' | 'signup' | 'forgot' | 'verify'>('signin');

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
      const accepted = await acceptOrganizationInvite(inviteToken);
      localStorage.removeItem(PENDING_INVITE_KEY);
      const me = await apiFetch<{ user: ApiUser; memberships?: OrganizationMembershipDTO[] }>('/auth/me', {
        method: 'GET',
      });
      const nextMemberships = me.memberships ?? [];
      setMemberships(nextMemberships);

      const invitedOrgId = accepted.organizationId;
      const resolvedOrgId =
        invitedOrgId && nextMemberships.some((membership) => membership.organizationId === invitedOrgId)
          ? invitedOrgId
          : nextMemberships[0]?.organizationId ?? null;

      setActiveOrganizationIdState(resolvedOrgId);
      if (resolvedOrgId) {
        localStorage.setItem(ORG_STORAGE_KEY, resolvedOrgId);
      } else {
        localStorage.removeItem(ORG_STORAGE_KEY);
      }
    } catch {
      // Keep token for later retry after next authenticated bootstrap.
    }
  }, []);

  const hydrateFromSession = useCallback(async (session: ApiSession) => {
    // Store the session first so the signOut guard below works correctly even on
    // fresh OAuth logins where no session was previously stored.
    setStoredSession(session);
    const me = await apiFetch<{ user: ApiUser; memberships?: OrganizationMembershipDTO[] }>('/auth/me', {
      method: 'GET',
      token: session.accessToken,
    });
    // If signOut was called while the request was in-flight, discard the result.
    if (!getStoredSession()) return;
    const nextUser = toAuthUser(me.user);
    const nextMemberships = me.memberships ?? [];
    const storedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
    const preferredOrgId =
      storedOrgId && nextMemberships.some((membership) => membership.organizationId === storedOrgId)
        ? storedOrgId
        : nextMemberships[0]?.organizationId ?? null;

    setUser(nextUser);
    setMemberships(nextMemberships);
    setActiveOrganizationIdState(preferredOrgId);
    if (preferredOrgId) {
      localStorage.setItem(ORG_STORAGE_KEY, preferredOrgId);
    } else {
      localStorage.removeItem(ORG_STORAGE_KEY);
    }
    persistUser(nextUser);
  }, []);

  useEffect(() => {
    // One-time migration: remove the old project localStorage cache that is no longer used.
    localStorage.removeItem('journi_projects');
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
          // Client-side navigation — keeps React tree (and GlobalLoadingOverlay) mounted.
          window.dispatchEvent(new CustomEvent('journi:navigate', { detail: { path: '/dashboard' } }));
          return;
        }

        const oauthHash = parseOAuthHash();
        if (oauthHash) {
          await hydrateFromSession(oauthHash.session);
          await acceptPendingInvite();
          const isRecovery = oauthHash.type === 'recovery';
          if (isRecovery) {
            window.history.replaceState({}, document.title, '/reset-password');
            return;
          }
          window.dispatchEvent(new CustomEvent('journi:navigate', { detail: { path: '/dashboard' } }));
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
      clearLocalWorkspaceData();
      setUser(nextUser);
      persistUser(nextUser);
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
        verificationEmailSent?: boolean;
        verificationRetryScheduled?: boolean;
      }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ fullName: name, email, password }),
      });

      if (response.requiresEmailVerification || !response.session) {
        return {
          requiresEmailVerification: true,
          verificationEmailSent: response.verificationEmailSent ?? true,
          verificationRetryScheduled: response.verificationRetryScheduled ?? false,
        };
      }

      applyAuthResponse(toAuthUser(response.user), response.session, response.memberships, response.projects);
      await acceptPendingInvite();
      return { requiresEmailVerification: false, verificationEmailSent: true, verificationRetryScheduled: false };
    } finally {
      setIsAuthenticating(false);
    }
  }, [acceptPendingInvite, applyAuthResponse]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true);
    try {
    // Call Supabase directly from the browser — no Railway round-trip.
    // This completes in ~150ms vs 1-3s through the backend.
    const { data, error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new Error(error?.message ?? 'Invalid credentials');
    }

    const { user: sbUser, session: sbSession } = data;
    const fullName: string =
      sbUser.user_metadata?.full_name ??
      sbUser.user_metadata?.name ??
      sbUser.email ??
      'User';

    const nextUser = toAuthUser({
      id: sbUser.id,
      email: sbUser.email!,
      fullName,
      initials: makeInitials(fullName),
      provider: (sbUser.app_metadata?.provider === 'google' ? 'google' : 'local') as ApiUser['provider'],
    });

    const session: ApiSession = {
      accessToken: sbSession.access_token,
      refreshToken: sbSession.refresh_token,
      expiresAt: sbSession.expires_at ?? null,
    };

    clearLocalWorkspaceData();
    setStoredSession(session);
    setUser(nextUser);
    persistUser(nextUser);
    setIsLoading(false);

    // Await memberships so activeOrganizationId is set before isAuthenticating→false.
    // Without this, ProjectContext sees backendMode=false on the first render and the
    // GlobalLoadingOverlay completes prematurely, then restarts when the org ID arrives.
    try {
      const me = await apiFetch<{ user: ApiUser; memberships?: OrganizationMembershipDTO[] }>('/auth/me', {
        method: 'GET',
        token: session.accessToken,
      });
      if (getStoredSession()) {
        const nextMemberships = me.memberships ?? [];
        setMemberships(nextMemberships);
        const storedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
        const preferredOrgId =
          storedOrgId && nextMemberships.some((m) => m.organizationId === storedOrgId)
            ? storedOrgId
            : nextMemberships[0]?.organizationId ?? null;
        setActiveOrganizationIdState(preferredOrgId);
        if (preferredOrgId) localStorage.setItem(ORG_STORAGE_KEY, preferredOrgId);
      }
    } catch {
      // If /auth/me fails the user can still use the app with the cached org ID from localStorage.
    }

    await acceptPendingInvite();
    } finally {
      setIsAuthenticating(false);
    }
  }, [acceptPendingInvite]);

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

  const resendVerificationEmailAction = useCallback(async (email: string) => {
    const response = await resendVerificationEmail(email);
    return {
      sent: response.sent,
      alreadyVerified: response.alreadyVerified,
    };
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

  const signOut = useCallback(() => {
    // Clear all local state synchronously — navigation happens immediately.
    clearStoredSession();
    persistUser(null);
    setUser(null);
    setMemberships([]);
    setActiveOrganizationIdState(null);
    localStorage.removeItem(ORG_STORAGE_KEY);
    localStorage.removeItem('journi_preloaded_api_projects');
    clearLocalWorkspaceData();

    // Invalidate the session on the server in the background.
    apiFetch('/auth/signout', { method: 'POST' }).catch(() => {});
  }, []);

  const setActiveOrganizationId = useCallback((organizationId: string) => {
    setActiveOrganizationIdState(organizationId);
    localStorage.setItem(ORG_STORAGE_KEY, organizationId);
  }, []);

  const activeOrganization =
    memberships.find((membership) => membership.organizationId === activeOrganizationId) ??
    memberships[0] ??
    null;

  const openModal = useCallback((view: 'signin' | 'signup' | 'forgot' | 'verify' = 'signin') => {
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
        signIn,
        signUp,
        requestPasswordReset: requestPasswordResetAction,
        resendVerificationEmail: resendVerificationEmailAction,
        startOAuth,
        updateProfile,
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
