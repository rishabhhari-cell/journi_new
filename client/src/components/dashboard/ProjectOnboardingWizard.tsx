/**
 * ProjectOnboardingWizard
 * 3-step onboarding modal for new users:
 *   Step 1 - Project details (name, description, deadline, manuscript type)
 *   Step 2 - Import existing doc (optional)
 *   Step 3 - Invite collaborators (optional)
 */
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderPlus,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileText,
  Upload,
  UserPlus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import type { ManuscriptType, CollaboratorFormData } from "@/types";
import { useProject } from "@/contexts/ProjectContext";
import { useManuscript } from "@/contexts/ManuscriptContext";
import { importDocx, importPdf, type ImportDocumentResult } from "@/lib/document-io";
import { toast } from "sonner";

interface Props {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

const MANUSCRIPT_TYPES: { value: ManuscriptType; label: string }[] = [
  { value: "full_paper", label: "Full Paper" },
  { value: "literature_review", label: "Literature Review" },
  { value: "grant_application", label: "Grant Application" },
  { value: "abstract", label: "Abstract" },
  { value: "other", label: "Other" },
];

const STEP_LABELS = ["Project", "Import", "Team"];

const ui = {
  stepBody: "mx-auto w-full max-w-[640px] space-y-6",
  label: "block text-[13px] leading-5 font-semibold tracking-[0.005em] text-foreground/95 mb-1.5",
  control:
    "h-12 w-full rounded-xl border border-border/80 bg-background px-4 text-[15px] leading-[1.45] font-medium text-foreground placeholder:text-muted-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/35 focus-visible:border-journi-green/55 transition-colors",
  textarea:
    "w-full min-h-[108px] rounded-xl border border-border/80 bg-background px-4 py-3 text-[15px] leading-[1.55] font-medium text-foreground placeholder:text-muted-foreground/85 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/35 focus-visible:border-journi-green/55 transition-colors",
  dropzone:
    "rounded-2xl border border-dashed border-border/80 bg-background px-8 py-12 text-center cursor-pointer hover:border-journi-green/35 hover:bg-journi-green/5 transition-colors",
  card: "rounded-2xl border border-border/75 bg-background",
  mutedButton:
    "text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/25",
  primaryButton:
    "flex items-center gap-1.5 bg-journi-green text-journi-slate text-sm font-semibold tracking-[0.01em] px-5 h-11 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed",
  introCard:
    "w-full rounded-2xl border border-border/75 bg-background px-7 py-7 shadow-sm",
};

export default function ProjectOnboardingWizard({ onComplete }: Props) {
  const [, navigate] = useLocation();
  const { createProject, addCollaborator, updateProjectMetadata } = useProject();
  const { createManuscript, replaceManuscriptContent } = useManuscript();

  // Step navigation
  const [step, setStep] = useState<Step>(1);
  const [isCreating, setIsCreating] = useState(false);
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(true);

  // Step 1 - project info
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [manuscriptType, setManuscriptType] = useState<ManuscriptType>("full_paper");

  // Step 2 - file import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportDocumentResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 - collaborators
  const [collaborators, setCollaborators] = useState<{ name: string; email: string }[]>([
    { name: "", email: "" },
  ]);

  const canProceedStep1 = projectName.trim().length >= 2;

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setIsParsing(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const result = ext === "pdf" ? await importPdf(file) : await importDocx(file);
      setImportResult(result);
    } catch {
      toast.error("Failed to parse file. Try a different format.");
      setImportFile(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "docx" && ext !== "pdf") {
      toast.error("Please drop a .docx or .pdf file");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    const syntheticEvent = { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
    void handleFileChange(syntheticEvent);
  }, [handleFileChange]);

  const clearImport = () => {
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addCollaboratorRow = () => {
    if (collaborators.length >= 5) return;
    setCollaborators((prev) => [...prev, { name: "", email: "" }]);
  };

  const removeCollaboratorRow = (idx: number) => {
    setCollaborators((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCollaboratorRow = (idx: number, field: "name" | "email", value: string) => {
    setCollaborators((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const handleFinish = async () => {
    if (!canProceedStep1) return;
    setIsCreating(true);

    try {
      await createProject(projectName.trim(), description.trim(), dueDate || undefined);

      // Await manuscript creation so we have the real backend ID before applying content
      const msTitle = importResult?.title || "Untitled Manuscript";
      await createManuscript(msTitle, manuscriptType);

      // Apply parsed content atomically if a document was imported
      if (importResult) {
        const sections = importResult.sections.map((s, i) => ({
          id: (s as any).id ?? `imported-${i}`,
          title: s.title ?? 'Section',
          content: (s as any).content ?? '',
          status: ((s as any).status ?? 'draft') as import('@/types').SectionStatus,
          order: (s as any).order ?? i,
        }));
        const citations = importResult.citations.map((c, i) => ({
          ...c,
          id: (c as any).id ?? `cit-${i}`,
        }));
        replaceManuscriptContent({ title: msTitle, sections, citations });

        // Persist authors/institutions as project metadata
        if (importResult.authors.length > 0 || importResult.institutions.length > 0) {
          void updateProjectMetadata({
            authors: importResult.authors,
            institutions: importResult.institutions,
          });
        }
      }

      // Add collaborators
      const validCollabs = collaborators.filter((c) => c.name.trim() && c.email.trim());
      for (const collab of validCollabs) {
        const data: CollaboratorFormData = {
          name: collab.name.trim(),
          email: collab.email.trim(),
          role: "co_author",
        };
        addCollaborator(data);
      }

      toast.success("Project created!");
      onComplete();
      navigate("/dashboard");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="relative z-10 bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="flex gap-2 px-8 pt-7 pb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${s <= step ? "bg-journi-green" : "bg-muted"}`}
              />
              <span className={`text-[10px] font-medium ${s <= step ? "text-journi-green" : "text-muted-foreground"}`}>
                {STEP_LABELS[s - 1]}
              </span>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="px-8 pt-3 pb-6 border-b border-border/80">
          <h2 className="text-[26px] leading-[1.12] font-semibold tracking-[-0.015em] text-foreground">
            {step === 1 && "Set up your project"}
            {step === 2 && "Import your work"}
            {step === 3 && "Invite your team"}
          </h2>
          <p className="text-[15px] leading-7 text-muted-foreground mt-2">
            {step === 1 && "Give your research project a name to get started."}
            {step === 2 && "Upload an existing document or start from scratch."}
            {step === 3 && "Add co-authors so you can collaborate."}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-7 min-h-[360px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.12 }}
                className={`relative ${ui.stepBody}`}
              >
                {showWelcomeIntro ? (
                  <div className={ui.introCard}>
                    <p className="text-[19px] leading-[1.25] font-semibold tracking-[-0.005em] text-foreground mb-4">
                      Welcome to the start of your journie
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowWelcomeIntro(false)}
                      className="inline-flex items-center gap-1.5 bg-journi-green text-journi-slate text-sm font-semibold px-5 h-11 rounded-xl hover:opacity-90 transition-opacity"
                    >
                      <FolderPlus size={14} />
                      Start setup
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={ui.label}>
                        Project name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="e.g. Phase III Clinical Trial Analysis"
                        className={ui.control}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className={ui.label}>
                        Description <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of your research..."
                        rows={2}
                        className={ui.textarea}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex-1">
                        <label className={ui.label}>
                          Submission deadline <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className={ui.control}
                        />
                      </div>

                      <div className="flex-1">
                        <label className={ui.label}>Manuscript type</label>
                        <select
                          value={manuscriptType}
                          onChange={(e) => setManuscriptType(e.target.value as ManuscriptType)}
                          className={ui.control}
                        >
                          {MANUSCRIPT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.12 }}
                className={ui.stepBody}
              >
                {!importFile ? (
                  <>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={ui.dropzone}
                    >
                      <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
                      <p className="text-[15px] leading-6 font-semibold text-foreground mb-1">Drop your file here or click to browse</p>
                      <p className="text-[13px] leading-5 text-muted-foreground">Supports .docx and .pdf</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".docx,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </>
                ) : isParsing ? (
                  <div className={`${ui.card} flex flex-col items-center justify-center py-14`}>
                    <Loader2 size={28} className="animate-spin text-journi-green mb-3" />
                    <p className="text-[14px] leading-6 text-muted-foreground">Parsing your document...</p>
                  </div>
                ) : importResult ? (
                  <div className={`${ui.card} p-5 space-y-3`}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-journi-green/10 rounded-lg shrink-0">
                        <FileText size={20} className="text-journi-green" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] leading-6 font-semibold text-foreground truncate">{importFile.name}</p>
                        <p className="text-[12px] leading-5 text-muted-foreground mt-0.5">
                          {importResult.sections.length} section{importResult.sections.length !== 1 ? "s" : ""} &middot; {" "}
                          {importResult.totalWordCount.toLocaleString()} words
                        </p>
                      </div>
                      <button
                        onClick={clearImport}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                        aria-label="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] leading-5 font-medium text-journi-green">
                      <CheckCircle2 size={13} />
                      <span>Ready to import</span>
                    </div>
                    {importResult.review.required && (
                      <p className="text-[11px] text-amber-600">
                        PDF review is required before sections are committed. You can approve this in the editor import flow.
                      </p>
                    )}
                  </div>
                ) : null}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.12 }}
                className={ui.stepBody}
              >
                {collaborators.map((collab, idx) => (
                  <div key={idx} className={`${ui.card} p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2`}>
                    <input
                      type="text"
                      value={collab.name}
                      onChange={(e) => updateCollaboratorRow(idx, "name", e.target.value)}
                      placeholder="Name"
                      className={`flex-1 ${ui.control}`}
                    />
                    <input
                      type="email"
                      value={collab.email}
                      onChange={(e) => updateCollaboratorRow(idx, "email", e.target.value)}
                      placeholder="Email"
                      className={`flex-1 ${ui.control}`}
                    />
                    {collaborators.length > 1 && (
                      <button
                        onClick={() => removeCollaboratorRow(idx)}
                        className="h-12 w-12 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors shrink-0 self-end sm:self-auto"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {collaborators.length < 5 && (
                  <button
                    onClick={addCollaboratorRow}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-journi-green transition-colors px-1 py-1"
                  >
                    <UserPlus size={14} />
                    Add another
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-border/80 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className={ui.mutedButton}
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className={ui.mutedButton}
              >
                Skip - start from scratch
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleFinish}
                disabled={isCreating}
                className={ui.mutedButton}
              >
                Skip for now
              </button>
            )}

            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={showWelcomeIntro || !canProceedStep1}
                className={ui.primaryButton}
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className={ui.primaryButton}
              >
                {importFile ? "Next" : "Next"}
                <ChevronRight size={16} />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleFinish}
                disabled={isCreating}
                className={ui.primaryButton}
              >
                {isCreating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Create Project
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
