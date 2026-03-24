/**
 * PricingSection — Journi Plans & Pricing
 *
 * To adjust pricing or feature lists, edit the PLANS constant below.
 * Each plan object drives both the plan cards AND the comparison table.
 * Toggle `recommended: true` on whichever plan should be visually highlighted.
 *
 * Comparison table rows are defined in COMPARISON_ROWS; add/remove rows there
 * to keep the table in sync with plan features without touching JSX.
 */

import { motion } from "framer-motion";
import {
  CheckCircle2, Minus, Star, ArrowRight,
  Zap, Users, Building2,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.09, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: "free" | "pro" | "team" | "enterprise";
  /** Short tier label shown above the plan name */
  tagline: string;
  name: string;
  price: string;
  /** Shown in green beneath the primary price (e.g. annual rate) */
  priceAlt?: string;
  billingNote: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  recommended?: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface ComparisonRow {
  feature: string;
  /** Use "✓" for a green tick, "—" for a dash, or any string for literal text */
  free: string;
  pro: string;
  team: string;
  enterprise: string;
}

// ─── Plan configuration ───────────────────────────────────────────────────────
// Edit here to change copy, pricing, or features across cards + comparison table.

const PLANS: Plan[] = [
  {
    id: "free",
    tagline: "Free",
    name: "Journi Starter",
    price: "Free",
    billingNote: "No credit card required",
    description:
      "Start structuring and tracking a single manuscript from idea to submission.",
    features: [
      "1 active manuscript project",
      "Up to 3 collaborators (view + comment)",
      "100 MB storage for attachments",
      "Structured workspace — sections, notes & progress status",
      "Basic manuscript timeline and deadline reminders",
      "Journal finder with limited monthly runs",
      "Export to Word / PDF (Journi default format)",
    ],
    cta: "Get started",
    ctaHref: "/signup?plan=free",
    icon: Zap,
  },
  {
    id: "pro",
    tagline: "Individual Pro",
    name: "Journi Pro",
    price: "$18 / month",
    priceAlt: "$15 / month billed annually",
    billingNote: "Cancel anytime",
    description:
      "End‑to‑end manuscript submission workflow for busy clinician‑researchers.",
    features: [
      "Up to 10 active manuscript projects",
      "Up to 10 collaborators per project",
      "More storage for attachments and figures (5–10 GB)",
      "Full manuscript workflow from draft to submission",
      "Templates for common study types (RCTs, audits, observational)",
      "Integrated CONSORT, STROBE & other reporting checklists",
      "Journal finder — unlimited runs with richer filters (OA, scope, impact)",
      "Personal project board with statuses and key dates",
      "Full version history and change tracking",
      "Standard email support",
    ],
    cta: "Get started",
    ctaHref: "/signup?plan=pro",
    recommended: true,
    icon: Star,
  },
  {
    id: "team",
    tagline: "Group / Lab",
    name: "Journi Team",
    price: "$10–12 / user / month",
    billingNote: "Billed annually · minimum 5 users",
    description:
      "Shared visibility and structure for departments, labs and research groups.",
    features: [
      "Up to 100 active projects across the team (pooled)",
      "Up to 20 collaborators per manuscript",
      "Shared team workspace and project library",
      "Role‑based access (owner, contributor, viewer)",
      "Shared lab templates and boilerplate sections",
      "Team dashboards — active projects and upcoming submissions",
      "Centralised billing and team admin",
      "Priority email support",
      "Optional onboarding session for the group",
    ],
    cta: "Talk to us about a team plan",
    ctaHref: "/contact?type=team",
    icon: Users,
  },
  {
    id: "enterprise",
    tagline: "Institutional / CRO",
    name: "Journi Enterprise",
    price: "Custom pricing",
    priceAlt: "From $5,000–10,000 / year + per‑seat",
    billingNote: "Tailored to your organisation",
    description:
      "Enterprise‑grade governance, analytics and integrations for institutions and CROs.",
    features: [
      "Effectively unlimited projects (policy‑based caps available)",
      "Organisation‑wide roles and departments",
      "Central registry of all manuscripts and research outputs",
      "Custom approval workflows — governance sign‑off before submission",
      "Organisation‑level templates and compliance content",
      "Advanced analytics (time‑to‑submission, throughput by PI / team)",
      "SSO (SAML / OIDC) and SCIM user provisioning",
      "Audit logs for manuscript changes and approvals",
      "Integrations: institutional repositories, CRIS, grant systems (configurable)",
      "Dedicated customer success contact and training sessions",
    ],
    cta: "Contact sales",
    ctaHref: "/contact?type=enterprise",
    icon: Building2,
  },
];

// ─── Comparison table rows ────────────────────────────────────────────────────

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Active projects",
    free: "1",
    pro: "Up to 10",
    team: "Up to 100 (pooled)",
    enterprise: "Unlimited",
  },
  {
    feature: "Collaborators per project",
    free: "3 (view + comment)",
    pro: "10",
    team: "20",
    enterprise: "Unlimited",
  },
  {
    feature: "Storage",
    free: "100 MB",
    pro: "5–10 GB",
    team: "Pooled team storage",
    enterprise: "Custom",
  },
  {
    feature: "Journal finder",
    free: "Limited runs / month",
    pro: "Unlimited + richer filters",
    team: "✓",
    enterprise: "✓",
  },
  {
    feature: "Templates & checklists",
    free: "—",
    pro: "✓ CONSORT, STROBE & more",
    team: "✓ + shared lab templates",
    enterprise: "✓ + custom institutional",
  },
  {
    feature: "Version history",
    free: "—",
    pro: "✓",
    team: "✓",
    enterprise: "✓",
  },
  {
    feature: "Team workspace",
    free: "—",
    pro: "—",
    team: "✓",
    enterprise: "✓",
  },
  {
    feature: "Governance & approvals",
    free: "—",
    pro: "—",
    team: "—",
    enterprise: "✓",
  },
  {
    feature: "SSO & SCIM provisioning",
    free: "—",
    pro: "—",
    team: "—",
    enterprise: "✓",
  },
  {
    feature: "Analytics",
    free: "—",
    pro: "Personal project board",
    team: "Team dashboards",
    enterprise: "Advanced — time‑to‑submission, throughput",
  },
  {
    feature: "Support",
    free: "Community",
    pro: "Standard email",
    team: "Priority email + onboarding",
    enterprise: "Dedicated customer success",
  },
];

