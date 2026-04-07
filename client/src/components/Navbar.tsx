/**
 * Journi Navbar — Nordic Academic Design
 * Mega-menu header with scroll-based glass effect, NavigationMenu dropdowns,
 * animated mobile toggle, and portal-based mobile menu.
 */
import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  LogOut,
  ChevronDown,
  FlaskConical,
  ExternalLink,
  UserCircle,
  FileText,
  Search,
  Send,
  LayoutDashboard,
  Users,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ProjectWorkspaceManager from "@/components/ProjectWorkspaceManager";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

const LOGO_URL = "/logos/Journi_tab_final.svg";

const APP_ROUTES = ["/dashboard", "/collaboration", "/discovery", "/publication", "/format"];

const appNavItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Editor", href: "/collaboration" },
  { label: "Journal Finder", href: "/discovery" },
  { label: "Submissions", href: "/publication" },
];

type FeatureItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

const featureItems: FeatureItem[] = [
  {
    title: "Collaborative Editor",
    href: "/features#manuscript",
    icon: FileText,
    description: "Real-time manuscript editing with your team",
  },
  {
    title: "Journal Finder",
    href: "/features#discovery",
    icon: Search,
    description: "AI-powered journal matching for your research",
  },
  {
    title: "Submission Tracker",
    href: "/features#submission",
    icon: Send,
    description: "Track submissions from draft to publication",
  },
  {
    title: "Project Dashboard",
    href: "/features#collaboration",
    icon: LayoutDashboard,
    description: "Manage timelines, tasks, and collaborators",
  },
];

const aboutItems: FeatureItem[] = [
  {
    title: "Our Team",
    href: "/about#team",
    icon: Users,
    description: "Meet the clinicians and builders behind Journie",
  },
  {
    title: "Why Journie",
    href: "/about#why-us",
    icon: FlaskConical,
    description: "See the mission and values guiding the product",
  },
  {
    title: "Support",
    href: "/support#support-overview",
    icon: HelpCircle,
    description: "Get help and find answers to your questions",
  },
];

/* ─── Scroll hook ─── */
function useScroll(threshold: number) {
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  useEffect(() => {
    onScroll();
  }, [onScroll]);

  return scrolled;
}

/* ─── Feature list item for mega-menu ─── */
function FeatureListItem({ title, description, icon: Icon, href, onClick }: FeatureItem & { onClick?: () => void }) {
  return (
    <NavigationMenuLink asChild>
      <Link
        href={href}
        onClick={onClick}
        className="flex flex-row gap-x-3 rounded-md p-2.5 hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <div className="flex aspect-square size-11 shrink-0 items-center justify-center rounded-md border bg-background/40 shadow-sm">
          <Icon className="text-journi-green size-5" />
        </div>
        <div className="flex flex-col items-start justify-center">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">{description}</span>
        </div>
      </Link>
    </NavigationMenuLink>
  );
}

