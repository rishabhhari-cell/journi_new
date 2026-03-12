/**
 * Journi Footer — Nordic Academic Design
 */
const LOGO_URL = "/journi_black_outline.png";

export default function Footer() {
  return (
    <footer className="bg-journi-slate text-white/80">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={LOGO_URL} alt="Journi" className="h-28 w-auto" />
            </div>
            <p className="text-sm leading-relaxed text-white/60">
              From Start-up to Write-up. Your all-in-one platform for research collaboration, creation, and publication.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2.5">
              {["Dashboard", "Collaboration", "Discovery", "Publication"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-white/60 hover:text-journi-green transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2.5">
              {["Documentation", "API Reference", "Blog", "Support"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-white/60 hover:text-journi-green transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5">
              {["About", "Careers", "Privacy Policy", "Terms of Service"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-white/60 hover:text-journi-green transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">&copy; 2026 Journi. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {["Twitter", "LinkedIn", "GitHub"].map((social) => (
              <a key={social} href="#" className="text-xs text-white/40 hover:text-journi-green transition-colors">
                {social}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
