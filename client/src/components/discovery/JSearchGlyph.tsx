/**
 * JSearchGlyph
 * The Journi J loading icon sized for the search bar.
 * 20 keys, 2 purple at a time cycling clockwise, solid-green J — no fill animation.
 * The SVG has its own CSS animations; no extra class needed.
 */
import { cn } from "@/lib/utils";

interface JSearchGlyphProps {
  className?: string;
  size?: number;
}

export default function JSearchGlyph({ className, size = 18 }: JSearchGlyphProps) {
  return (
    <img
      src="/logos/journi_search_loading.svg"
      alt=""
      width={size}
      height={size}
      className={cn("select-none", className)}
      draggable={false}
      aria-hidden="true"
    />
  );
}
