/**
 * Journi Navbar — Nordic Academic Design
 * Frosted glass header with green accent underline on active nav items
 */
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663338983812/MPxdcgWnrcekBSWX.png";

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

  return (
    <header className="glass fixed top-0 left-0 right-0 z-50">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img src={LOGO_URL} alt="Journi" className="h-9 w-auto" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Journi
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
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

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </button>
          <button className="bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
            Get Started
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-foreground"
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
            <div className="flex gap-3 mt-3 pt-3 border-t border-border">
              <button className="text-sm font-medium text-muted-foreground">Sign In</button>
              <button className="bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg">
                Get Started
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