// ─── PlanTag ─────────────────────────────────────────────────────────────────

function PlanTag() {
  return (
    <span
      role="note"
      aria-label="Recommended plan"
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-journi-green text-journi-slate select-none"
    >
      <Star size={9} fill="currentColor" aria-hidden="true" />
      Recommended
    </span>
  );
}

// ─── PlanFeatureList ──────────────────────────────────────────────────────────

function PlanFeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2.5 mt-5" aria-label="Included features">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2.5">
          <CheckCircle2
            size={15}
            className="text-journi-green shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span className="text-sm text-foreground leading-relaxed">{feature}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── PlanCard ────────────────────────────────────────────────────────────────

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const Icon = plan.icon;

  return (
    <motion.article
      className={`relative flex flex-col p-7 rounded-2xl border transition-all focus-within:ring-2 focus-within:ring-journi-green/40 ${
        plan.recommended
          ? "border-journi-green/50 bg-journi-green/5 shadow-xl shadow-journi-green/10"
          : "border-border bg-card hover:border-journi-green/40 hover:shadow-lg hover:shadow-journi-green/5"
      }`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeUp}
      custom={index}
      aria-label={`${plan.name} plan${plan.recommended ? " — recommended" : ""}`}
    >
      {/* Recommended badge */}
      {plan.recommended && (
        <div className="mb-3">
          <PlanTag />
        </div>
      )}

      {/* Icon + tier + name */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            plan.recommended ? "bg-journi-green/20" : "bg-journi-green/10"
          }`}
        >
          <Icon size={19} className="text-journi-green" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {plan.tagline}
          </p>
          <h3 className="text-lg font-extrabold text-foreground leading-tight">
            {plan.name}
          </h3>
        </div>
      </div>

      {/* Price block */}
      <div className="mt-5">
        <p className="text-3xl font-extrabold text-foreground tracking-tight">
          {plan.price}
        </p>
        {plan.priceAlt && (
          <p className="text-sm text-journi-green font-medium mt-0.5">{plan.priceAlt}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{plan.billingNote}</p>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mt-4">
        {plan.description}
      </p>

      {/* Feature list grows to fill card height */}
      <div className="flex-1">
        <PlanFeatureList features={plan.features} />
      </div>

      {/* CTA button */}
      <a
        href={plan.ctaHref}
        className={`inline-flex items-center justify-center gap-2 w-full mt-8 px-5 py-3 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green ${
          plan.recommended
            ? "bg-journi-green text-journi-slate hover:opacity-90"
            : plan.id === "enterprise"
            ? "bg-journi-slate text-white hover:opacity-90"
            : "border border-border text-foreground hover:bg-accent"
        }`}
      >
        {plan.cta}
        {(plan.id === "free" || plan.id === "pro") && (
          <ArrowRight size={15} aria-hidden="true" />
        )}
      </a>
    </motion.article>
  );
}

// ─── ComparisonTable ──────────────────────────────────────────────────────────

function ComparisonTable() {
  const planKeys = ["free", "pro", "team", "enterprise"] as const;
  const headers: { key: typeof planKeys[number] | "feature"; label: string }[] = [
    { key: "feature", label: "Feature" },
    { key: "free",    label: "Starter" },
    { key: "pro",     label: "Pro" },
    { key: "team",    label: "Team" },
    { key: "enterprise", label: "Enterprise" },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table
        className="w-full text-sm"
        aria-label="Feature comparison across all Journi plans"
      >
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-5 py-4 text-left font-semibold whitespace-nowrap ${
                  col.key === "feature"
                    ? "text-foreground min-w-[180px]"
                    : "text-journi-green min-w-[130px]"
                }`}
              >
                {col.key === "pro" ? (
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    <span
                      aria-label="Recommended"
                      className="px-1.5 py-0.5 rounded-full bg-journi-green text-journi-slate text-[9px] font-bold leading-none"
                    >
                      ★
                    </span>
                  </span>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row, i) => (
            <tr
              key={row.feature}
              className={`border-b border-border last:border-0 ${
                i % 2 === 0 ? "bg-background" : "bg-muted/20"
              }`}
            >
              <td className="px-5 py-3.5 font-medium text-foreground">{row.feature}</td>
              {planKeys.map((key) => {
                const val = row[key];
                return (
                  <td key={key} className="px-5 py-3.5">
                    {val === "✓" ? (
                      <CheckCircle2
                        size={16}
                        className="text-journi-green"
                        aria-label="Included"
                      />
                    ) : val === "—" ? (
                      <Minus
                        size={16}
                        className="text-muted-foreground/40"
                        aria-label="Not included"
                      />
                    ) : (
                      <span className="text-foreground">{val}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── PricingSection ───────────────────────────────────────────────────────────

export default function PricingSection() {
  return (
    <section
      className="py-20 md:py-28 bg-muted/30"
      aria-labelledby="pricing-heading"
    >
      <div className="container">
        {/* Hero copy */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <h2
            id="pricing-heading"
            className="text-3xl md:text-4xl font-extrabold text-foreground mb-4"
          >
            Choose the Journi plan that's right for your research
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Start free, then scale from individual projects to labs, institutions, and CROs.
          </p>
        </motion.div>

        {/* Plan cards — 4 across on xl, 2×2 on md, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i + 1} />
          ))}
        </div>

        {/* Compare all plans */}
        <motion.div
          className="mt-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <h3 className="text-2xl font-extrabold text-foreground mb-2 text-center">
            Compare all plans
          </h3>
          <p className="text-muted-foreground text-sm text-center mb-8">
            Everything you need to pick the right fit for your work.
          </p>
          <ComparisonTable />
        </motion.div>
      </div>
    </section>
  );
}
