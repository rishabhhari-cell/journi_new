"use client"

import { motion } from "framer-motion"
import { Github, Linkedin, Twitter } from "lucide-react"
import type { ComponentType } from "react"

const EASE_OUT = [0, 0, 0.2, 1] as const
const EASE_IN_OUT = [0.42, 0, 0.58, 1] as const

const containerVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: EASE_OUT,
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: EASE_OUT },
  },
}

const linkVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
}

const socialVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 10,
    },
  },
}

const backgroundVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 2,
      ease: EASE_OUT,
    },
  },
}

const footerData = {
  sections: [
    { title: "Platform", links: ["Dashboard", "Collaboration", "Discovery", "Publication"] },
    { title: "Product", links: ["Features", "Pricing", "Journal Match", "Submission Tracking"] },
    { title: "Resources", links: ["Documentation", "Support", "Release Notes", "Status"] },
    { title: "Company", links: ["About", "Security", "Privacy", "Terms"] },
  ],
  social: [
    { href: "#", label: "Twitter", icon: Twitter },
    { href: "#", label: "GitHub", icon: Github },
    { href: "#", label: "LinkedIn", icon: Linkedin },
  ],
  subtitle: "Your research, simplified.",
  copyright: "©2026 Journie. All rights reserved.",
}

const NavSection = ({ title, links, index }: { title: string; links: string[]; index: number }) => (
  <motion.div variants={itemVariants} custom={index} className="flex flex-col gap-2">
    <motion.h3
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.5, ease: EASE_OUT }}
      className="mb-2 border-b border-journi-slate/20 pb-1 text-xs font-semibold uppercase tracking-wider text-journi-slate/70 transition-colors duration-300 hover:text-journi-slate"
    >
      {title}
    </motion.h3>
    {links.map((link, linkIndex) => (
      <motion.a
        key={link}
        variants={linkVariants}
        custom={linkIndex}
        href="#"
        whileHover={{
          x: 8,
          transition: { type: "spring" as const, stiffness: 300, damping: 20 },
        }}
        className="group relative text-xs text-journi-slate/75 transition-colors duration-300 hover:text-journi-slate md:text-sm"
      >
        <span className="relative">
          {link}
          <motion.span
            className="absolute bottom-0 left-0 h-0.5 bg-journi-slate/70"
            initial={{ width: 0 }}
            whileHover={{ width: "100%" }}
            transition={{ duration: 0.3 }}
          />
        </span>
      </motion.a>
    ))}
  </motion.div>
)

const SocialLink = ({
  href,
  label,
  Icon,
  index,
}: {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
  index: number
}) => (
  <motion.a
    variants={socialVariants}
    custom={index}
    href={href}
    whileHover={{
      scale: 1.15,
      rotate: 10,
      transition: { type: "spring" as const, stiffness: 300, damping: 15 },
    }}
    whileTap={{ scale: 0.92 }}
    className="group flex h-8 w-8 items-center justify-center rounded-full bg-white/35 transition-colors duration-300 hover:bg-journi-slate md:h-9 md:w-9"
    aria-label={label}
  >
    <Icon className="h-4 w-4 text-journi-slate/80 group-hover:text-white" />
  </motion.a>
)

export default function StickyFooter() {
  return (
    <div className="relative h-[90vh] sm:h-[80vh] md:h-[70vh]" style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}>
      <div className="relative -top-[100vh] h-[calc(100vh+90vh)] sm:h-[calc(100vh+80vh)] md:h-[calc(100vh+70vh)]">
        <div className="sticky top-[calc(100vh-90vh)] sm:top-[calc(100vh-80vh)] md:top-[calc(100vh-70vh)] h-[90vh] sm:h-[80vh] md:h-[70vh]">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#f6fcf7] via-[#fbfefb] to-[#f1f8f2] px-4 py-6 md:px-12 md:py-12"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-black/5" />

            <motion.div
              variants={backgroundVariants}
              className="absolute right-0 top-0 h-52 w-52 rounded-full bg-journi-green/12 blur-3xl md:h-96 md:w-96"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.05, 0.12, 0.05],
              }}
              transition={{
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                ease: EASE_IN_OUT,
              }}
            />

            <motion.div
              variants={backgroundVariants}
              className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-[#7B71C7]/12 blur-3xl md:h-96 md:w-96"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.04, 0.1, 0.04],
              }}
              transition={{
                duration: 5,
                repeat: Number.POSITIVE_INFINITY,
                ease: EASE_IN_OUT,
                delay: 1,
              }}
            />

            <motion.div variants={containerVariants} className="relative z-10">
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-12 lg:gap-20">
                {footerData.sections.map((section, index) => (
                  <NavSection key={section.title} title={section.title} links={section.links} index={index} />
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8, ease: EASE_OUT }}
              className="relative z-10 mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end md:gap-6"
            >
              <div className="flex-1">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1, duration: 0.8, ease: EASE_OUT }}
                  whileHover={{
                    scale: 1.01,
                    transition: { type: "spring" as const, stiffness: 300, damping: 20 },
                  }}
                  className="w-fit"
                >
                  <img
                    src="/logos/Journie_logo-cropped.svg"
                    alt="Journie"
                    className="h-20 w-auto drop-shadow-[0_1px_0_rgba(255,255,255,0.35)] md:h-24 lg:h-28"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  transition={{ delay: 1.2, duration: 0.6 }}
                  className="mt-3 flex items-center gap-3 md:mt-4 md:gap-4"
                >
                  <motion.div
                    className="h-0.5 w-8 bg-gradient-to-r from-[#7B71C7] to-[#685FB4] md:w-12"
                    animate={{
                      scaleX: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: EASE_IN_OUT,
                    }}
                  />
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.4, duration: 0.5 }}
                    className="text-xs text-journi-slate/80 transition-colors duration-300 hover:text-journi-slate md:text-sm"
                  >
                    <span>Your research, </span>
                    <span className="text-journi-green">simplified.</span>
                  </motion.p>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.6, duration: 0.6, ease: EASE_OUT }}
                className="text-left md:text-right"
              >
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.8, duration: 0.5 }}
                  className="mb-2 text-xs text-journi-slate/70 transition-colors duration-300 hover:text-journi-slate md:mb-3 md:text-sm"
                >
                  {footerData.copyright}
                </motion.p>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: 2, staggerChildren: 0.1 }}
                  className="flex gap-2 md:gap-3"
                >
                  {footerData.social.map((social, index) => (
                    <SocialLink key={social.label} href={social.href} label={social.label} Icon={social.icon} index={index} />
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
