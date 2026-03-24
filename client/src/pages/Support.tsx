import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Support() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <section className="py-20 md:py-28">
          <div className="container max-w-3xl">
            <p className="text-xs font-bold text-journi-green uppercase tracking-widest mb-3">Support</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">We are here to help</h1>
            <p className="text-muted-foreground text-lg mb-10">
              Get help with account access, billing, manuscript workflows, journal discovery, or team collaboration.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">Email Support</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Reach us for product, technical, and account questions.
                </p>
                <a
                  href="mailto:support@journi.app"
                  className="text-journi-green text-sm font-semibold hover:underline"
                >
                  support@journi.app
                </a>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">Response Time</h2>
                <p className="text-sm text-muted-foreground">
                  Standard: within 1 business day
                </p>
                <p className="text-sm text-muted-foreground">
                  Priority plans: same business day
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 md:col-span-2">
                <h2 className="text-lg font-semibold text-foreground mb-2">Include this in your request</h2>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  <li>Your account email and organization name</li>
                  <li>The page or feature where the issue happened</li>
                  <li>A screenshot and expected outcome</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
