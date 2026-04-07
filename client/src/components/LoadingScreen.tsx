import { MeshGradient } from "@paper-design/shaders-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type LoadingScreenProps = {
  progress?: number;
  fullscreen?: boolean;
};

const J_VIEWBOX_HEIGHT = 820;
const J_VIEWBOX_TOP = 345;

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, value));
}

export default function LoadingScreen({ progress, fullscreen = true }: LoadingScreenProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const controlled = typeof progress === "number";
  const safeProgress = clampProgress(controlled ? progress : internalProgress);

  useEffect(() => {
    if (controlled) return;

    const start = performance.now();
    const duration = 3200;
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = (now - start) % duration;
      const next = (elapsed / duration) * 100;
      setInternalProgress(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [controlled]);

  const fillHeight = (safeProgress / 100) * J_VIEWBOX_HEIGHT;
  const fillY = J_VIEWBOX_TOP + (J_VIEWBOX_HEIGHT - fillHeight);

  const purplePct = safeProgress;
  const greenPct = 100 - safeProgress;

  const gradientStops = useMemo(
    () => ({
      purple: `${purplePct}%`,
      green: `${greenPct}%`,
    }),
    [purplePct, greenPct]
  );

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-white"
          : "absolute inset-0 z-[120] flex items-center justify-center overflow-hidden bg-white/95 backdrop-blur-sm"
      }
    >
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <MeshGradient
          className="absolute inset-0 h-full w-full opacity-55"
          colors={["#FFFFFF", "#D7F0DD", "#BFE5C8", "#DAD5F3", "#E9F7EC"]}
          speed={0.21}
        />
      </motion.div>

      <motion.div
        className="relative z-10 flex flex-col items-center gap-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="relative h-28 w-28">
          <img
            src="/logos/journi_loading.svg"
            alt="Loading"
            className="h-28 w-28 animate-spin"
          />
        </div>

        <svg
          viewBox="615 345 240 820"
          className="h-16 w-14"
          aria-label="Loading progress"
          role="img"
        >
          <defs>
            <clipPath id="j-path-clip">
              <g transform="translate(643.872746, 940.874899)">
                <path d="M 134.40625 -448 C 111.46875 -448 92.929688 -454.664062 78.796875 -468 C 64.660156 -481.332031 57.59375 -499.46875 57.59375 -522.40625 C 57.59375 -544.269531 64.660156 -561.867188 78.796875 -575.203125 C 92.929688 -588.535156 111.46875 -595.203125 134.40625 -595.203125 C 157.863281 -595.203125 176.523438 -588.535156 190.390625 -575.203125 C 204.265625 -561.867188 211.203125 -544.269531 211.203125 -522.40625 C 211.203125 -499.46875 204.265625 -481.332031 190.390625 -468 C 176.523438 -454.664062 157.863281 -448 134.40625 -448 Z M 41.59375 204 C 18.132812 204 -5.0625 200.53125 -28 193.59375 L -23.203125 174.40625 C -13.597656 178.132812 -4.53125 180 4 180 C 23.726562 180 37.191406 169.863281 44.390625 149.59375 C 51.597656 129.332031 55.203125 99.46875 55.203125 60 L 55.203125 -328 C 55.203125 -339.726562 51.597656 -348.257812 44.390625 -353.59375 C 37.191406 -358.925781 27.992188 -361.59375 16.796875 -361.59375 L 16.796875 -380.796875 C 34.398438 -381.328125 54.800781 -382.660156 78 -384.796875 C 101.195312 -386.929688 123.863281 -390.128906 146 -394.390625 C 168.132812 -398.660156 186.398438 -404 200.796875 -410.40625 L 209.59375 -405.59375 L 209.59375 28.796875 C 209.59375 87.992188 194.660156 131.992188 164.796875 160.796875 C 134.929688 189.597656 93.863281 204 41.59375 204 Z M 41.59375 204" />
              </g>
            </clipPath>
            <linearGradient id="j-progress-mix" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#4fb151" />
              <stop offset={gradientStops.green} stopColor="#4fb151" />
              <stop offset={gradientStops.green} stopColor="#7B71C7" />
              <stop offset="100%" stopColor="#7B71C7" />
            </linearGradient>
          </defs>

          <g clipPath="url(#j-path-clip)">
            <rect x="615" y="345" width="240" height="820" fill="#4fb151" opacity="0.12" />
            <rect
              x="615"
              y={fillY}
              width="240"
              height={fillHeight}
              fill="url(#j-progress-mix)"
            />
          </g>
        </svg>

        <p className="text-xs font-semibold text-[#685FB4]">
          Loading {Math.round(safeProgress)}%
        </p>
      </motion.div>
    </div>
  );
}
