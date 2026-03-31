/**
 * ProjectOnboardingWizard
 * 3-step onboarding modal for new users:
 *   Step 1 — Project details (name, description, deadline, manuscript type)
 *   Step 2 — Import existing doc (optional)
 *   Step 3 — Invite collaborators (optional)
 */
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderPlus,
  FileUp,
  Users,
  ChevronRight,
  ChevronLeft,
  X,
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

export default function ProjectOnboardingWizard({ onComplete }: Props) {
  const [, navigate] = useLocation();
  const { createProject, addCollaborator } = useProject();
  const { createManuscript } = useManuscript();

  // Step navigation
  const [step, setStep] = useState<Step>(1);
  const [isCreating, setIsCreating] = useState(false);

  // Step 1 — project info
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [manuscriptType, setManuscriptType] = useState<ManuscriptType>("full_paper");

  // Step 2 — file import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportDocumentResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — collaborators
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
    // Create a synthetic change event
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
    setCollaborators((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  };

  const handleFinish = async () => {
    if (!canProceedStep1) return;
    setIsCreating(true);

    try {
      const project = await createProject(
        projectName.trim(),
        description.trim(),
        dueDate || undefined,
      );

      // Create manuscript
      const msTitle = importResult?.title || "Untitled Manuscript";
      createManuscript(msTitle, manuscriptType);

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

      // If they imported a doc, go to editor; otherwise stay on dashboard
      if (importResult && importFile) {
        navigate("/collaboration");
        // The Collaboration page handles the actual section import via its own wizard/import flow
        // We'll trigger re-import there since the manuscript was just created
      }

      onComplete();
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
        transition={{ duration: 0.2 }}
        className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-5 pb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`h-1 w-full rounded-full transition-colors ${
                  s <= step ? "bg-journi-green" : "bg-muted"
                }`}
              />
              <span className={`text-[10px] font-medium ${s <= step ? "text-journi-green" : "text-muted-foreground"}`}>
                {STEP_LABELS[s - 1]}
              </span>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="px-6 pt-2 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {step === 1 && "Set up your project"}
            {step === 2 && "Import your work"}
            {step === 3 && "Invite your team"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {step === 1 && "Give your research project a name to get started."}
            {step === 2 && "Upload an existing document or start from scratch."}
            {step === 3 && "Add co-authors so you can collaborate."}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[260px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {/* Project name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Project name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Phase III Clinical Trial Analysis"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green/50 focus:border-journi-green"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Description <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of your research..."
                    rows={2}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-journi-green/50 focus:border-journi-green"
                  />
                </div>

                <div className="flex gap-3">
                  {/* Deadline */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Submission deadline <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green/50 focus:border-journi-green"
                    />
                  </div>

                  {/* Manuscript type */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Manuscript type
                    </label>
                    <select
                      value={manuscriptType}
                      onChange={(e) => setManuscriptType(e.target.value as ManuscriptType)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green/50 focus:border-journi-green"
                    >
                      {MANUSCRIPT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {!importFile ? (
                  <>
                    {/* Drop zone */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border hover:border-journi-green/40 hover:bg-journi-green/5 rounded-xl p-8 text-center cursor-pointer transition-colors"
                    >
                      <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        Drop your file here or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports .docx and .pdf
                      </p>
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
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 size={28} className="animate-spin text-journi-green mb-3" />
                    <p className="text-sm text-muted-foreground">Parsing your document...</p>
                  </div>
                ) : importResult ? (
                  <div className="border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-journi-green/10 rounded-lg shrink-0">
                        <FileText size={20} className="text-journi-green" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{importFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {importResult.sections.length} section{importResult.sections.length !== 1 ? "s" : ""} &middot;{" "}
                          {importResult.totalWordCount.toLocaleString()} words
                        </p>
                      </div>
                      <button
                        onClick={clearImport}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                        aria-label="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-journi-green">
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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {collaborators.map((collab, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={collab.name}
                      onChange={(e) => updateCollaboratorRow(idx, "name", e.target.value)}
                      placeholder="Name"
                      className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green/50 focus:border-journi-green"
                    />
                    <input
                      type="email"
                      value={collab.email}
                      onChange={(e) => updateCollaboratorRow(idx, "email", e.target.value)}
                      placeholder="Email"
                      className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green/50 focus:border-journi-green"
                    />
                    {collaborators.length > 1 && (
                      <button
                        onClick={() => removeCollaboratorRow(idx)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors shrink-0"
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
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-journi-green transition-colors"
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
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Skip button on steps 2 & 3 */}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                Skip — start from scratch
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleFinish}
                disabled={isCreating}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
              >
                Skip for now
              </button>
            )}

            {/* Primary action */}
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="flex items-center gap-1.5 bg-journi-green text-journi-slate text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 bg-journi-green text-journi-slate text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                {importFile ? "Next" : "Next"}
                <ChevronRight size={16} />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleFinish}
                disabled={isCreating}
                className="flex items-center gap-1.5 bg-journi-green text-journi-slate text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {isCreating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Creating…
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
