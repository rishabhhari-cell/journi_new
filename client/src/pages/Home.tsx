/**
 * Journi MVP Landing Page
 * Content per Demo Feedback.md
 */
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import {
  FileText, Search, Send, ArrowRight, CheckCircle2,
  ChevronRight, FlaskConical, Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import WorkflowShowcase from "@/components/WorkflowShowcase";
import HeroShader from "@/components/ui/hero";
import HeroLogoAnimation from "@/components/HeroLogoAnimation";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.09, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { openModal, signInAsGuest } = useAuth();
  const [, navigate] = useLocation();
  const [logoDone, setLogoDone] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <HeroShader className="pt-24 pb-0 md:pt-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            {/* Left */}
            <div className="pt-0 pb-8">
              <div className="mb-5">
                <HeroLogoAnimation onComplete={() => setLogoDone(true)} />
                <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1] mt-3">
                  <motion.span
                    className="inline-block"
                    initial={{ opacity: 0, y: 16 }}
                    animate={logoDone ? { opacity: 1, y: 0 } : undefined}
                    transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
                  >
                    Research,
                  </motion.span>
                  <br />
                  <span className="text-journi-green inline-block">
                    {"simplified.".split("").map((char, index) => (
                      <motion.span
                        key={index}
                        initial={{ opacity: 0, display: "none" }}
                        animate={logoDone ? { opacity: 1, display: "inline" } : undefined}
                        transition={{ duration: 0.01, delay: 0.5 + index * 0.08 }}
                      >
                        {char}
                      </motion.span>
                    ))}
                    
                  </span>
                </h1>
              </div>
              <motion.p
                className="text-lg text-muted-foreground leading-relaxed max-w-lg mb-8"
                initial={{ opacity: 0, y: 16 }}
                animate={logoDone ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.5, delay: 1.5, ease: [0, 0, 0.2, 1] }}
              >
                Journi removes friction from manuscript submission — so you can focus on your research.
              </motion.p>
              <motion.div
                className="flex flex-wrap gap-3"
                initial={{ opacity: 0, y: 16 }}
                animate={logoDone ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.5, delay: 1.6, ease: [0, 0, 0.2, 1] }}
              >
                <button
                  onClick={() => { signInAsGuest(); navigate("/collaboration"); }}
                  className="inline-flex items-center gap-2 bg-journi-green text-journi-slate font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Try it with your manuscript
                  <ArrowRight size={17} />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 border border-[#9999cc] text-foreground font-medium px-6 py-3 rounded-lg hover:bg-[#9999cc] hover:text-white hover:font-bold transition-colors"
                >
                  See how it works
                </a>
              </motion.div>
            </div>
            {/* Right: large workflow showcase */}
            <WorkflowShowcase animateWhen={logoDone} entranceDelay={1.5} />
          </div>
        </div>

      </HeroShader>

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
                className="p-10 rounded-2xl border border-[#9999cc]/35 hover:border-[#9999cc]/70 hover:shadow-lg hover:shadow-[#9999cc]/10 transition-all group"
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}
              >
                <div className="w-14 h-14 rounded-xl bg-journi-green/10 flex items-center justify-center mb-6 group-hover:bg-journi-green/20 transition-colors">
                  <pillar.icon size={26} className="text-journi-green" />
                </div>
                <h3 className="text-2xl font-extrabold text-foreground mb-2">{pillar.title}</h3>
                <p className="text-muted-foreground text-base mb-6 leading-relaxed">{pillar.subtitle}</p>
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
                  className="inline-flex items-center gap-1 mt-6 text-sm text-[#8b86c4] font-semibold hover:underline"
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
                className="inline-flex items-center gap-2 bg-[#9999cc] text-white font-medium px-8 py-3.5 rounded-lg hover:bg-[#9999cc] hover:text-white hover:font-bold transition-colors"
              >
                <FlaskConical size={17} />
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

