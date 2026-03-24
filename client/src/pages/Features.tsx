/**
 * Features page — /features
 *
 * Evaluation-focused page for users who want to know exactly what Journi
 * includes before signing up. Organised around 5 feature categories (tabbed),
 * a "Replace the chaos" comparison, a real-world case scenario, and a CTA.
 *
 * To add/edit features:    update CATEGORIES below.
 * To add/edit comparisons: update CHAOS_ROWS below.
 * To add/edit the scenario: update SCENARIO_STEPS below.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  FileText, Search, Send, ArrowRight,
  FlaskConical, Users, Lock, LayoutDashboard,
  AlignJustify, Hash, Upload, Download, GitBranch,
  MessageSquare, BookOpen, AlignLeft, Mail,
  BarChart2, Clock, Globe, BookMarked, ListChecks, ArrowLeftRight,
  Bell, RefreshCw, RotateCcw, FileCheck, ArrowUpRight, Activity, StickyNote,
  Rss, CalendarDays, UserCog,
  ClipboardList, CheckSquare, Award, Shield, Building2,
  Star, CheckCircle2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.09, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  icon: LucideIcon;
  name: string;
  desc: string;
  comingSoon?: boolean;
  teamPlus?: boolean;
}

interface Category {
  id: string;
  label: string;
  features: Feature[];
}

interface ChaosRow {
  without: string;
  with: string;
}

interface ScenarioStep {
  step: string;
  icon: LucideIcon;
  title: string;
  body: string;
  tags: string[];
  comingSoon?: boolean;
}

// ─── Feature categories ───────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    id: "manuscript",
    label: "Manuscript",
    features: [
      { icon: FileText,      name: "IMRAD & study-type templates",          desc: "Start from a layout built around your study design, not a blank page." },
      { icon: AlignJustify,  name: "Auto-formatting to journal requirements",desc: "Word limits, heading styles, and reference format applied automatically when you pick a target journal." },
      { icon: Hash,          name: "Section word count tracking",            desc: "Live count per section against the journal's limit; highlights when you're over." },
      { icon: Upload,        name: "DOCX import",                            desc: "Bring in a draft started in Word without losing formatting." },
      { icon: Download,      name: "Export to DOCX and PDF",                 desc: "Formatted to submission requirements, not just a generic export." },
      { icon: GitBranch,     name: "Full version history",                   desc: "Every save is tracked; restore any prior version of any section." },
      { icon: MessageSquare, name: "Inline comments and threaded replies",   desc: "Comment on any sentence; co-authors reply in context, not over email." },
      { icon: BookOpen,      name: "Citation manager",                       desc: "Add, reorder, and auto-format references in Vancouver, APA, or journal-specific styles." },
      { icon: AlignLeft,     name: "Structured abstract builder",            desc: "Field-by-field abstract entry with per-field word limits." },
      { icon: Mail,          name: "Cover letter composer",                  desc: "Templates for initial submission and point-by-point revision response letters." },
    ],
  },
  {
    id: "discovery",
    label: "Journal Discovery",
    features: [
      { icon: Search,          name: "Keyword and topic search",             desc: "Search by condition, intervention, study type, or research area.",               comingSoon: true },
      { icon: Star,            name: "Match score",                          desc: "Relevance score based on your abstract, study design, and target population.",    comingSoon: true },
      { icon: BarChart2,       name: "Acceptance rate data",                 desc: "Published acceptance rates per journal where available.",                         comingSoon: true },
      { icon: Clock,           name: "Time-to-first-decision",               desc: "Median review timeline to set realistic expectations.",                           comingSoon: true },
      { icon: Globe,           name: "Open-access status and APC",           desc: "OA availability and article processing charge at a glance.",                     comingSoon: true },
      { icon: BookMarked,      name: "Scope and aims summaries",             desc: "Plain-language scope summaries to validate topical fit.",                        comingSoon: true },
      { icon: ListChecks,      name: "Submission requirements overview",     desc: "Word limits, figure counts, reference styles, and structured abstract requirements.", comingSoon: true },
      { icon: ArrowLeftRight,  name: "Side-by-side journal comparison",      desc: "Compare up to 3 journals before choosing where to submit.",                      comingSoon: true },
    ],
  },
  {
    id: "submission",
    label: "Submission",
    features: [
      { icon: Send,         name: "Multi-journal submission log",      desc: "Track every submission across every manuscript in one view.",                         comingSoon: true },
      { icon: Activity,     name: "Status tracking",                    desc: "Submitted → Under review → Revision requested → Accepted / Rejected.",              comingSoon: true },
      { icon: Bell,         name: "Deadline reminders",                 desc: "Alerts for revision deadlines and stale submissions.",                               comingSoon: true },
      { icon: StickyNote,   name: "Reviewer comment workspace",         desc: "Structured point-by-point response editor linked to the reviewer report.",          comingSoon: true },
      { icon: RefreshCw,    name: "Resubmission workflow",              desc: "Attach revised manuscript and cover letter; compare to prior version.",             comingSoon: true },
      { icon: RotateCcw,    name: "Full submission history",            desc: "Complete record of every journal submitted to, with outcome and dates.",            comingSoon: true },
      { icon: FileCheck,    name: "Revision checklist",                 desc: "Track which reviewer comments have been addressed before resubmitting.",            comingSoon: true },
      { icon: ArrowUpRight, name: "External submission links",          desc: "Direct links to each journal's submission portal.",                                 comingSoon: true },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    features: [
      { icon: Users,           name: "Shared team workspace",       desc: "All manuscripts in one project library, visible to the whole group.",                        teamPlus: true },
      { icon: Lock,            name: "Role-based access",           desc: "Lead author, co-author, supervisor, viewer — each with the right permissions." },
      { icon: LayoutDashboard, name: "Team project dashboard",      desc: "Active manuscripts, statuses, and upcoming deadlines across the group.",                     teamPlus: true },
      { icon: Rss,             name: "Activity feed",               desc: "See who edited what and when, without email threads." },
      { icon: CalendarDays,    name: "Shared deadline calendar",    desc: "Milestones and submission dates visible to the whole team." },
      { icon: UserCog,         name: "Admin panel",                 desc: "Add/remove members, set roles, and manage shared templates.",                               teamPlus: true },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    features: [
      { icon: ClipboardList, name: "CONSORT 2010 checklist",           desc: "For randomised controlled trials, including extensions for harms, cluster, and non-inferiority." },
      { icon: ClipboardList, name: "STROBE checklist",                 desc: "For observational epidemiology (cohort, case-control, cross-sectional)." },
      { icon: ClipboardList, name: "PRISMA checklist",                 desc: "For systematic reviews and meta-analyses." },
      { icon: ClipboardList, name: "CARE checklist",                   desc: "For case reports and case series." },
      { icon: ClipboardList, name: "STARD checklist",                  desc: "For diagnostic accuracy studies." },
      { icon: ClipboardList, name: "SQUIRE checklist",                 desc: "For quality improvement and clinical audit reports." },
      { icon: CheckSquare,   name: "Section-by-section tracking",      desc: "Each checklist item links to the relevant manuscript section." },
      { icon: Award,         name: "CRediT author contributions",      desc: "Structured author contribution statements using the CRediT taxonomy." },
      { icon: Shield,        name: "Ethics statement boilerplates",     desc: "Templated ethics approval, consent, and data availability statements." },
      { icon: Building2,     name: "Institutional boilerplate",        desc: "Org-level standard methods, ethics, and acknowledgement sections.", teamPlus: true },
    ],
  },
];

// ─── Replace the chaos rows ───────────────────────────────────────────────────

const CHAOS_ROWS: ChaosRow[] = [
  {
    without: "Word doc reformatted manually for every journal",
    with:    "Auto-formatted to the target journal's requirements",
  },
  {
    without: "Email chains and tracked changes for co-author feedback",
    with:    "Inline comments with threaded replies, directly in the manuscript",
  },
  {
    without: "Spreadsheet or memory to track submission statuses",
    with:    "Built-in status tracker with deadline reminders",
  },
  {
    without: "Separate PDF checklists ticked by hand",
    with:    "CONSORT, STROBE and more, integrated into the manuscript workflow",
  },
  {
    without: "v3_FINAL_FINAL_edit2.docx",
    with:    "Automatic version history, section-by-section and recoverable",
  },
];

// ─── Scenario steps ───────────────────────────────────────────────────────────

const SCENARIO_STEPS: ScenarioStep[] = [
  {
    step: "01",
    icon: FileText,
    title: "Start with structure",
    body: "Sarah opens Journi and selects the RCT template. Her manuscript is already divided into IMRAD sections: Background, Methods, Results, Discussion. The CONSORT checklist is pre-loaded — she can see at a glance which items she still needs to address.",
    tags: ["CONSORT checklist", "RCT template", "Structured sections"],
  },
  {
    step: "02",
    icon: Users,
    title: "Collaborate with co-authors",
    body: "She invites her supervisor, Dr Lee, and her statistical co-author Michael. Michael drafts the Methods and Results sections directly in Journi. Dr Lee leaves structured comments in the margin — no tracked-changes emails, no version confusion.",
    tags: ["Role-based access", "Inline comments", "Activity feed"],
  },
  {
    step: "03",
    icon: Search,
    title: "Choose the right journal",
    body: "Before spending time reformatting, Sarah runs the journal finder. Journi returns a ranked list based on her abstract and study design — with acceptance rates, median review times, and open-access options. She shortlists two and compares them side by side.",
    tags: ["Match score", "Acceptance rate", "Side-by-side comparison"],
    comingSoon: true,
  },
  {
    step: "04",
    icon: Send,
    title: "Submit, formatted correctly",
    body: "She selects BMJ Open as her target. Journi auto-applies the journal's word limits, heading structure, and Vancouver referencing. She exports a submission-ready DOCX in one click. Journi logs the submission and sets a reminder for 6 weeks out.",
    tags: ["Auto-formatting", "DOCX export", "Submission tracker"],
  },
  {
    step: "05",
    icon: RefreshCw,
    title: "Manage revision and resubmit",
    body: "The reviewer report arrives. Sarah opens the revision workspace in Journi — each reviewer comment is listed, and she types her response point by point. She resubmits with the updated manuscript and cover letter attached. Three months later: accepted.",
    tags: ["Reviewer response workspace", "Resubmission", "Submission history"],
    comingSoon: true,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Features() {
  const [activeCategory, setActiveCategory] = useState<string>("manuscript");
  const { openModal, signInAsGuest } = useAuth();
  const [, navigate] = useLocation();

  const currentFeatures = CATEGORIES.find((c) => c.id === activeCategory)?.features ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="pt-28 pb-16 md:pt-36 md:pb-20">
          <div className="container">
            <motion.div
              className="text-center max-w-2xl mx-auto"
              initial="hidden" animate="visible" variants={fadeUp} custom={0}
            >
              <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-5">
                Every feature, purpose‑built for{" "}
                <span className="text-journi-green">manuscript submission</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl mx-auto">
                No general-purpose writing tool, no project tracker bolted on. Journi is built
                specifically for the manuscript submission lifecycle — from draft to accepted.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => { signInAsGuest(); navigate("/collaboration"); }}
                  className="inline-flex items-center gap-2 bg-journi-green text-journi-slate font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Try it free
                  <ArrowRight size={17} />
                </button>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-lg hover:bg-accent transition-colors"
                >
                  See pricing
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Feature category grid ─────────────────────────────────────────── */}
        <section className="py-16 md:py-24">
          <div className="container">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            >
              {/* Category tab bar */}
              <div className="flex flex-wrap gap-2 mb-10" role="tablist" aria-label="Feature categories">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    role="tab"
                    aria-selected={activeCategory === cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeCategory === cat.id
                        ? "bg-journi-green text-journi-slate"
                        : "border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Feature grid */}
              <div
                role="tabpanel"
                aria-label={`${CATEGORIES.find((c) => c.id === activeCategory)?.label} features`}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {currentFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.name}
                      className="flex items-start gap-4 p-5 rounded-xl border border-border hover:border-journi-green/30 hover:bg-journi-green/[0.02] transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-journi-green/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={15} className="text-journi-green" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-semibold text-foreground">{feature.name}</p>
                          {feature.comingSoon && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                              Coming soon
                            </span>
                          )}
                          {feature.teamPlus && !feature.comingSoon && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-journi-green/10 text-journi-green shrink-0">
                              Team+
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Replace the chaos ─────────────────────────────────────────────── */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container">
            <motion.div
              className="text-center max-w-2xl mx-auto mb-12"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            >
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Replace the scattered approach
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Most clinician-researchers piece together a submission workflow from tools that weren't
                designed for it. Journi replaces all of them.
              </p>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="rounded-2xl border border-border overflow-hidden max-w-3xl mx-auto"
            >
              {/* Column headers */}
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="px-6 py-4 bg-red-50 dark:bg-red-950/30 flex items-center gap-2">
                  <span aria-hidden="true" className="text-base">❌</span>
                  <span className="text-sm font-bold text-red-700 dark:text-red-400">Without Journi</span>
                </div>
                <div className="px-6 py-4 bg-journi-green/10 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-journi-green shrink-0" aria-hidden="true" />
                  <span className="text-sm font-bold text-journi-green">With Journi</span>
                </div>
              </div>

              {/* Rows */}
              {CHAOS_ROWS.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-2 divide-x divide-border border-t border-border ${i % 2 === 1 ? "bg-muted/20" : "bg-background"}`}
                >
                  <div className="px-6 py-4 text-sm text-muted-foreground leading-relaxed">
                    {row.without}
                  </div>
                  <div className="px-6 py-4 text-sm text-foreground leading-relaxed font-medium">
                    {row.with}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Case scenario ──────────────────────────────────────────────────── */}
        <section className="py-20 md:py-24">
          <div className="container">
            <motion.div
              className="text-center max-w-2xl mx-auto mb-14"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            >
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                See it in action: a clinical trial paper from draft to accepted
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Dr Sarah Chen is a registrar co-authoring her first RCT paper. Here's how Journi
                moves her from blank page to publication.
              </p>
            </motion.div>

            <div className="max-w-2xl mx-auto">
              {SCENARIO_STEPS.map((step, i) => {
                const Icon = step.icon;
                const isLast = i === SCENARIO_STEPS.length - 1;
                return (
                  <motion.div
                    key={step.step}
                    initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
                  >
                    <div className="flex gap-5 items-start">
                      {/* Step indicator + connector */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-10 h-10 rounded-full bg-journi-green/10 border border-journi-green/20 flex items-center justify-center">
                          <Icon size={18} className="text-journi-green" aria-hidden="true" />
                        </div>
                        {!isLast && <div className="w-0.5 h-8 bg-border mt-1" aria-hidden="true" />}
                      </div>

                      {/* Step content */}
                      <div className={`flex-1 p-6 rounded-2xl border border-border ${!isLast ? "mb-2" : ""}`}>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-bold text-journi-green tracking-widest">{step.step}</span>
                          <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                          {step.comingSoon && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              Coming soon
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.body}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {step.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-journi-green/10 text-journi-green border border-journi-green/20"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Mini CTA ──────────────────────────────────────────────────────── */}
        <section className="py-20 md:py-28 bg-muted/30">
          <div className="container">
            <motion.div
              className="relative rounded-2xl bg-gradient-to-br from-journi-green/10 via-journi-green/5 to-transparent border border-journi-green/20 p-12 md:p-16 text-center overflow-hidden"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            >
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Start your first manuscript project today
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
                Free to start. No setup. Bring your draft.
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

      </main>
      <Footer />
    </div>
  );
}
