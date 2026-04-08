import { MeshGradient } from "@paper-design/shaders-react";
import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type LoadingScreenProps = {
  progress?: number;
  fullscreen?: boolean;
  /** Hide the J fill entirely — only the dashes ring + burst are shown. */
  hideJFill?: boolean;
};

// J letter path (coordinates relative to translate(643.872746, 940.874899))
const J_PATH =
  "M 134.40625 -448 C 111.46875 -448 92.929688 -454.664062 78.796875 -468 C 64.660156 -481.332031 57.59375 -499.46875 57.59375 -522.40625 C 57.59375 -544.269531 64.660156 -561.867188 78.796875 -575.203125 C 92.929688 -588.535156 111.46875 -595.203125 134.40625 -595.203125 C 157.863281 -595.203125 176.523438 -588.535156 190.390625 -575.203125 C 204.265625 -561.867188 211.203125 -544.269531 211.203125 -522.40625 C 211.203125 -499.46875 204.265625 -481.332031 190.390625 -468 C 176.523438 -454.664062 157.863281 -448 134.40625 -448 Z M 41.59375 204 C 18.132812 204 -5.0625 200.53125 -28 193.59375 L -23.203125 174.40625 C -13.597656 178.132812 -4.53125 180 4 180 C 23.726562 180 37.191406 169.863281 44.390625 149.59375 C 51.597656 129.332031 55.203125 99.46875 55.203125 60 L 55.203125 -328 C 55.203125 -339.726562 51.597656 -348.257812 44.390625 -353.59375 C 37.191406 -358.925781 27.992188 -361.59375 16.796875 -361.59375 L 16.796875 -380.796875 C 34.398438 -381.328125 54.800781 -382.660156 78 -384.796875 C 101.195312 -386.929688 123.863281 -390.128906 146 -394.390625 C 168.132812 -398.660156 186.398438 -404 200.796875 -410.40625 L 209.59375 -405.59375 L 209.59375 28.796875 C 209.59375 87.992188 194.660156 131.992188 164.796875 160.796875 C 134.929688 189.597656 93.863281 204 41.59375 204 Z M 41.59375 204";

// SVG coordinate space: J bounding box after translate(643.87, 940.87)
// x: 643.87 + (-28) = 615.87  to  643.87 + 211 = 854.87  → width ~240
// y: 940.87 + (-595) = 345.87  to  940.87 + 204 = 1144.87 → height ~800
const J_TX = 643.872746;
const J_TY = 940.874899;
const J_VB_X = 615;
const J_VB_Y = 345;
const J_VB_W = 240;
const J_VB_H = 820;

function clampProgress(value: number) {
  return Math.min(100, Math.max(0, value));
}

export default function LoadingScreen({ progress, fullscreen = true, hideJFill = false }: LoadingScreenProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const controlled = typeof progress === "number";
  const safeProgress = clampProgress(controlled ? progress : internalProgress);

  const burstControls = useAnimationControls();
  const hasBurst = useRef(false);

  // Uncontrolled: sine-wave oscillation between 20 % and 75 % so the bar never
  // appears to "complete" (reach 100 %) and reset — that looked like a double-load.
  useEffect(() => {
    if (controlled) return;

    const start = performance.now();
    const duration = 2600; // one full oscillation cycle
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = (now - start) % duration;
      const t = elapsed / duration; // 0 → 1
      // Sine wave: starts at minimum (20 %), peaks at 75 %, returns to 20 %
      const next = 47.5 - 27.5 * Math.cos(2 * Math.PI * t);
      setInternalProgress(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [controlled]);

  // Burst: fires ONLY when the caller explicitly passes progress=100.
  // Slow single expansion — page reveals at the peak (1 500 ms, matching App.tsx hide timer).
  // In uncontrolled (oscillating) mode this never triggers.
  useEffect(() => {
    if (controlled && safeProgress >= 100 && !hasBurst.current) {
      hasBurst.current = true;
      burstControls.start({
        scale: [1, 0.72, 2.4],
        opacity: [1, 1, 0],
        transition: {
          duration: 0.7,
          times: [0, 0.22, 1],
          ease: ["easeOut", [0.16, 1, 0.3, 1]],
        },
      });
    }
    if (!controlled) hasBurst.current = false;
  }, [controlled, safeProgress, burstControls]);

  // Purple J fill: rises from bottom as progress increases
  const fillHeight = (safeProgress / 100) * J_VB_H;
  const fillY = J_VB_Y + (J_VB_H - fillHeight);

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
        {/* Center widget — two modes */}
        {!controlled ? (
          /* Uncontrolled: cycling purple keys + solid green J, no fill animation */
          <img
            src="/logos/journi_search_loading.svg"
            alt="Loading"
            className="h-28 w-28"
            draggable={false}
          />
        ) : (
          /* Controlled: dashes ring with burst + J fill progress */
          <div className="relative h-28 w-28">
            {/* Burst applies only to the dashes ring, not the J */}
            <motion.div animate={burstControls} className="absolute inset-0">
              {/* Animated color-wave dashes — fades out when burst fires */}
              <motion.img
                src="/logos/journi_dashes.svg"
                aria-hidden="true"
                className="absolute inset-0 h-28 w-28"
                animate={{ opacity: safeProgress >= 100 ? 0 : 1 }}
                transition={{ duration: 0 }}
              />
              {/* All-purple dashes — fades in exactly when burst fires */}
              <motion.img
                src="/logos/journi_dashes_purple.svg"
                aria-hidden="true"
                className="absolute inset-0 h-28 w-28"
                initial={{ opacity: 0 }}
                animate={{ opacity: safeProgress >= 100 ? 1 : 0 }}
                transition={{ duration: 0 }}
              />
            </motion.div>

            {/* J — green base always visible; purple rising fill shown unless hideJFill */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <svg
                viewBox={`${J_VB_X} ${J_VB_Y} ${J_VB_W} ${J_VB_H}`}
                className="h-14 w-12"
                aria-label="Loading"
                role="img"
              >
                {!hideJFill && (
                  <defs>
                    <clipPath id="j-fill-clip">
                      <rect x={J_VB_X} y={fillY} width={J_VB_W} height={fillHeight} />
                    </clipPath>
                  </defs>
                )}
                {/* Green J — always visible as base */}
                <g fill="#4fb151" fillOpacity="0.35">
                  <g transform={`translate(${J_TX}, ${J_TY})`}>
                    <path d={J_PATH} />
                  </g>
                </g>
                {/* Purple rising fill — hidden when hideJFill=true */}
                {!hideJFill && (
                  <g fill="#7B71C7" fillOpacity="1" clipPath="url(#j-fill-clip)">
                    <g transform={`translate(${J_TX}, ${J_TY})`}>
                      <path d={J_PATH} />
                    </g>
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}

        {/* No text during burst (progress=100) to keep the animation clean */}
        {(!controlled || safeProgress < 100) && (
          <p className="text-xs font-semibold text-[#685FB4]">
            {controlled ? `Loading ${Math.round(safeProgress)}%` : 'Loading…'}
          </p>
        )}
      </motion.div>
    </div>
  );
}
