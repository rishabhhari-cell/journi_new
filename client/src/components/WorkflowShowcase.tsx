import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  LayoutPanelTop,
  MessageSquare,
  Search,
  Send,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

type WorkflowKey = "choose" | "write" | "submit";
type PreviewVariant = "journal-ranking" | "editor-structure" | "submission-pipeline";

interface WorkflowTab {
  key: WorkflowKey;
  label: string;
  icon: LucideIcon;
  routeLabel: string;
  headline: string;
  supportingCopy: string;
  ctaLabel: string;
  ctaHref: string;
  previewVariant: PreviewVariant;
}

const WORKFLOW_TABS: WorkflowTab[] = [
  {
    key: "choose",
    label: "Choose",
    icon: Search,
    routeLabel: "journi.app/discovery",
    headline: "Find the best-fit journal in one ranked view",
    supportingCopy:
      "Match score, review speed, and requirements are surfaced together so you can choose confidently.",
    ctaLabel: "Open Journal Finder",
    ctaHref: "/discovery",
    previewVariant: "journal-ranking",
  },
  {
    key: "write",
    label: "Write",
    icon: FileText,
    routeLabel: "journi.app/collaboration",
    headline: "Write in a structured editor built for submissions",
    supportingCopy:
      "Keep sections and compliance checks aligned while co-authors contribute in one shared workspace.",
    ctaLabel: "Open Manuscript Editor",
    ctaHref: "/collaboration",
    previewVariant: "editor-structure",
  },
  {
    key: "submit",
    label: "Submit",
    icon: Send,
    routeLabel: "journi.app/publication",
    headline: "Track submissions and revisions without spreadsheet overhead",
    supportingCopy:
      "See statuses at a glance and keep your revision workflow moving from review to resubmission.",
    ctaLabel: "Open Submission Tracker",
    ctaHref: "/publication",
    previewVariant: "submission-pipeline",
  },
];

function GlassCard({ className, children }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-background/90 shadow-sm", className)}>
      {children}
    </div>
  );
}

function PreviewMockup({ variant }: { variant: PreviewVariant }) {
  if (variant === "journal-ranking") {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Journal Ranking</p>
            <span className="rounded-full bg-journi-green/10 px-2 py-0.5 text-[10px] font-semibold text-journi-green">
              Fit first
            </span>
          </div>
          <div className="space-y-2.5">
            {[
              { journal: "BMJ Open", score: 94 },
              { journal: "PLOS Medicine", score: 88 },
              { journal: "BMC Medicine", score: 84 },
            ].map((item) => (
              <div key={item.journal} className="rounded-lg border border-border p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">{item.journal}</p>
                  <p className="text-xs font-semibold text-journi-green">{item.score}%</p>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-journi-green" style={{ width: `${item.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={14} className="text-journi-green" />
            <p className="text-xs font-semibold text-foreground">Quick Signals</p>
          </div>
          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <p className="rounded-md bg-muted/60 px-2.5 py-2">Scope overlap: High</p>
            <p className="rounded-md bg-muted/60 px-2.5 py-2">Median decision: 42 days</p>
            <p className="rounded-md bg-muted/60 px-2.5 py-2">OA option: Available</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (variant === "editor-structure") {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.85fr_1.15fr]">
        <GlassCard className="p-3.5">
          <p className="mb-2 text-xs font-semibold text-foreground">Sections</p>
          <div className="space-y-1.5 text-[11px]">
            {[
              ["Background", "420 / 500"],
              ["Methods", "780 / 900"],
              ["Results", "650 / 700"],
              ["Discussion", "360 / 500"],
            ].map((item) => (
              <div key={item[0]} className="rounded-lg border border-border px-2.5 py-2">
                <p className="font-medium text-foreground">{item[0]}</p>
                <p className="text-muted-foreground">{item[1]} words</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2.5 flex items-center gap-2 border-b border-border pb-2">
            <LayoutPanelTop size={14} className="text-journi-green" />
            <p className="text-xs font-semibold text-foreground">Structured Editor</p>
          </div>
          <p className="mb-2 text-xs font-semibold text-foreground">Methods</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Patients were randomized 1:1 to intervention and control groups using block randomization stratified by
            site. Allocation was concealed and assessors remained blinded...
          </p>
          <div className="mt-3 rounded-lg border border-journi-green/25 bg-journi-green/10 p-2.5 text-[11px] text-journi-slate">
            Auto-format check passed. IMRAD structure valid.
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {[
        { title: "Submitted", items: ["BMJ Open", "BMC Medicine"] },
        { title: "Under Review", items: ["JAMA Internal Medicine"] },
        { title: "Revision", items: ["PLOS Medicine"] },
      ].map((column) => (
        <GlassCard key={column.title} className="p-3.5">
          <p className="mb-2 text-xs font-semibold text-foreground">{column.title}</p>
          <div className="space-y-1.5">
            {column.items.map((item) => (
              <div key={item} className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs text-foreground">
                {item}
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
      <GlassCard className="md:col-span-3 p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare size={14} className="text-journi-green" />
          <p className="text-xs font-semibold text-foreground">Revision Readiness</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Response letter drafted", progress: 100 },
            { label: "Revised manuscript updated", progress: 85 },
            { label: "Checklist completed", progress: 72 },
          ].map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <p className="text-muted-foreground">{item.label}</p>
                <p className="font-semibold text-foreground">{item.progress}%</p>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-journi-green" style={{ width: `${item.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

interface WorkflowShowcaseProps {
  animateWhen?: boolean;
  entranceDelay?: number;
}

export default function WorkflowShowcase({
  animateWhen = true,
  entranceDelay = 0.12,
}: WorkflowShowcaseProps) {
  const [activeTab, setActiveTab] = useState<WorkflowKey>("choose");
  const currentTab = WORKFLOW_TABS.find((tab) => tab.key === activeTab) ?? WORKFLOW_TABS[0];

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 24 }}
      animate={animateWhen ? { opacity: 1, y: 0 } : undefined}
      transition={{ delay: entranceDelay, duration: 0.5, ease: [0, 0, 0.2, 1] }}
    >
      <div className="mb-2.5 flex flex-wrap gap-1.5" role="tablist" aria-label="Journie workflow showcase">
        {WORKFLOW_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              activeTab === tab.key
                ? "bg-journi-green text-journi-slate shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-journi-green/8">
        <div className="border-b border-border bg-muted/35 px-4 py-2.5">
          <span className="text-xs font-mono text-muted-foreground">{currentTab.routeLabel}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab.key}
            role="tabpanel"
            aria-label={`${currentTab.label} preview`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="min-h-[200px] bg-gradient-to-br from-journi-green/7 via-background to-muted/40 p-4 md:min-h-[335px] md:p-5">
              <PreviewMockup variant={currentTab.previewVariant} />
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="border-t border-border bg-background px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{currentTab.headline}</p>
          <p className="mt-1 max-w-[54ch] text-xs leading-relaxed text-muted-foreground">
            {currentTab.supportingCopy}
          </p>
          <div className="mt-2.5">
            <Link
              href={currentTab.ctaHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-journi-green hover:underline"
            >
              {currentTab.ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
