import { useRef } from "react";
import { motion, type Variants, useInView } from "framer-motion";

type TimelineContentProps = {
  as?: "div" | "p" | "section" | "article";
  animationNum?: number;
  timelineRef?: React.RefObject<HTMLElement | null>;
  customVariants?: Variants;
  className?: string;
  children: React.ReactNode;
};

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45 },
  },
};

export function TimelineContent({
  as = "div",
  animationNum = 0,
  timelineRef,
  customVariants,
  className,
  children,
}: TimelineContentProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const targetRef = timelineRef ?? localRef;
  const isInView = useInView(targetRef, { once: true, amount: 0.2 });
  const variants = customVariants ?? defaultVariants;

  const commonProps = {
    className,
    variants,
    custom: animationNum,
    initial: "hidden" as const,
    animate: isInView ? ("visible" as const) : ("hidden" as const),
  };

  if (as === "p") {
    return <motion.p {...commonProps}>{children}</motion.p>;
  }

  if (as === "section") {
    return <motion.section {...commonProps}>{children}</motion.section>;
  }

  if (as === "article") {
    return <motion.article {...commonProps}>{children}</motion.article>;
  }

  return (
    <motion.div ref={localRef} {...commonProps}>
      {children}
    </motion.div>
  );
}

