import { MeshGradient } from "@paper-design/shaders-react";
import { motion } from "framer-motion";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden">
      {/* Same shader as the hero */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <MeshGradient
          className="absolute inset-0 w-full h-full opacity-55"
          colors={["#FFFFFF", "#D7F0DD", "#BFE5C8", "#DAD5F3", "#E9F7EC"]}
          speed={0.21}
        />
      </motion.div>

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <img
          src="/logos/Journi_tab.svg"
          alt="Journie"
          className="h-12 w-auto"
        />
        <div className="h-5 w-5 rounded-full border-2 border-[#BFE5C8] border-t-[#3a7d52] animate-spin" />
      </motion.div>
    </div>
  );
}
