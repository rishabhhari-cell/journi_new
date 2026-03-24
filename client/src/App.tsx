import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
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
      <Route component={NotFound} />
    </Switch>
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
