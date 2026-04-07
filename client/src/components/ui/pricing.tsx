import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import {
  CheckCircle2,
  Minus,
  Loader2,
  Zap,
  Star,
  Users,
  Building2,
} from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";

// ─── Plan data ────────────────────────────────────────────────────────────────

const plans = [
  {
    id: "free",
    tagline: "Starter",
    name: "Journie Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    priceLabel: null, // uses NumberFlow
    billingNote: "No credit card required",
    description:
      "Start structuring and tracking a single manuscript from idea to submission.",
    features: [
      "1 active manuscript project",
      "Up to 3 collaborators (view + comment)",
      "100 MB storage for attachments",
      "Journal finder with limited monthly runs",
      "Export to Word / PDF (Journie default format)",
    ],
    cta: "Get started free",
    ctaHref: "/dashboard",
    popular: false,
    icon: Zap,
  },
  {
    id: "pro",
    tagline: "Individual Pro",
    name: "Journie Pro",
    monthlyPrice: 18,
    yearlyPrice: 15,
    priceLabel: null, // uses NumberFlow
    billingNote: "Cancel anytime",
    description:
      "End-to-end manuscript submission workflow for busy clinician-researchers.",
    features: [
      "Up to 10 active manuscript projects",
      "Up to 10 collaborators per project",
      "5–10 GB storage for attachments and figures",
      "Unlimited journal finder with richer filters",
      "CONSORT, STROBE & other reporting checklists",
      "Full version history and change tracking",
      "Standard email support",
    ],
    cta: "Get started",
    ctaHref: null, // triggers checkout
    popular: true,
    icon: Star,
  },
  {
    id: "team",
    tagline: "Group / Lab",
    name: "Journie Team",
    monthlyPrice: null,
    yearlyPrice: null,
    priceLabel: "$10–12 / user / mo",
    billingNote: "Billed annually · min. 5 users",
    description:
      "Shared visibility and structure for departments, labs and research groups.",
    features: [
      "Up to 100 active projects (pooled)",
      "Up to 20 collaborators per manuscript",
      "Shared team workspace and project library",
      "Role-based access (owner, contributor, viewer)",
      "Shared lab templates and boilerplate sections",
      "Team dashboards and upcoming submission tracking",
      "Priority email support + optional onboarding session",
    ],
    cta: "Talk to us about a team plan",
    ctaHref: "/support",
    popular: false,
    icon: Users,
  },
  {
    id: "enterprise",
    tagline: "Institutional / CRO",
    name: "Journie Enterprise",
    monthlyPrice: null,
    yearlyPrice: null,
    priceLabel: "Custom pricing",
    billingNote: "Tailored to your organisation",
    description:
      "Enterprise-grade governance, analytics and integrations for institutions and CROs.",
    features: [
      "Unlimited projects (policy-based caps available)",
      "Organisation-wide roles and departments",
      "Custom governance and approval workflows",
      "SSO (SAML / OIDC) and SCIM user provisioning",
      "Audit logs for manuscript changes and approvals",
      "Advanced analytics — time-to-submission, throughput",
      "Dedicated customer success contact and training",
    ],
    cta: "Contact sales",
    ctaHref: "/support",
    popular: false,
    icon: Building2,
  },
];

// ─── Comparison table ─────────────────────────────────────────────────────────

const COMPARISON_ROWS = [
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
    enterprise: "Advanced — time-to-submission, throughput",
  },
  {
    feature: "Support",
    free: "Community",
    pro: "Standard email",
    team: "Priority email + onboarding",
    enterprise: "Dedicated customer success",
  },
];

// ─── PricingSwitch ────────────────────────────────────────────────────────────

