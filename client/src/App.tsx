import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import JLoadingGlyph from "./components/JLoadingGlyph";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import AuthModal from "./components/auth/AuthModal";
import { ProjectProvider } from "./contexts/ProjectContext";
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
                    <AppShell />
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

function AppShell() {
  const { isLoading, isAuthenticating } = useAuth();
  return (
    <>
      <AuthModal />
      {(isLoading || isAuthenticating) && (
        <div className="fixed right-4 top-20 z-[85] rounded-xl border border-border bg-card/95 px-3 py-2 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <JLoadingGlyph size={22} />
            <span className="text-xs font-medium text-muted-foreground">
              {isAuthenticating ? "Signing in..." : "Restoring session..."}
            </span>
          </div>
        </div>
      )}
      <Router />
    </>
  );
}

export default App;
