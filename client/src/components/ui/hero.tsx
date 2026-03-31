import { MeshGradient } from "@paper-design/shaders-react"
import { motion } from "framer-motion"

interface HeroShaderProps {
  children: React.ReactNode
  className?: string
}

export default function HeroShader({ children, className = "" }: HeroShaderProps) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      {/* White base */}
      <div className="absolute inset-0 bg-white" />

      {/* White-first mesh with green-forward streaks + soft purple accent */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.1 }}
      >
        <MeshGradient
          className="absolute inset-0 w-full h-full opacity-55"
          colors={["#FFFFFF", "#D7F0DD", "#BFE5C8", "#DAD5F3", "#E9F7EC"]}
          speed={0.21}
        />
      </motion.div>

      {/* Top fade under navbar */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-background to-transparent z-[1]" />

      {/* Bottom fade to page background */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-[1]" />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </section>
  )
}
