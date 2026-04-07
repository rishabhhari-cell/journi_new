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
        <a href="/" className="text-journi-green hover:underline text-sm">← Back to Home</a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <>
      <ScrollToTop />
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
      <Route path="/profile" component={Profile} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

/**
 * Fullscreen loading overlay that covers:
 *  1. Initial auth bootstrap (isLoading / isAuthenticating)
 *  2. Project fetch after login (isLoadingProjects)
 *  3. The OAuth→dashboard hard-page-reload gap (sessionStorage 'journi_loading' flag)
 *
 * When all loading is done, snaps to progress=100 (triggers burst), waits 1 s, then unmounts.
 */
function GlobalLoadingOverlay() {
  const { isLoading, isAuthenticating } = useAuth();
  const { isLoadingProjects } = useProject();

  const isAnyLoading = isLoading || isAuthenticating || isLoadingProjects;

  // Visible if auth is loading now OR the sessionStorage flag was set before a hard redirect.
  const [visible, setVisible] = useState(
    () => isLoading || isAuthenticating || sessionStorage.getItem('journi_loading') === 'true',
  );
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const completingRef = useRef(false);

  // If a new auth loading phase starts while overlay is hidden, re-show it.
  useEffect(() => {
    if ((isLoading || isAuthenticating) && !visible) {
      setVisible(true);
      completingRef.current = false;
      setProgress(undefined);
    }
  }, [isLoading, isAuthenticating, visible]);

  // Drive completion: once all loading stops, snap to 100 % → burst → hide after 1 s.
  // Use a 200 ms debounce so transient false→true flips (React mount settling) don't
  // trigger premature completion.
  useEffect(() => {
    if (!visible) return;

    if (isAnyLoading) {
      // Loading resumed — cancel any in-progress completion sequence.
      completingRef.current = false;
      setProgress(undefined);
      return;
    }

    // Loading appears done — wait briefly to let React settle (ProjectContext useEffect
    // fires after first render, so isLoadingProjects may not be true yet).
    const settle = setTimeout(() => {
      if (completingRef.current) return;
      completingRef.current = true;
      sessionStorage.removeItem('journi_loading');
      setProgress(100);
    }, 200);

    return () => clearTimeout(settle);
  }, [isAnyLoading, visible]);

  // Separate hide timer: after progress reaches 100 (burst plays for ~450 ms),
  // keep overlay for the full 1 s then unmount.
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
                    <GlobalLoadingOverlay />
                    <Toaster />
                    <AuthModal />
                    <Router />
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