/* ─── Portal-based mobile menu ─── */
function MobileMenu({
  open,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { open: boolean }) {
  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      id="mobile-menu"
      className={cn(
        "fixed top-16 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-t border-border md:hidden",
        "bg-background/95 supports-[backdrop-filter]:bg-background/50 backdrop-blur-lg",
      )}
    >
      <div
        data-slot={open ? "open" : "closed"}
        className={cn(
          "data-[slot=open]:animate-in data-[slot=open]:fade-in-0 ease-out duration-200",
          "size-full overflow-y-auto p-4",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ─── Main Navbar ─── */
export default function Navbar() {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, signOut, openModal } = useAuth();
  const scrolled = useScroll(10);

  const isAppRoute = APP_ROUTES.some((r) => location.startsWith(r));
  const isAuthenticated = !!user;

  // Always show glass on app routes; on public routes, show only when scrolled
  const showGlass = isAppRoute || scrolled;

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const handleSignOut = () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    signOut();
    navigate("/");
  };

  const navigateToPageTop = useCallback((path: string) => {
    setMobileOpen(false);
    setUserMenuOpen(false);

    if (window.location.pathname === path) {
      if (window.location.hash) {
        window.history.replaceState(null, "", path);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    navigate(path);
  }, [navigate]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        showGlass ? "glass" : "bg-transparent",
      )}
    >
      <div className="container flex items-center h-16">
        {/* Logo + Nav — left-aligned group */}
        <div className="flex items-center gap-5">
          <Link href={isAuthenticated ? "/dashboard" : "/"} className="flex items-center shrink-0 ml-8">
            <img src={LOGO_URL} alt="Journie" className="h-11 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center">
          {isAppRoute ? (
            /* App routes: flat nav links */
            <nav className="flex items-center gap-1">
              {appNavItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative px-3.5 py-2 text-sm font-medium rounded-md transition-colors duration-200",
                      isActive
                        ? "text-[#685FB4] font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#685FB4] rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          ) : (
            /* Public routes: mega-menu NavigationMenu */
            <NavigationMenu className="flex-none justify-start">
              <NavigationMenuList className="flex-none justify-start">
                {/* Features dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    onClick={() => navigateToPageTop("/features")}
                    className={cn(
                      "bg-transparent text-sm font-medium hover:text-foreground",
                      location.startsWith("/features") ? "text-[#685FB4] font-bold" : "text-muted-foreground",
                    )}
                  >
                    Features
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[420px] grid-cols-1 gap-1 p-2 sm:w-[500px] sm:grid-cols-2">
                      {featureItems.map((item) => (
                        <li key={item.title}>
                          <FeatureListItem {...item} />
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Pricing — direct link */}
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/pricing"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToPageTop("/pricing");
                      }}
                      className={cn(
                        "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
                        location.startsWith("/pricing")
                          ? "text-[#685FB4] font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                      )}
                    >
                      Pricing
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* About dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    onClick={() => navigateToPageTop("/about")}
                    className={cn(
                      "bg-transparent text-sm font-medium hover:text-foreground",
                      location.startsWith("/about") ? "text-[#685FB4] font-bold" : "text-muted-foreground",
                    )}
                  >
                    About
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[320px] grid-cols-1 gap-1 p-2">
                      {aboutItems.map((item) => (
                        <li key={item.title}>
                          <FeatureListItem {...item} />
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          )}
          </div>
        </div>

        {/* CTA / User — right */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          {isAppRoute && isAuthenticated && (
            <ProjectWorkspaceManager />
          )}

          {isAuthenticated ? (
            <>
              {!isAppRoute && (
                <Button
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="bg-[#7B71C7] text-white hover:bg-[#6C63B7] font-semibold"
                >
                  Go to Dashboard
                </Button>
              )}
              <div className="relative flex items-center gap-2" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <div className="w-7 h-7 rounded-full bg-journi-green text-journi-slate text-xs font-bold flex items-center justify-center shrink-0">
                  {user?.initials ?? "?"}
                </div>
                <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
                  {user?.name ?? "Account"}
                </span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "text-muted-foreground transition-transform",
                    userMenuOpen && "rotate-180",
                  )}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-lg py-1.5 z-10">
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {user?.name ?? "Account"}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <UserCircle size={14} />
                      Account
                    </Link>
                  </div>
                  <div className="py-1 border-t border-border">
                    <p className="px-4 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Journie
                    </p>
                    {[ 
                      { label: "Home", href: "/" },
                      { label: "Features", href: "/features" },
                      { label: "Pricing", href: "/pricing" },
                      { label: "About Us", href: "/about" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <ExternalLink size={12} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-border pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => openModal("signin")}>
                Sign In
              </Button>
              <Button variant="purpleOutline" size="sm" onClick={() => openModal("signup")}>
                Sign Up
              </Button>
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden ml-auto"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label="Toggle menu"
        >
          <MenuToggleIcon open={mobileOpen} className="size-5" duration={300} />
        </Button>
      </div>

      {/* Portal-based mobile menu */}
      <MobileMenu open={mobileOpen} className="flex flex-col justify-between gap-4">
        <nav className="flex flex-col gap-1">
          {isAppRoute ? (
            /* App route links */
            appNavItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                className={cn(
                  "px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "text-[#685FB4] font-semibold bg-[#685FB4]/12"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {item.label}
                </Link>
              );
            })
          ) : (
            /* Public route links with sections */
            <>
              <Link
                href="/features"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToPageTop("/features");
                }}
                className={cn(
                  "px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                  location.startsWith("/features")
                    ? "text-[#685FB4] font-bold bg-[#685FB4]/12"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                Features
              </Link>
              <span className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Feature Sections
              </span>
              {featureItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={closeMobile}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <item.icon className="size-4 text-journi-green" />
                  {item.title}
                </Link>
              ))}

              <Link
                href="/pricing"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToPageTop("/pricing");
                }}
                className={cn(
                  "px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                  location.startsWith("/pricing")
                    ? "text-[#685FB4] font-bold bg-[#685FB4]/12"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                Pricing
              </Link>

              <Link
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToPageTop("/about");
                }}
                className={cn(
                  "px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                  location.startsWith("/about")
                    ? "text-[#685FB4] font-bold bg-[#685FB4]/12"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                About
              </Link>
              <span className="px-3 pt-3 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                About Sections
              </span>
              {aboutItems.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={closeMobile}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <item.icon className="size-4 text-journi-green" />
                  {item.title}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Mobile auth section */}
        <div className="mt-auto pt-4 border-t border-border">
          {isAuthenticated ? (
            <div className="space-y-1">
              {!isAppRoute && (
                <div className="pb-2 border-b border-border/50 mb-2">
                  <button
                    onClick={() => { navigate("/dashboard"); closeMobile(); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#7B71C7] text-white font-semibold rounded-md hover:bg-[#6C63B7] transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2.5 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-journi-green text-journi-slate text-xs font-bold flex items-center justify-center shrink-0">
                  {user?.initials ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.name ?? "Account"}
                  </p>
                  {user?.email && (
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  )}
                </div>
              </div>
              <Link
                href="/profile"
                onClick={closeMobile}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <UserCircle size={14} />
                Account
              </Link>
              {isAppRoute && (
                <>
                  <p className="px-3 pt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Journie
                  </p>
                  {[
                    { label: "Home", href: "/" },
                    { label: "Features", href: "/features" },
                    { label: "Pricing", href: "/pricing" },
                    { label: "About Us", href: "/about" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobile}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                      <ExternalLink size={12} />
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                className="w-full justify-center"
                onClick={() => {
                  openModal("signin");
                  closeMobile();
                }}
              >
                Sign In
              </Button>
              <Button
                variant="purpleOutline"
                className="w-full justify-center"
                onClick={() => {
                  openModal("signup");
                  closeMobile();
                }}
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </MobileMenu>
    </header>
  );
}
