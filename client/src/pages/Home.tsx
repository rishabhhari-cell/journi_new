/**
 * Journi MVP Landing Page
 * Content per Demo Feedback.md
 */
import { useState } from "react";
import Footer from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Search, Send, ArrowRight, CheckCircle2,
  ChevronRight, FlaskConical, BookOpen, Star, Users,
  Bold, Italic, Underline, List, Link2, Quote,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.09, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

// ─── Preview Components ───────────────────────────────────────────────────────

function JournalFinderPreview() {
  const journals = [
    { name: "BMJ Open", match: 94, rate: "22%", days: 42, oa: true },
    { name: "JAMA Internal Medicine", match: 88, rate: "8%", days: 68, oa: false },
    { name: "PLOS Medicine", match: 82, rate: "18%", days: 38, oa: true },
  ];
  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <Search size={13} className="text-journi-green" />
          <span className="font-semibold text-foreground text-xs">Journal Finder</span>
        </div>
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5">
          <Search size={11} className="text-muted-foreground" />
          <span className="text-muted-foreground text-[10px]">Search by topic, journal, or keyword…</span>
        </div>
      </div>
      <div className="px-4 py-2 bg-journi-green/5 border-b border-border flex items-center gap-2">
        <Star size={11} className="text-journi-green" />
        <span className="text-[10px] text-journi-green font-semibold">Journi recommends for your manuscript</span>
      </div>
      <div className="p-4 space-y-2.5">
        {journals.map((j) => (
          <div key={j.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-journi-green/40 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-journi-green/10 flex items-center justify-center shrink-0">
              <BookOpen size={13} className="text-journi-green" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{j.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-journi-green font-semibold">{j.match}% match</span>
                <span className="text-[10px] text-muted-foreground">{j.rate} acceptance</span>
                <span className="text-[10px] text-muted-foreground">{j.days}d review</span>
                {j.oa && <span className="text-[10px] text-journi-green font-medium">OA</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManuscriptPreview() {
  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-1">
        {[Bold, Italic, Underline, List, Link2, Quote].map((Icon, i) => (
          <div key={i} className="w-6 h-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground"><Icon size={12} /></div>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-[10px] text-muted-foreground ml-1">Section 3: Methodology</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-foreground font-bold text-xs mb-1.5">3. Methodology</p>
          <p className="text-muted-foreground leading-relaxed">A randomized controlled trial was conducted across three clinical sites. Participants (n=245) were stratified by age group and baseline severity scores…</p>
        </div>
        <div className="bg-journi-green/5 border-l-2 border-journi-green rounded-r-lg p-2.5">
          <p className="text-[10px] text-journi-green font-semibold mb-0.5">Auto-formatted to journal requirements</p>
          <p className="text-muted-foreground text-[10px]">Vancouver referencing · 250-word abstract limit · structured headings applied</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-bold">MJ</div>
            <span className="text-foreground font-medium text-[10px]">Michael</span>
            <span className="text-muted-foreground text-[9px]">2 min ago</span>
          </div>
          <p className="text-muted-foreground text-[10px]">Should we include the exclusion criteria here or in the appendix?</p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground">Auto-saved</span>
          <span className="text-[10px] text-muted-foreground">3 citations · 2 comments</span>
        </div>
      </div>
    </div>
  );
}

function SubmissionPreview() {
  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send size={13} className="text-journi-green" />
          <span className="font-semibold text-foreground text-xs">Submissions</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-journi-green/10 text-journi-green text-[10px] font-medium">3 active</span>
      </div>
      <div className="p-4 space-y-2.5">
        {[
          { journal: "BMJ Open", status: "Under Review", color: "bg-blue-500", progress: 60 },
          { journal: "JAMA Internal Medicine", status: "Revision Due", color: "bg-amber-500", progress: 75 },
          { journal: "PLOS Medicine", status: "Accepted", color: "bg-journi-green", progress: 100 },
        ].map((s) => (
          <div key={s.journal} className="p-2.5 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground font-medium">{s.journal}</span>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full text-white ${s.color}`}>{s.status}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "choose", label: "Choose", icon: Search, preview: JournalFinderPreview, link: "/discovery" },
  { key: "write",  label: "Write",  icon: FileText, preview: ManuscriptPreview,  link: "/collaboration" },
  { key: "submit", label: "Submit", icon: Send,     preview: SubmissionPreview,  link: "/publication" },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("choose");
  const { openModal, signInAsGuest } = useAuth();
  const [, navigate] = useLocation();

  const activeTabData = TABS.find((t) => t.key === activeTab)!;
  const PreviewComponent = activeTabData.preview;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-0 md:pt-36 overflow-hidden">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            {/* Left */}
            <motion.div className="pt-4 lg:pt-10 pb-8" initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-5">
                Journi: Research,<br />
                <span className="text-journi-green">simplified.</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mb-8">
                Journi removes friction from manuscript submission — so you can focus on your research.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { signInAsGuest(); navigate("/collaboration"); }}
                  className="inline-flex items-center gap-2 bg-journi-green text-journi-slate font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Try it with your manuscript
                  <ArrowRight size={17} />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-lg hover:bg-accent transition-colors"
                >
                  See how it works
                </a>
              </div>
            </motion.div>

            {/* Right: tabbed demo */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0, 0, 0.2, 1] }}
            >
              <div className="flex gap-1 pb-3">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      activeTab === tab.key
                        ? "bg-journi-green text-journi-slate shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <tab.icon size={13} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-border shadow-2xl shadow-journi-green/5 overflow-hidden bg-card">
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/40">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-muted-foreground font-mono">journi.app{activeTabData.link}</span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="p-4"
                  >
                    <PreviewComponent />
                  </motion.div>
                </AnimatePresence>

                <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Live preview — fully interactive in the app</span>
                  <Link href={activeTabData.link} className="inline-flex items-center gap-1 text-xs text-journi-green font-semibold hover:underline">
                    Open {activeTabData.label} <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Value props ─────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30 mt-16">
        <div className="container py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: "Built for clinician-researchers" },
              { value: "Spend less time on admin" },
              { value: "Keep your research moving" },
            ].map((s, i) => (
              <motion.div
                key={s.value}
                className="text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              >
                <p className="text-lg font-bold text-foreground">{s.value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product pillars ─────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="container">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">Everything you need to publish</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Search,
                title: "Choose",
                subtitle: "Find the right journal with confidence",
                items: ["Journal matching", "Submission requirements overview"],
                link: "/discovery",
              },
              {
                icon: FileText,
                title: "Write",
                subtitle: "Format and generate submission-ready materials",
                items: ["Auto-formatting to requirements", "Co-author collaboration"],
                link: "/collaboration",
              },
              {
                icon: Send,
                title: "Submit",
                subtitle: "Track, revise, and resubmit without friction",
                items: ["Submission and revision management", "Resubmission workflows"],
                link: "/publication",
              },
            ].map((pillar, i) => (
              <motion.div
                key={pillar.title}
                className="p-8 rounded-2xl border border-border hover:border-journi-green/40 hover:shadow-lg hover:shadow-journi-green/5 transition-all group"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
              >
                <div className="w-12 h-12 rounded-xl bg-journi-green/10 flex items-center justify-center mb-5 group-hover:bg-journi-green/20 transition-colors">
                  <pillar.icon size={22} className="text-journi-green" />
                </div>
                <h3 className="text-xl font-extrabold text-foreground mb-1">{pillar.title}</h3>
                <p className="text-muted-foreground text-sm mb-5 leading-relaxed">{pillar.subtitle}</p>
                <ul className="space-y-2.5">
                  {pillar.items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <CheckCircle2 size={15} className="text-journi-green shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={pillar.link}
                  className="inline-flex items-center gap-1 mt-6 text-sm text-journi-green font-semibold hover:underline"
                >
                  Explore <ChevronRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Individuals → Teams ─────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Built for individuals.<br />Designed for teams.
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-8">
                Journi helps clinician-researchers move their work forward — while giving teams and institutions visibility across projects, submissions, and outputs.
              </p>
              <ul className="space-y-3">
                {[
                  "Shared visibility across projects and submissions",
                  "Streamlined collaboration between co-authors and supervisors",
                  "Centralised tracking of outputs and progress",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-journi-green shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-journi-green/5"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            >
              <div className="flex items-center gap-2 mb-4">
                <Users size={15} className="text-journi-green" />
                <span className="text-sm font-semibold text-foreground">Research Team</span>
                <span className="ml-auto text-[11px] text-muted-foreground">3 members online</span>
              </div>
              <div className="space-y-3">
                {[
                  { initials: "SC", name: "Dr. Sarah Chen", role: "Lead Author", color: "bg-journi-green" },
                  { initials: "MJ", name: "Michael Johnson", role: "Co-Author", color: "bg-blue-500" },
                  { initials: "AL", name: "Dr. Anna Lee", role: "Supervisor", color: "bg-purple-500" },
                ].map((m) => (
                  <div key={m.name} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className={`w-8 h-8 rounded-full ${m.color} text-white flex items-center justify-center text-[11px] font-bold shrink-0`}>{m.initials}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.role}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-journi-green shrink-0" />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="container">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">How it works</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-0.5 bg-border z-0" />
            {[
              {
                step: "01", icon: FileText,
                title: "Upload your manuscript",
                desc: "Start with your draft — no matter the format or stage.",
              },
              {
                step: "02", icon: Search,
                title: "Find the right journal and prepare",
                desc: "Search for journals yourself or use Journi's recommendations, then format your manuscript to their requirements automatically.",
              },
              {
                step: "03", icon: Send,
                title: "Submit and manage revisions",
                desc: "Track submissions, respond to reviewer feedback, and resubmit — all in one place.",
              },
            ].map((step, i) => (
              <motion.div
                key={step.step}
                className="relative z-10 flex flex-col items-center text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
              >
                <div className="w-16 h-16 rounded-2xl bg-journi-green/10 border border-journi-green/20 flex items-center justify-center mb-5">
                  <step.icon size={24} className="text-journi-green" />
                </div>
                <span className="text-xs font-bold text-journi-green mb-2 tracking-widest">{step.step}</span>
                <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container">
          <motion.div
            className="relative rounded-2xl bg-gradient-to-br from-journi-green/10 via-journi-green/5 to-transparent border border-journi-green/20 p-12 md:p-16 text-center overflow-hidden"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
              Ready to move your research forward?
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              No setup. No friction. Start with your manuscript today.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => { signInAsGuest(); navigate("/collaboration"); }}
                className="inline-flex items-center gap-2 bg-journi-green text-journi-slate font-semibold px-8 py-3.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                Try it with your manuscript
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => openModal("signup")}
                className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-accent transition-colors"
              >
                <FlaskConical size={17} className="text-journi-green" />
                Sign Up Free
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}