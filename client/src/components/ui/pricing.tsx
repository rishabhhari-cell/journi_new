import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { Briefcase, CheckCheck, Database, Loader2, Server } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";

const plans = [
  {
    name: "Starter",
    description: "Great for small research teams getting started with Journi",
    price: 12,
    yearlyPrice: 99,
    buttonText: "Get started",
    buttonVariant: "outline" as const,
    features: [
      { text: "Up to 10 boards per workspace", icon: <Briefcase size={20} /> },
      { text: "Up to 10GB storage", icon: <Database size={20} /> },
      { text: "Limited analytics", icon: <Server size={20} /> },
    ],
    includes: [
      "Free includes:",
      "Unlimited cards",
      "Custom backgrounds and stickers",
      "2-factor authentication",
      "Up to 2 individual users",
      "Up to 2 workspaces",
    ],
  },
  {
    name: "Business",
    description: "Best value for growing research groups and institutions",
    price: 48,
    yearlyPrice: 399,
    buttonText: "Get started",
    buttonVariant: "default" as const,
    popular: true,
    features: [
      { text: "Unlimited boards", icon: <Briefcase size={20} /> },
      { text: "Storage (250MB/file)", icon: <Database size={20} /> },
      { text: "100 workspace command runs", icon: <Server size={20} /> },
    ],
    includes: [
      "Everything in Starter, plus:",
      "Advanced checklists",
      "Custom fields",
      "Serverless functions",
      "Up to 10 individual users",
      "Up to 10 workspaces",
    ],
  },
  {
    name: "Enterprise",
    description: "Advanced security and unlimited access for large teams",
    price: 96,
    yearlyPrice: 899,
    buttonText: "Get started",
    buttonVariant: "outline" as const,
    features: [
      { text: "Unlimited board access", icon: <Briefcase size={20} /> },
      { text: "Unlimited storage", icon: <Database size={20} /> },
      { text: "Unlimited workspaces", icon: <Server size={20} /> },
    ],
    includes: [
      "Everything in Business, plus:",
      "Multi-board management",
      "Guest permissions",
      "Attachment permissions",
      "Custom roles",
      "Custom boards",
    ],
  },
];

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
          <span className="relative">Monthly Billing</span>
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
            Yearly Billing
            <span className="rounded-full bg-journi-green/15 px-2 py-0.5 text-xs font-medium text-foreground">
              Save 20%
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

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
      transition: {
        delay: i * 0.4,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value, 10) === 1);

  return (
    <div
      className="px-4 pt-20 min-h-screen max-w-7xl mx-auto relative"
      ref={pricingRef}
    >
      <article className="text-left mb-6 space-y-4 max-w-2xl">
        <h2 className="md:text-6xl text-4xl capitalize font-medium text-foreground mb-4">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-start"
            transition={{
              type: "spring",
              stiffness: 250,
              damping: 40,
              delay: 0,
            }}
          >
            We've got a plan that's perfect for your research team
          </VerticalCutReveal>
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="md:text-base text-sm text-muted-foreground w-[80%]"
        >
          Trusted by teams around the world. Explore which option is right for you.
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

      <div className="grid md:grid-cols-3 gap-4 py-6">
        {plans.map((plan, index) => (
          <TimelineContent
            key={plan.name}
            as="div"
            animationNum={2 + index}
            timelineRef={pricingRef}
            customVariants={revealVariants}
          >
            <Card
              className={cn(
                "relative border border-border",
                plan.popular ? "ring-2 ring-journi-green bg-journi-green/10" : "bg-card"
              )}
            >
              <CardHeader className="text-left">
                <div className="flex justify-between">
                  <h3 className="xl:text-3xl md:text-2xl text-3xl font-semibold text-foreground mb-2">
                    {plan.name} Plan
                  </h3>
                  {plan.popular && (
                    <span className="bg-journi-green text-white px-3 py-1 rounded-full text-sm font-medium">
                      Popular
                    </span>
                  )}
                </div>
                <p className="xl:text-sm md:text-xs text-sm text-muted-foreground mb-4">
                  {plan.description}
                </p>
                <div className="space-y-2">
                  {plan.features.map((feature) => (
                    <div key={feature.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="text-journi-green">{feature.icon}</span>
                      <span>{feature.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-baseline pt-4">
                  <span className="text-4xl font-semibold text-foreground">$</span>
                  <NumberFlow
                    format={{ maximumFractionDigits: 0 }}
                    value={isYearly ? plan.yearlyPrice : plan.price}
                    className="text-4xl font-semibold text-foreground"
                  />
                  <span className="text-muted-foreground ml-1">/{isYearly ? "year" : "month"}</span>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <button
                  onClick={plan.popular ? onCheckout : undefined}
                  disabled={plan.popular ? checkoutLoading : false}
                  className={cn(
                    "w-full mb-3 p-4 text-xl rounded-xl",
                    plan.popular
                      ? "bg-gradient-to-t from-journi-green-dark to-journi-green shadow-lg shadow-journi-green/40 border border-journi-green-light text-white disabled:opacity-70"
                      : plan.buttonVariant === "outline"
                        ? "bg-gradient-to-t from-journi-slate to-journi-slate/80 shadow-lg shadow-journi-slate/30 border border-journi-slate/70 text-white"
                        : ""
                  )}
                >
                  {plan.popular && checkoutLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Redirecting...
                    </span>
                  ) : (
                    plan.buttonText
                  )}
                </button>
                <button className="w-full mb-6 p-4 text-xl rounded-xl bg-white text-journi-slate border border-journi-purple/30 shadow-lg shadow-journi-purple/15">
                  Contact sales
                </button>

                <div className="space-y-3 pt-4 border-t border-border">
                  <h2 className="text-xl font-semibold uppercase text-foreground mb-3">
                    Features
                  </h2>
                  <h4 className="font-medium text-base text-foreground mb-3">
                    {plan.includes[0]}
                  </h4>
                  <ul className="space-y-2 font-semibold">
                    {plan.includes.slice(1).map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <span className="h-6 w-6 bg-white border border-journi-green rounded-full grid place-content-center mt-0.5 mr-3">
                          <CheckCheck className="h-4 w-4 text-journi-green" />
                        </span>
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
        ))}
      </div>
    </div>
  );
}

