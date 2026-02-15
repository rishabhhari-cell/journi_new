/**
 * Journi Landing Page — Nordic Academic Design
 * Hero with abstract background, feature sections, timeline preview, CTA
 */
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import {
  Users, FileText, Search, BarChart3, Clock, BookOpen,
  ArrowRight, CheckCircle2, Zap, Shield, Lock, HardDrive,
  Bold, Italic, Underline, List, Link2, Quote, Send,
  Filter, Star, Globe, ChevronRight, AlertCircle, Timer,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { loadFromStorage, saveToStorage } from "@/lib/storage";

const HERO_BG = "https://private-us-east-1.manuscdn.com/sessionFile/26L77Mx18FIvYFxOwaY7CL/sandbox/x4psCbR5WAhHiPiXSrPmLs-img-1_1770760353000_na1fn_am91cm5pLWhlcm8tYmc.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvMjZMNzdNeDE4Rkl2WUZ4T3dhWTdDTC9zYW5kYm94L3g0cHNDYlI1V0FoSGlQaVhTclBtTHMtaW1nLTFfMTc3MDc2MDM1MzAwMF9uYTFmbl9hbTkxY201cExXaGxjbTh0WW1jLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Li8jPJ6kQR09pF3Ue-y0iBKlDU7WzvypQMkqaflutokvvVBIXOsZ5uLDO~4xdM-oEJkE-ezmB8AXiKMVBN182AioCTktHVoJWG7-RGR7Os8DrzKovMjsnpzHYucprzI0htx8~Ef~MD82WwkcKXYy8rasZ9zrdJZFf69SNZtN~MvXAXmliWfvr~yNJvzZmeAK9UufRXJZ1NYeUJZr1wVIuICYCcAMTiHCIyvtGuwg4Xg0-foTvysCIZ~odecmEkOPKdT85wDPgb5PZ1oHnD122M6keSq0-KaDUp7xCu0~v6LxfPTzjHXn9aWEsXGr-FgfXn1XesIp4rQq5F6eKpWDRw__";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

// ============================================================================
// Inline Feature Preview Components (act as "screenshots")
// ============================================================================

function CollaborationPreview() {
  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      {/* Team header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-journi-green" />
          <span className="font-semibold text-foreground text-xs">Research Team</span>
        </div>
        <span className="text-[10px] text-muted-foreground">3 members online</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Team members */}
        {[
          { initials: "DR", name: "Dr. Sarah Chen", role: "Lead Author", color: "bg-journi-green" },
          { initials: "MJ", name: "Michael Johnson", role: "Co-Author", color: "bg-blue-500" },
          { initials: "AL", name: "Dr. Anna Lee", role: "Supervisor", color: "bg-purple-500" },
        ].map((m) => (
          <div key={m.name} className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-full ${m.color} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
              {m.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{m.name}</p>
              <p className="text-muted-foreground text-[10px]">{m.role}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-journi-green shrink-0" />
          </div>
        ))}
        {/* Activity preview */}
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</p>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-journi-green text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">SC</div>
            <p className="text-muted-foreground"><span className="text-foreground font-medium">Sarah</span> edited Section 3: Methodology</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">MJ</div>
            <p className="text-muted-foreground"><span className="text-foreground font-medium">Michael</span> added 2 citations</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelinePreview() {
  const tasks = [
    { name: "Literature Review", start: 5, width: 25, status: "bg-status-completed" },
    { name: "Ethics Approval", start: 15, width: 20, status: "bg-status-completed" },
    { name: "Data Collection", start: 30, width: 30, status: "bg-status-progress" },
    { name: "Statistical Analysis", start: 55, width: 20, status: "bg-status-pending" },
    { name: "Manuscript Draft", start: 70, width: 25, status: "bg-status-upcoming" },
  ];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-journi-green" />
          <span className="font-semibold text-foreground text-xs">Project Gantt Chart</span>
        </div>
        <div className="flex gap-1.5">
          <span className="px-2 py-0.5 rounded bg-journi-green/10 text-journi-green text-[10px] font-medium">Gantt</span>
          <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">List</span>
        </div>
      </div>
      <div className="p-4">
        {/* Month headers */}
        <div className="flex mb-3 ml-[110px]">
          {months.map((m) => (
            <div key={m} className="flex-1 text-[10px] text-muted-foreground text-center">{m}</div>
          ))}
        </div>
        {/* Gantt bars */}
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <div key={task.name} className="flex items-center gap-2">
              <span className="w-[100px] text-foreground truncate text-[10px] shrink-0">{task.name}</span>
              <div className="flex-1 relative h-5 bg-muted/50 rounded">
                <div
                  className={`absolute top-0.5 bottom-0.5 rounded ${task.status}`}
                  style={{ left: `${task.start}%`, width: `${task.width}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex gap-3 mt-4 pt-3 border-t border-border">
          {[
            { color: "bg-status-completed", label: "Done" },
            { color: "bg-status-progress", label: "Active" },
            { color: "bg-status-pending", label: "Pending" },
            { color: "bg-status-upcoming", label: "Upcoming" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${l.color}`} />
              <span className="text-[10px] text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiscoveryPreview() {
  const journals = [
    { name: "Nature Biotechnology", impact: 8.7, rate: "12%", days: 45, oa: true },
    { name: "Cell Reports", impact: 7.2, rate: "18%", days: 38, oa: true },
    { name: "Journal of Clinical Investigation", impact: 6.9, rate: "15%", days: 52, oa: false },
  ];

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-journi-green" />
          <span className="font-semibold text-foreground text-xs">Journal Discovery</span>
        </div>
        <div className="mt-2 flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5">
          <Search size={12} className="text-muted-foreground" />
          <span className="text-muted-foreground text-[10px]">Search by topic, journal, or conference...</span>
        </div>
        {/* Filter chips */}
        <div className="flex gap-1.5 mt-2">
          {["Impact Factor", "Open Access", "Subject Area"].map((f) => (
            <span key={f} className="px-2 py-0.5 rounded border border-border bg-card text-muted-foreground text-[10px]">{f}</span>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-2.5">
        {journals.map((j) => (
          <div key={j.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-journi-green/30 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-journi-green/10 flex items-center justify-center shrink-0">
              <BookOpen size={14} className="text-journi-green" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{j.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Star size={9} className="text-yellow-500" /> {j.impact}
                </span>
                <span className="text-[10px] text-muted-foreground">{j.rate} acceptance</span>
                <span className="text-[10px] text-muted-foreground">{j.days}d review</span>
                {j.oa && <span className="text-[10px] text-journi-green font-medium">OA</span>}
              </div>
            </div>
          </div>
        ))}
        <div className="text-center pt-2">
          <span className="text-[10px] text-muted-foreground">Showing 3 of 1,000+ journals</span>
        </div>
      </div>
    </div>
  );
}

function ManuscriptPreview() {
  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-1">
        {[Bold, Italic, Underline, List, Link2, Quote].map((Icon, i) => (
          <div key={i} className="w-6 h-6 rounded flex items-center justify-center hover:bg-accent text-muted-foreground">
            <Icon size={12} />
          </div>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-[10px] text-muted-foreground ml-1">Section 3: Methodology</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Simulated document content */}
        <div>
          <p className="text-foreground font-bold text-xs mb-1.5">3. Methodology</p>
          <p className="text-muted-foreground leading-relaxed">
            A randomized controlled trial was conducted across three clinical sites. Participants (n=245) were stratified by age group and baseline severity scores...
          </p>
        </div>
        <div className="bg-journi-green/5 border-l-2 border-journi-green rounded-r-lg p-2.5">
          <p className="text-[10px] text-journi-green font-semibold mb-0.5">Citation Added</p>
          <p className="text-muted-foreground text-[10px]">Smith, J. et al. (2024). "Clinical trial design patterns." <em>The Lancet</em>, 402, 112-119.</p>
        </div>
        {/* Comment */}
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
          <span className="text-[10px] text-muted-foreground">3 citations | 2 comments</span>
        </div>
      </div>
    </div>
  );
}

function AnalyticsPreview() {
  const bars = [65, 80, 45, 90, 70, 55, 85];
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <BarChart3 size={14} className="text-journi-green" />
        <span className="font-semibold text-foreground text-xs">Project Analytics</span>
      </div>
      <div className="p-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Tasks Done", value: "12/18", pct: 67 },
            { label: "On Track", value: "85%", pct: 85 },
            { label: "Days Left", value: "42", pct: 58 },
          ].map((s) => (
            <div key={s.label} className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-foreground font-bold text-sm">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <div className="h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-journi-green rounded-full" style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        {/* Mini bar chart */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Weekly Activity</p>
          <div className="flex items-end gap-1.5 h-16">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-journi-green/20 rounded-t" style={{ height: `${h}%` }}>
                  <div className="w-full h-full bg-journi-green rounded-t opacity-80" />
                </div>
                <span className="text-[9px] text-muted-foreground">{labels[i]}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Team contrib */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground">Top contributor:</span>
          <div className="w-5 h-5 rounded-full bg-journi-green text-white flex items-center justify-center text-[9px] font-bold">SC</div>
          <span className="text-foreground text-[10px] font-medium">Sarah Chen</span>
          <span className="text-muted-foreground text-[10px]">- 47 contributions</span>
        </div>
      </div>
    </div>
  );
}

function PublicationPreview() {
  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden text-[11px]">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send size={14} className="text-journi-green" />
          <span className="font-semibold text-foreground text-xs">Submission Tracker</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-journi-green/10 text-journi-green text-[10px] font-medium">3 active</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Submission cards */}
        {[
          { journal: "Nature Biotechnology", status: "Under Review", statusColor: "bg-status-progress", progress: 60 },
          { journal: "Cell Reports", status: "Revision", statusColor: "bg-yellow-500", progress: 75 },
          { journal: "PLOS ONE", status: "Accepted", statusColor: "bg-status-completed", progress: 100 },
        ].map((sub) => (
          <div key={sub.journal} className="p-2.5 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground font-medium text-[11px]">{sub.journal}</span>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full text-white ${sub.statusColor}`}>{sub.status}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${sub.statusColor}`} style={{ width: `${sub.progress}%` }} />
            </div>
            {/* Mini timeline */}
            <div className="flex items-center gap-1 mt-2">
              {["Submitted", "Review", "Decision"].map((step, i) => (
                <div key={step} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center ${i < (sub.progress > 60 ? 2 : 1) ? 'bg-status-completed' : 'bg-muted'}`}>
                    {i < (sub.progress > 60 ? 2 : 1) && <CheckCircle2 size={7} className="text-white" />}
                  </div>
                  <span className="text-[9px] text-muted-foreground">{step}</span>
                  {i < 2 && <div className={`w-4 h-px ${i < (sub.progress > 60 ? 2 : 1) - 1 ? 'bg-status-completed' : 'bg-border'}`} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Map feature titles to their preview components
const featurePreviews: Record<string, () => JSX.Element> = {
  "Team Collaboration": CollaborationPreview,
  "Project Timeline": TimelinePreview,
  "Journal Discovery": DiscoveryPreview,
  "Manuscript Editor": ManuscriptPreview,
  "Analytics Dashboard": AnalyticsPreview,
  "Publication Portal": PublicationPreview,
};

const features = [
  {
    icon: Users, title: "Team Collaboration",
    desc: "Real-time co-authoring with role-based access for lead authors, co-authors, and supervisors.",
    link: "/collaboration",
  },
  {
    icon: Clock, title: "Project Timeline",
    desc: "Interactive Gantt charts to track every phase of your research from ethics approval to publication.",
    link: "/dashboard",
  },
  {
    icon: Search, title: "Journal Discovery",
    desc: "Smart matching to find the right journals and conferences for your research from 1,000+ journals.",
    link: "/discovery",
  },
  {
    icon: FileText, title: "Manuscript Editor",
    desc: "Built-in scientific document editor with citation management and formatting templates.",
    link: "/collaboration",
  },
  {
    icon: BarChart3, title: "Analytics Dashboard",
    desc: "Track project progress, team productivity, and publication metrics in one place.",
    link: "/dashboard",
  },
  {
    icon: BookOpen, title: "Publication Portal",
    desc: "Streamlined submission workflow with timeline estimates for review and publication.",
    link: "/publication",
  },
];

const timelineSteps = [
  { phase: "Planning", status: "completed", label: "Ethics & Protocol" },
  { phase: "Data Collection", status: "progress", label: "Surveys & Experiments" },
  { phase: "Analysis", status: "pending", label: "Statistical Analysis" },
  { phase: "Writing", status: "upcoming", label: "Manuscript Draft" },
  { phase: "Publication", status: "upcoming", label: "Journal Submission" },
];

const statusColors: Record<string, string> = {
  completed: "bg-status-completed",
  progress: "bg-status-progress",
  pending: "bg-status-pending",
  delayed: "bg-status-delayed",
  upcoming: "bg-status-upcoming",
};

const statusLabels: Record<string, string> = {
  completed: "Completed",
  progress: "In Progress",
  pending: "Pending",
  delayed: "Delayed",
  upcoming: "Upcoming",
};

// Live stats tracking — stored in localStorage
interface PlatformStats {
  researchers: number;
  projects: number;
  submissions: number;
}

function useLiveStats() {
  const [stats, setStats] = useState<PlatformStats>(() => {
    const stored = loadFromStorage<PlatformStats | null>('platform_stats', null);
    return stored || { researchers: 0, projects: 0, submissions: 0 };
  });

  const incrementResearchers = () => {
    setStats((prev) => {
      const next = { ...prev, researchers: prev.researchers + 1 };
      saveToStorage('platform_stats', next);
      return next;
    });
  };

  return { stats, incrementResearchers };
}

export default function Home() {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const { stats: liveStats, incrementResearchers } = useLiveStats();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/30 to-white" />
        <div className="container relative z-10">
          <motion.div
            className="max-w-3xl"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-journi-green/10 text-journi-green text-xs font-semibold mb-6">
              <Zap size={14} />
              From Start-up to Write-up
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6">
              Your Research,{" "}
              <span className="text-journi-green">Simplified.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mb-8">
              Journi is the all-in-one platform that unifies research collaboration, project management, manuscript creation, and publication — so you can focus on what matters most: your research.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-journi-green text-journi-slate font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                Explore Dashboard
                <ArrowRight size={18} />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-6 py-3 rounded-lg hover:bg-accent transition-colors"
              >
                Learn More
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Platform Stats */}
      <section className="border-y border-border bg-muted/30">
        <div className="container py-10">
          <div className="grid grid-cols-3 gap-8">
            {[
              { value: liveStats.researchers, label: "Researchers Signed Up" },
              { value: liveStats.projects, label: "Active Projects" },
              { value: liveStats.submissions, label: "Submissions Tracked" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <p className="text-3xl md:text-4xl font-extrabold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid — Clickable with Popups */}
      <section id="features" className="py-20 md:py-28">
        <div className="container">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
              Everything You Need for Research
            </h2>
            <p className="text-muted-foreground text-lg">
              A unified platform designed for every stage of the research lifecycle. Hover over any feature to preview.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, i) => {
              const PreviewComponent = featurePreviews[feat.title];
              const isHovered = hoveredFeature === feat.title;
              return (
                <motion.div
                  key={feat.title}
                  className="relative rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-journi-green/5"
                  style={{ minHeight: "260px" }}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i}
                  onMouseEnter={() => setHoveredFeature(feat.title)}
                  onMouseLeave={() => setHoveredFeature(null)}
                >
                  {/* Default tile content */}
                  <div
                    className="p-6 absolute inset-0 flex flex-col justify-start transition-opacity duration-300"
                    style={{ opacity: isHovered ? 0 : 1, pointerEvents: isHovered ? "none" : "auto" }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-journi-green/10 flex items-center justify-center mb-4">
                      <feat.icon size={20} className="text-journi-green" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{feat.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                  </div>

                  {/* Preview pane on hover */}
                  <div
                    className="absolute inset-0 flex flex-col transition-opacity duration-300"
                    style={{ opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? "auto" : "none" }}
                  >
                    {/* Scaled-down preview as background */}
                    <div className="absolute inset-0 origin-top-left scale-[0.85] p-1 pointer-events-none opacity-60">
                      {PreviewComponent && <PreviewComponent />}
                    </div>
                    {/* Gradient overlay with text */}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
                    <div className="relative mt-auto p-5">
                      <h3 className="text-lg font-bold text-foreground mb-1.5">{feat.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{feat.desc}</p>
                      <Link
                        href={feat.link}
                        className="inline-flex items-center gap-1.5 text-xs text-journi-green font-semibold hover:underline"
                      >
                        Try {feat.title}
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline Preview Section */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
            >
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Track Every Milestone
              </h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Our interactive timeline keeps your entire research journey visible. From ethics approval to final publication, never lose track of where you are.
              </p>

              {/* Mini Timeline */}
              <div className="space-y-4">
                {timelineSteps.map((step, i) => (
                  <motion.div
                    key={step.phase}
                    className="flex items-center gap-4"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    custom={i + 1}
                  >
                    <div className="relative flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${statusColors[step.status]}`} />
                      {i < timelineSteps.length - 1 && (
                        <div className="w-0.5 h-8 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-between pb-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{step.phase}</p>
                        <p className="text-xs text-muted-foreground">{step.label}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[step.status]} text-white`}>
                        {statusLabels[step.status]}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="rounded-xl overflow-hidden shadow-2xl shadow-journi-green/10 border border-border"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
            >
              <TimelinePreview />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Collaboration Section */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              className="order-2 lg:order-1 rounded-xl overflow-hidden shadow-2xl shadow-journi-green/10 border border-border"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
            >
              <ManuscriptPreview />
            </motion.div>

            <motion.div
              className="order-1 lg:order-2"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
            >
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Collaborate Without Boundaries
              </h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Bring your entire research team together. Assign roles, track contributions, and co-author manuscripts in real-time.
              </p>
              <ul className="space-y-4">
                {[
                  "Real-time document co-editing",
                  "Role-based access control",
                  "Activity feed with @mentions",
                  "Integrated video meetings",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-journi-green shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Security & Trust Section */}
      <section className="py-20 md:py-28 bg-journi-slate text-white">
        <div className="container text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Your Research Data, Fully Secure
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto mb-12">
              All research and data is stored locally within your browser. Nothing is sent to external servers.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: HardDrive,
                title: "Local-First Storage",
                desc: "All your data is stored securely in your browser's localStorage. Your research never leaves your device."
              },
              {
                icon: Lock,
                title: "No External Servers",
                desc: "Journi operates entirely within your browser. No data is transmitted to or stored on external servers."
              },
              {
                icon: Shield,
                title: "Complete Data Privacy",
                desc: "You have full control over your data. Clear it anytime from your browser settings. No accounts or cloud storage required."
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="p-8 rounded-xl bg-white/5 border border-white/10"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
              >
                <item.icon size={28} className="text-journi-green mb-4 mx-auto" />
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28">
        <div className="container">
          <motion.div
            className="relative rounded-2xl bg-gradient-to-br from-journi-green/10 via-journi-green/5 to-transparent border border-journi-green/20 p-12 md:p-16 text-center overflow-hidden"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
              Ready to Transform Your Research?
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Start exploring Journi today and experience the future of research collaboration.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => {
                  incrementResearchers();
                  toast.success('Welcome to Journi!', {
                    description: 'Your account has been created. All data is stored locally in your browser.'
                  });
                }}
                className="inline-flex items-center gap-2 bg-journi-green text-journi-slate font-semibold px-8 py-3.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                Get Started Free
                <ArrowRight size={18} />
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 border border-border text-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-accent transition-colors"
              >
                Explore Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
