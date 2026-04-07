import { cn } from "@/lib/utils";

interface JLoadingGlyphProps {
  className?: string;
  size?: number;
}

export default function JLoadingGlyph({ className, size = 28 }: JLoadingGlyphProps) {
  return (
    <img
      src="/logos/journi_loading.svg"
      alt="Loading"
      width={size}
      height={size}
      className={cn("select-none animate-spin", className)}
      draggable={false}
    />
  );
}

