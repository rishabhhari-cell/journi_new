/**
 * NewManuscriptWizard
 * Multi-step overlay for starting a new manuscript:
 *   Step 1 — Import existing file OR start new
 *   Step 2 — Journal: select one / let Journi choose / skip
 *   Step 3 — Journal preferences (if "let us choose") → suggestion
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileUp, FilePlus2, BookOpen, Wand2, SkipForward,
  ChevronRight, ChevronLeft, X, Loader2, Star, Globe,
  CheckCircle2, Clock,
} from "lucide-react";
import type { ManuscriptType } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WizardResult {
  action: "import" | "new";
  file?: File;
  title: string;
  type: ManuscriptType;
  journal?: SuggestedJournal | null; // null = skipped
}

interface SuggestedJournal {
  name: string;
  publisher: string;
  impactFactor: number;
  acceptanceRate: string;
  reviewDays: number;
  openAccess: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: (result: WizardResult) => void;
  manuscriptTypeLabels: Record<ManuscriptType, string>;
}

// ── Mock journal suggestions ────────────────────────────────────────────────

const JOURNAL_POOL: SuggestedJournal[] = [
  { name: "PLOS ONE", publisher: "PLOS", impactFactor: 3.7, acceptanceRate: "60%", reviewDays: 45, openAccess: true },
  { name: "Nature Communications", publisher: "Springer Nature", impactFactor: 16.6, acceptanceRate: "8%", reviewDays: 30, openAccess: true },
  { name: "Cell Reports", publisher: "Cell Press", impactFactor: 7.5, acceptanceRate: "18%", reviewDays: 38, openAccess: true },
  { name: "Journal of Clinical Investigation", publisher: "ASCI", impactFactor: 13.9, acceptanceRate: "12%", reviewDays: 52, openAccess: false },
  { name: "BMC Medicine", publisher: "BioMed Central", impactFactor: 9.3, acceptanceRate: "25%", reviewDays: 40, openAccess: true },
  { name: "The Lancet", publisher: "Elsevier", impactFactor: 202.7, acceptanceRate: "5%", reviewDays: 21, openAccess: false },
  { name: "eLife", publisher: "eLife Sciences", impactFactor: 7.7, acceptanceRate: "15%", reviewDays: 42, openAccess: true },
  { name: "Scientific Reports", publisher: "Springer Nature", impactFactor: 4.6, acceptanceRate: "55%", reviewDays: 35, openAccess: true },
];

function suggestJournals(prefs: Preferences): SuggestedJournal[] {
  let pool = [...JOURNAL_POOL];
  if (prefs.openAccess === "yes") pool = pool.filter((j) => j.openAccess);
  if (prefs.openAccess === "no") pool = pool.filter((j) => !j.openAccess);
  if (prefs.turnaround === "fast") pool = pool.filter((j) => j.reviewDays <= 35);
  if (prefs.turnaround === "medium") pool = pool.filter((j) => j.reviewDays <= 55);
  if (prefs.impactFactor === "any_high") pool = pool.filter((j) => j.impactFactor >= 5);
  if (prefs.impactFactor === "top") pool = pool.filter((j) => j.impactFactor >= 10);
  // sort by match score (impact factor as proxy)
  pool.sort((a, b) => b.impactFactor - a.impactFactor);
  return pool.slice(0, 3);
}

// ── Preferences type ────────────────────────────────────────────────────────

interface Preferences {
  openAccess: "yes" | "no" | "any";
  turnaround: "fast" | "medium" | "flexible";
  impactFactor: "any" | "any_high" | "top";
}

const DEFAULT_PREFS: Preferences = { openAccess: "any", turnaround: "flexible", impactFactor: "any" };

type JournalMode = "select" | "ai" | "skip" | null;
type Step = 1 | 2 | 3 | 4; // 4 = AI results

// ── Component ───────────────────────────────────────────────────────────────

export default function NewManuscriptWizard({ open, onClose, onComplete, manuscriptTypeLabels }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [action, setAction] = useState<"import" | "new" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<ManuscriptType>("full_paper");
  const [journalMode, setJournalMode] = useState<JournalMode>(null);
  const [selectedJournal, setSelectedJournal] = useState("");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [suggestions, setSuggestions] = useState<SuggestedJournal[]>([]);
  const [pickedJournal, setPickedJournal] = useState<SuggestedJournal | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setAction(null);
    setFile(null);
    setTitle("");
    setDocType("full_paper");
    setJournalMode(null);
    setSelectedJournal("");
    setPrefs(DEFAULT_PREFS);
    setSuggestions([]);
    setPickedJournal(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.(docx|pdf)$/i, ""));
    setAction("import");
    setStep(2);
  }

  function handleStartNew() {
    setAction("new");
    setStep(2);
  }

  function handleJournalMode(mode: JournalMode) {
    setJournalMode(mode);
    if (mode === "skip") {
      finish(null);
    } else if (mode === "ai") {
      setStep(3);
    } else if (mode === "select") {
      setStep(3);
    }
  }

  function handleFindJournals() {
    setIsSearching(true);
    setTimeout(() => {
      setSuggestions(suggestJournals(prefs));
      setIsSearching(false);
      setStep(4);
    }, 1200);
  }

  function finish(journal: SuggestedJournal | null) {
    const derivedTitle = title.trim() || (file ? file.name.replace(/\.(docx|pdf)$/i, "") : "Untitled Manuscript");
    onComplete({
      action: action!,
      file: file ?? undefined,
      title: derivedTitle,
      type: docType,
      journal,
    });
    reset();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <motion.div
        className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1 w-6 rounded-full transition-colors ${
                    step >= s ? "bg-journi-green" : "bg-border"
                  }`}
                />
              ))}
            </div>
            <h2 className="text-base font-bold text-foreground mt-2">New Manuscript</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 min-h-[300px]">
          <AnimatePresence mode="wait">
            {/* ── Step 1: Import or New ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h3 className="text-lg font-bold text-foreground mb-1">Start your manuscript</h3>
                <p className="text-sm text-muted-foreground mb-6">Import an existing document or start fresh.</p>

                <div className="space-y-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-border hover:border-journi-green/40 hover:bg-journi-green/5 transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-journi-green/10">
                      <FileUp size={20} className="text-muted-foreground group-hover:text-journi-green" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Import a document</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Upload a .docx or .pdf file</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-muted-foreground group-hover:text-journi-green" />
                  </button>

                  <button
                    onClick={handleStartNew}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-journi-green/40 hover:bg-journi-green/5 transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-journi-green/10">
                      <FilePlus2 size={20} className="text-muted-foreground group-hover:text-journi-green" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Start new manuscript</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Blank document with structured sections</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-muted-foreground group-hover:text-journi-green" />
                  </button>
                </div>

                {/* Title + type if starting new */}
                <input ref={fileInputRef} type="file" accept=".docx,.pdf" className="hidden" onChange={handleFileChange} />
              </motion.div>
            )}

            {/* ── Step 2: Journal mode ── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h3 className="text-lg font-bold text-foreground mb-1">Do you have a journal in mind?</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {action === "import" && file ? `Importing "${file.name}"` : "Starting a new manuscript"}
                  {" "}— let's find the right journal.
                </p>

                {/* Doc title (for new) */}
                {action === "new" && (
                  <div className="space-y-2 mb-5">
                    <input
                      type="text"
                      placeholder="Document title..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-sm bg-muted text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-journi-green border border-transparent"
                      autoFocus
                    />
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as ManuscriptType)}
                      className="w-full text-sm bg-muted text-foreground rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-journi-green border border-transparent"
                    >
                      {(Object.entries(manuscriptTypeLabels) as [ManuscriptType, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={() => handleJournalMode("select")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-journi-green/40 hover:bg-journi-green/5 transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-journi-green/10">
                      <BookOpen size={20} className="text-muted-foreground group-hover:text-journi-green" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Yes — I have a journal</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Enter the journal name manually</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-muted-foreground group-hover:text-journi-green" />
                  </button>

                  <button
                    onClick={() => handleJournalMode("ai")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-journi-green/40 hover:bg-journi-green/5 transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-journi-green/10">
                      <Wand2 size={20} className="text-muted-foreground group-hover:text-journi-green" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Let Journie choose for me</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Set preferences, get matched journals</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-muted-foreground group-hover:text-journi-green" />
                  </button>

                  <button
                    onClick={() => handleJournalMode("skip")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-dashed border-border hover:border-border hover:bg-accent transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <SkipForward size={20} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">Skip for now</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Go straight to writing — choose a journal later</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Select journal manually ── */}
            {step === 3 && journalMode === "select" && (
              <motion.div key="step3-select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h3 className="text-lg font-bold text-foreground mb-1">Which journal?</h3>
                <p className="text-sm text-muted-foreground mb-6">Enter the journal name you have in mind.</p>
                <input
                  type="text"
                  placeholder="e.g. Nature Communications..."
                  value={selectedJournal}
                  onChange={(e) => setSelectedJournal(e.target.value)}
                  className="w-full text-sm bg-muted text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-journi-green border border-transparent mb-6"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft size={15} /> Back
                  </button>
                  <button
                    onClick={() => {
                      const j: SuggestedJournal | null = selectedJournal.trim()
                        ? { name: selectedJournal.trim(), publisher: "", impactFactor: 0, acceptanceRate: "–", reviewDays: 0, openAccess: false }
                        : null;
                      finish(j);
                    }}
                    className="ml-auto bg-journi-green text-journi-slate text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Open manuscript
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: AI preferences ── */}
            {step === 3 && journalMode === "ai" && (
              <motion.div key="step3-ai" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h3 className="text-lg font-bold text-foreground mb-1">Journal preferences</h3>
                <p className="text-sm text-muted-foreground mb-6">Tell us what matters most and we'll find the best matches.</p>

                <div className="space-y-5">
                  {/* Open Access */}
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Open Access</p>
                    <div className="flex gap-2">
                      {(["yes", "no", "any"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setPrefs((p) => ({ ...p, openAccess: v }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${prefs.openAccess === v ? "bg-journi-green text-journi-slate border-journi-green" : "border-border text-muted-foreground hover:border-journi-green/40"}`}
                        >
                          {v === "yes" ? "Required" : v === "no" ? "Not needed" : "No preference"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Turnaround */}
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                      <Clock size={11} className="inline mr-1" />Review turnaround
                    </p>
                    <div className="flex gap-2">
                      {(["fast", "medium", "flexible"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setPrefs((p) => ({ ...p, turnaround: v }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${prefs.turnaround === v ? "bg-journi-green text-journi-slate border-journi-green" : "border-border text-muted-foreground hover:border-journi-green/40"}`}
                        >
                          {v === "fast" ? "< 35 days" : v === "medium" ? "< 55 days" : "Flexible"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Impact Factor */}
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                      <Star size={11} className="inline mr-1" />Impact Factor
                    </p>
                    <div className="flex gap-2">
                      {(["any", "any_high", "top"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setPrefs((p) => ({ ...p, impactFactor: v }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${prefs.impactFactor === v ? "bg-journi-green text-journi-slate border-journi-green" : "border-border text-muted-foreground hover:border-journi-green/40"}`}
                        >
                          {v === "any" ? "Any" : v === "any_high" ? "> 5" : "> 10"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-7">
                  <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft size={15} /> Back
                  </button>
                  <button
                    onClick={handleFindJournals}
                    disabled={isSearching}
                    className="ml-auto flex items-center gap-2 bg-journi-green text-journi-slate text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {isSearching ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                    {isSearching ? "Finding journals..." : "Find journals"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 4: AI results ── */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h3 className="text-lg font-bold text-foreground mb-1">Recommended journals</h3>
                <p className="text-sm text-muted-foreground mb-5">Select one to attach to your manuscript, or open without a journal.</p>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {suggestions.map((j) => (
                    <button
                      key={j.name}
                      onClick={() => setPickedJournal(pickedJournal?.name === j.name ? null : j)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${pickedJournal?.name === j.name ? "border-journi-green bg-journi-green/5" : "border-border hover:border-journi-green/40 hover:bg-muted/50"}`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-journi-green/10 flex items-center justify-center shrink-0">
                        <BookOpen size={16} className="text-journi-green" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{j.name}</p>
                          {j.openAccess && <span className="text-[10px] font-semibold text-journi-green bg-journi-green/10 px-1.5 py-0.5 rounded shrink-0">OA</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><Star size={9} className="text-yellow-500" />{j.impactFactor}</span>
                          <span className="text-[11px] text-muted-foreground">{j.acceptanceRate} acceptance</span>
                          {j.reviewDays > 0 && <span className="text-[11px] text-muted-foreground">{j.reviewDays}d review</span>}
                        </div>
                      </div>
                      {pickedJournal?.name === j.name && <CheckCircle2 size={16} className="text-journi-green shrink-0" />}
                    </button>
                  ))}
                  {suggestions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No journals matched your preferences. Try relaxing the filters.</p>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-5">
                  <button onClick={() => setStep(3)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft size={15} /> Back
                  </button>
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() => finish(null)}
                      className="text-sm text-muted-foreground hover:text-foreground border border-border px-4 py-2 rounded-lg transition-colors"
                    >
                      Skip journal
                    </button>
                    <button
                      onClick={() => finish(pickedJournal ?? null)}
                      className="bg-journi-green text-journi-slate text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Open manuscript
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
