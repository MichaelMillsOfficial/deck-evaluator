"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { DeckData } from "@/lib/types";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";
import {
  DISCORD_SECTIONS,
  allocateDiscordSections,
} from "@/lib/export-report";

interface DiscordExportModalProps {
  open: boolean;
  onClose: () => void;
  analysisResults: DeckAnalysisResults;
  deck: DeckData;
}

export default function DiscordExportModal({
  open,
  onClose,
  analysisResults,
  deck,
}: DiscordExportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [enabledSections, setEnabledSections] = useState<Set<string>>(
    () =>
      new Set(
        DISCORD_SECTIONS.filter((s) => s.enabledByDefault).map((s) => s.id)
      )
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  // Handle native dialog close (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const result = allocateDiscordSections(
    analysisResults,
    deck,
    enabledSections
  );

  const handleToggle = useCallback((sectionId: string) => {
    setEnabledSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  };

  const charColor =
    result.charCount >= 1950
      ? "text-red-400"
      : result.charCount >= 1800
        ? "text-amber-400"
        : "text-slate-400";

  return (
    <dialog
      ref={dialogRef}
      data-testid="discord-export-modal"
      aria-label="Export to Discord"
      className="fixed inset-0 m-auto w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-800 p-0 text-white backdrop:bg-black/60"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Export to Discord</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Section checkboxes */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Sections
            </h3>
            {DISCORD_SECTIONS.map((section) => {
              const isEnabled =
                section.locked || enabledSections.has(section.id);
              const wontFit =
                isEnabled &&
                !section.locked &&
                result.excluded.includes(section.id);

              return (
                <label
                  key={section.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={section.locked}
                    onChange={() => handleToggle(section.id)}
                    className="rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-400 disabled:opacity-50"
                  />
                  <span
                    className={
                      section.locked
                        ? "text-slate-500"
                        : wontFit
                          ? "text-amber-400"
                          : "text-slate-300"
                    }
                  >
                    {section.label}
                    {wontFit && (
                      <span className="ml-1 text-xs text-amber-400">
                        (won&apos;t fit)
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Preview pane */}
          <div className="flex flex-col">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Preview
            </h3>
            <pre
              className="flex-1 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-64"
              data-testid="discord-preview"
            >
              {result.text}
            </pre>
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-xs ${charColor}`}>
                {result.charCount}/2000
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-700 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