const PricingSwitch = ({
  onSwitch,
  className,
}: {
  onSwitch: (value: string) => void;
  className?: string;
}) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className={cn("flex justify-center", className)}>
      <div className="relative z-10 mx-auto flex w-fit rounded-xl bg-muted border border-border p-1">
        <button
          onClick={() => handleSwitch("0")}
          className={cn(
            "relative z-10 w-fit cursor-pointer h-12 rounded-xl sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors sm:text-base text-sm",
            selected === "0"
              ? "text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {selected === "0" && (
            <motion.span
              layoutId={"switch"}
              className="absolute top-0 left-0 h-12 w-full rounded-xl border-4 shadow-sm shadow-journi-green/40 border-journi-green bg-gradient-to-t from-journi-green-dark via-journi-green to-journi-green-light"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly</span>
        </button>

        <button
          onClick={() => handleSwitch("1")}
          className={cn(
            "relative z-10 w-fit cursor-pointer h-12 flex-shrink-0 rounded-xl sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors sm:text-base text-sm",
            selected === "1"
              ? "text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {selected === "1" && (
            <motion.span
              layoutId={"switch"}
              className="absolute top-0 left-0 h-12 w-full rounded-xl border-4 shadow-sm shadow-journi-green/40 border-journi-green bg-gradient-to-t from-journi-green-dark via-journi-green to-journi-green-light"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Annually
            <span className="rounded-full bg-journi-green/15 px-2 py-0.5 text-xs font-medium text-foreground">
              Save 20%
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

// ─── ComparisonTable ──────────────────────────────────────────────────────────

function ComparisonTable() {
  const planKeys = ["free", "pro", "team", "enterprise"] as const;
  const headers: { key: typeof planKeys[number] | "feature"; label: string }[] = [
    { key: "feature", label: "Feature" },
    { key: "free", label: "Starter" },
    { key: "pro", label: "Pro" },
    { key: "team", label: "Team" },
    { key: "enterprise", label: "Enterprise" },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table
        className="w-full text-sm"
        aria-label="Feature comparison across all Journie plans"
      >
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-5 py-4 text-left font-semibold whitespace-nowrap",
                  col.key === "feature"
                    ? "text-foreground min-w-[180px]"
                    : "text-journi-green min-w-[130px]"
                )}
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
              className={cn(
                "border-b border-border last:border-0",
                i % 2 === 0 ? "bg-background" : "bg-muted/20"
              )}
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

// ─── Main component ───────────────────────────────────────────────────────────

interface PricingSection5Props {
  onCheckout?: () => void;
  checkoutLoading?: boolean;
}

export default function PricingSection5({ onCheckout, checkoutLoading }: PricingSection5Props) {
  const [isYearly, setIsYearly] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: { delay: i * 0.4, duration: 0.5 },
    }),
    hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
  };

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value, 10) === 1);

  return (
    <div
      className="px-4 pt-20 pb-28 max-w-7xl mx-auto relative"
      ref={pricingRef}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <article className="text-left mb-8 space-y-4 max-w-2xl">
        <h2 className="md:text-6xl text-4xl font-extrabold text-foreground mb-4">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-start"
            transition={{ type: "spring", stiffness: 250, damping: 40, delay: 0 }}
          >
            Choose the plan that's right for your research
          </VerticalCutReveal>
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="md:text-base text-sm text-muted-foreground w-[80%]"
        >
          Start free, then scale from individual projects to labs, institutions, and CROs.
        </TimelineContent>

        <TimelineContent
          as="div"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
        >
          <PricingSwitch onSwitch={togglePricingPeriod} className="w-fit" />
        </TimelineContent>
      </article>

      {/* ── Plan cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start py-4">
        {plans.map((plan, index) => {
          const Icon = plan.icon;
          const isCheckoutPlan = plan.id === "pro";

          return (
            <TimelineContent
              key={plan.id}
              as="div"
              animationNum={2 + index}
              timelineRef={pricingRef}
              customVariants={revealVariants}
              className="h-full"
            >
              <Card
                className={cn(
                  "relative flex flex-col h-full transition-all",
                  plan.popular
                    ? "ring-2 ring-journi-green bg-journi-green/5 shadow-xl shadow-journi-green/10"
                    : "border border-[#7B71C7]/45 hover:border-[#7B71C7]/75 hover:shadow-lg hover:shadow-[#7B71C7]/15 bg-card"
                )}
              >
                <CardHeader className="text-left pb-4">
                  {/* Recommended badge */}
                  {plan.popular && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-journi-green text-journi-slate select-none">
                        <Star size={9} fill="currentColor" aria-hidden="true" />
                        Recommended
                      </span>
                    </div>
                  )}

                  {/* Icon + tier label + plan name */}
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        plan.popular ? "bg-journi-green/20" : "bg-journi-green/10"
                      )}
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

                  {/* Price */}
                  <div className="mt-5">
                    {plan.priceLabel ? (
                      <p className="text-3xl font-extrabold text-foreground tracking-tight">
                        {plan.priceLabel}
                      </p>
                    ) : (
                      <div className="flex items-baseline gap-0.5">
                        {plan.monthlyPrice === 0 ? (
                          <p className="text-3xl font-extrabold text-foreground tracking-tight">
                            Free
                          </p>
                        ) : (
                          <>
                            <span className="text-3xl font-extrabold text-foreground">$</span>
                            <NumberFlow
                              format={{ maximumFractionDigits: 0 }}
                              value={isYearly ? (plan.yearlyPrice ?? 0) : (plan.monthlyPrice ?? 0)}
                              className="text-3xl font-extrabold text-foreground"
                            />
                            <span className="text-muted-foreground ml-1 text-sm">
                              / {isYearly ? "mo, billed annually" : "month"}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{plan.billingNote}</p>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="pt-0 flex flex-col flex-1">
                  {/* Feature list */}
                  <ul className="space-y-2.5 flex-1" aria-label="Included features">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <CheckCircle2
                          size={14}
                          className="text-journi-green shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span className="text-sm text-foreground leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA button */}
                  <div className="mt-8">
                    {isCheckoutPlan ? (
                      <button
                        type="button"
                        onClick={onCheckout}
                        disabled={checkoutLoading}
                        className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg text-sm font-semibold bg-journi-green text-journi-slate hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/40"
                      >
                        {checkoutLoading ? (
                          <>
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            Redirecting…
                          </>
                        ) : (
                          plan.cta
                        )}
                      </button>
                    ) : plan.id === "enterprise" ? (
                      <a
                        href={plan.ctaHref ?? "/support"}
                        className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg text-sm font-semibold bg-[#9999cc] text-white hover:bg-[#7B71C7] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9999cc]/40"
                      >
                        {plan.cta}
                      </a>
                    ) : (
                      <a
                        href={plan.ctaHref ?? "/dashboard"}
                        className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg text-sm font-semibold border border-[#9999cc] text-foreground hover:bg-[#9999cc] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9999cc]/40"
                      >
                        {plan.cta}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TimelineContent>
          );
        })}
      </div>

      {/* ── Comparison table ─────────────────────────────────────────────────── */}
      <div className="mt-20">
        <h3 className="text-2xl font-extrabold text-foreground mb-2 text-center">
          Compare all plans
        </h3>
        <p className="text-muted-foreground text-sm text-center mb-8">
          Everything you need to pick the right fit for your work.
        </p>
        <ComparisonTable />
      </div>
    </div>
  );
}
