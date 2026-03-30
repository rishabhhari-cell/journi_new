import { motion } from "framer-motion"
import { useState, useEffect } from "react"

const LOGO_URL = "/logos/Journi_new-cropped (1).svg"
const EASE = [0, 0, 0.2, 1] as const

interface HeroLogoAnimationProps {
  onComplete?: () => void
}

export default function HeroLogoAnimation({ onComplete }: HeroLogoAnimationProps) {
  const [loaded, setLoaded] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
  }, [])

  // If reduced motion, fire onComplete immediately once loaded
  useEffect(() => {
    if (reducedMotion && loaded) {
      onComplete?.()
    }
  }, [reducedMotion, loaded, onComplete])

  return (
    <motion.div
      className="w-[67.5%]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 0.95 }}
      transition={{
        duration: reducedMotion ? 0 : 0.8,
        delay: reducedMotion ? 0 : 0.1,
        ease: EASE,
      }}
      onAnimationComplete={() => {
        if (!reducedMotion && loaded) onComplete?.()
      }}
    >
      <img
        src={LOGO_URL}
        alt="Journi"
        className="w-full h-auto object-contain object-left"
        loading="eager"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
      />
    </motion.div>
  )
}
