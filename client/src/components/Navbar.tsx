/**
 * Journi Navbar — Nordic Academic Design
 * Frosted glass header with green accent underline on active nav items
 */
import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Menu, X, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const LOGO_URL = "/journi_transparent.png";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Collaboration", href: "/collaboration" },
  { label: "Discovery", href: "/discovery" },
  { label: "Publication", href: "/publication" },
];

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, signOut, openModal } = useAuth();

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = () => {
    signOut();
    setUserMenuOpen(false);
    setMobileOpen(false);
  };

  return (
    <header className="glass fixed top-0 left-0 right-0 z-50">
      <div className="container relative flex items-center h-16">
        {/* Logo — left */}
        <Link href="/" className="flex items-center shrink-0 ml-8">
          <img src={LOGO_URL} alt="Journi" className="h-16 w-auto" />
        </Link>

        {/* Desktop Nav — absolutely centred */}
        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3.5 py-2 text-sm font-medium rounded-md transition-colors duration-200
                  ${isActive
                    ? "text-journi-green"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-journi-green rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* CTA / User — right */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          {user ? (
            /* Signed-in: avatar + name dropdown */
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-journi-green text-journi-slate text-xs font-bold flex items-center justify-center shrink-0">
                  {user.initials}
                </div>
                <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
                  {user.name}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-muted-foreground transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-lg py-1.5 z-10">
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Signed-out: Sign In + Get Started */
            <>
              <button
                onClick={() => openModal("signin")}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => openModal("signup")}
                className="bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Get Started
              </button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-foreground ml-auto"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-sm">
          <nav className="container py-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 py-2.5 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? "text-journi-green bg-journi-green/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="mt-3 pt-3 border-t border-border">
              {user ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-journi-green text-journi-slate text-xs font-bold flex items-center justify-center shrink-0">
                      {user.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => { openModal("signin"); setMobileOpen(false); }}
                    className="text-sm font-medium text-muted-foreground"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { openModal("signup"); setMobileOpen(false); }}
                    className="bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
