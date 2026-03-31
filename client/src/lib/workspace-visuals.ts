import {
  Atom,
  Biohazard,
  Dna,
  FlaskConical,
  Microscope,
  Pill,
  TestTube,
  type LucideIcon,
} from "lucide-react";

export interface WorkspaceVisual {
  icon: LucideIcon;
  bgClass: string;
  iconClass: string;
}

const SCIENCE_VISUALS: WorkspaceVisual[] = [
  { icon: Microscope, bgClass: "bg-sky-100", iconClass: "text-sky-700" },
  { icon: Dna, bgClass: "bg-violet-100", iconClass: "text-violet-700" },
  { icon: FlaskConical, bgClass: "bg-emerald-100", iconClass: "text-emerald-700" },
  { icon: Atom, bgClass: "bg-indigo-100", iconClass: "text-indigo-700" },
  { icon: Biohazard, bgClass: "bg-rose-100", iconClass: "text-rose-700" },
  { icon: TestTube, bgClass: "bg-cyan-100", iconClass: "text-cyan-700" },
  { icon: Pill, bgClass: "bg-amber-100", iconClass: "text-amber-700" },
];

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getScienceWorkspaceVisual(workspaceId: string): WorkspaceVisual {
  const safeKey = workspaceId || "workspace";
  const mappedIndex = hashString(safeKey) % SCIENCE_VISUALS.length;
  return SCIENCE_VISUALS[mappedIndex];
}
