import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
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
import Dashboard from "./pages/Dashboard";
import Collaboration from "./pages/Collaboration";
import Discovery from "./pages/Discovery";
import Publication from "./pages/Publication";
import FormatPreview from "./pages/FormatPreview";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/collaboration" component={Collaboration} />
      <Route path="/discovery" component={Discovery} />
      <Route path="/publication" component={Publication} />
      <Route path="/format/:journalId" component={FormatPreview} />
      <Route path="/404" component={NotFound} />
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
