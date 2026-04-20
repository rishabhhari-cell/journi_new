import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthModal from "./components/auth/AuthModal";
import LoadingScreen from "./components/LoadingScreen";
import { ProjectProvider, useProject } from "./contexts/ProjectContext";
import { JournalsProvider } from "./contexts/JournalsContext";
import { ManuscriptProvider } from "./contexts/ManuscriptContext";
import { SubmissionsProvider } from "./contexts/SubmissionsContext";
import Home from "./pages/Home";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Support from "./pages/Support";
import Dashboard from "./pages/Dashboard";
import Collaboration from "./pages/Collaboration";
import Discovery from "./pages/Discovery";
import Publication from "./pages/Publication";
import FormatPreview from "./pages/FormatPreview";
import Admin from "./pages/Admin";
import InternalAdmin from "./pages/InternalAdmin";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const anchorId = decodeURIComponent(hash.slice(1));
    const rafId = window.requestAnimationFrame(() => {
      const target = document.getElementById(anchorId);
      if (target) {
        target.scrollIntoView();
      } else {
        window.scrollTo(0, 0);
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [location]);
  return null;
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Page Not Found</h1>
        <a href="/" className="text-journi-green hover:underline text-sm">&lt;- Back to Home</a>
      </div>
    </div>
  );
}

/** Listens for the 'journi:navigate' custom event from AuthContext bootstrap
 *  and performs a client-side navigation so the React tree (and loading overlay)
 *  stays mounted across the OAuth -> dashboard transition. */
function PostAuthNavigator() {
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail.path;
      navigateRef.current(path, { replace: true });
    };
    window.addEventListener('journi:navigate', handler);
    return () => window.removeEventListener('journi:navigate', handler);
  }, []);

  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <PostAuthNavigator />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/features" component={Features} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/about" component={About} />
        <Route path="/support" component={Support} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/collaboration" component={Collaboration} />
        <Route path="/discovery" component={Discovery} />
        <Route path="/publication" component={Publication} />
        <Route path="/format/:journalId" component={FormatPreview} />
        <Route path="/admin" component={Admin} />
        <Route path="/internal-admin" component={InternalAdmin} />
        <Route path="/profile" component={Profile} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

/**
 * Fullscreen loading overlay covering:
 *  1. Initial auth bootstrap (isLoading / isAuthenticating)
 *  2. Project fetch that runs immediately after OAuth login (isLoadingProjects)
 *
 * Client-side navigation (PostAuthNavigator) keeps this component mounted across
 * the OAuth -> /dashboard transition, so there is no double-flash.
 *
 * Sequence when loading finishes:
 *   all loading stops -> 200 ms settle -> progress=100 -> burst animation -> 2 s -> unmount
 */
function GlobalLoadingOverlay() {
  const { isLoading, isAuthenticating } = useAuth();
  const { isLoadingProjects } = useProject();

  const isAnyLoading = isLoading || isAuthenticating || isLoadingProjects;

  const [visible, setVisible] = useState(() => isLoading || isAuthenticating);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const completingRef = useRef(false);

  // Re-show if auth loading starts while overlay is hidden (e.g. token refresh).
  useEffect(() => {
    if ((isLoading || isAuthenticating) && !visible) {
      setVisible(true);
      completingRef.current = false;
      setProgress(undefined);
    }
  }, [isLoading, isAuthenticating, visible]);

  // Drive completion. 400 ms debounce absorbs the React rendering gap between
  // isLoading->false and isLoadingProjects->true (ProjectContext useEffect fires
  // after the first render of Dashboard, not synchronously).
  useEffect(() => {
    if (!visible) return;

    if (isAnyLoading) {
      // Once progress has reached 100 the burst is playing - don't reset it
      // if a late loading spike arrives (e.g. project fetch starts after settle).
      if (progress === 100) return;
      // Loading (re)started before completion - cancel any pending settle.
      completingRef.current = false;
      setProgress(undefined);
      return;
    }

    const settle = setTimeout(() => {
      if (completingRef.current) return;
      completingRef.current = true;
      setProgress(100); // snap J to full -> burst fires in LoadingScreen
    }, 400);

    return () => clearTimeout(settle);
  }, [isAnyLoading, visible, progress]);

  // Hide overlay when burst reaches its peak (1 000 ms matches the burst animation duration).
  useEffect(() => {
    if (progress !== 100) return;
    const hide = setTimeout(() => setVisible(false), 1000);
    return () => clearTimeout(hide);
  }, [progress]);

  if (!visible) return null;
  return <LoadingScreen progress={progress} />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <ProjectProvider>
            <JournalsProvider>
              <ManuscriptProvider>
                <SubmissionsProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Router />
                    <AuthModal />
                    <GlobalLoadingOverlay />
                  </TooltipProvider>
                </SubmissionsProvider>
              </ManuscriptProvider>
            </JournalsProvider>
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
