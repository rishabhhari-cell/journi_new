import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.09, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

export default function About() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-16">
        <section id="team" className="py-20 md:py-28 bg-muted/30 scroll-mt-24">
          <div className="container">
            <motion.div
              className="text-center max-w-2xl mx-auto mb-16"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
            >
              <p className="text-xs font-bold text-journi-green uppercase tracking-widest mb-3">The Team</p>
              <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Clinicians. Researchers. Builders.
              </h1>
              <p className="text-muted-foreground text-lg">
                We&apos;re building the product we wished we had as clinician-researchers.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
              {[
                {
                  name: "Dr Yuri Aung",
                  role: "Doctor - Clinical & Regulatory Strategy Lead in MedTech",
                  bio: "She brings hands-on experience leading clinical research and regulatory strategy across global healthcare startups.",
                  photo: "/team/yuri.jpg",
                },
                {
                  name: "Dr Rishabh Hariharan",
                  role: "Doctor - Researcher - Startup Operator",
                  bio: "He combines a strong clinical research background with early-stage venture building to ship products.",
                  photo: "/team/rish.jpg",
                },
              ].map((person, i) => (
                <motion.div
                  key={person.name}
                  className="flex flex-col sm:flex-row gap-6 bg-card rounded-2xl border border-border p-7"
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  custom={i + 1}
                >
                  <div className="shrink-0">
                    <img src={person.photo} alt={person.name} width={96} height={96} className="w-24 h-24 rounded-2xl object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-foreground">{person.name}</h2>
                    <p className="text-xs font-semibold text-journi-green mt-0.5 mb-3">{person.role}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{person.bio}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              id="why-us"
              className="max-w-3xl mx-auto"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={3}
            >
              <h3 className="text-xl font-bold text-foreground text-center mb-8">Why us</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  {
                    title: "Lived experience of the problem",
                    desc: "We&apos;ve both navigated the full research-to-publication journey - including projects that stalled, got delayed, or never made it across the line.",
                  },
                  {
                    title: "Deep domain and system understanding",
                    desc: "We understand how research is produced, peer-reviewed, and funded across institutions - not just in theory, but from the inside.",
                  },
                  {
                    title: "Builders inside the workflow",
                    desc: "We&apos;re not designing from the outside looking in. Journi is built from within real research and clinical environments, for the people working in them.",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-background"
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    custom={i + 4}
                  >
                    <div className="w-8 h-8 rounded-lg bg-journi-green/10 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-journi-green" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
