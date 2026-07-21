"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import SectionHeader from "@/components/reading/SectionHeader";
import CardSearchInput from "@/components/CardSearchInput";
import { Button, Textarea } from "@/components/ui";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { appendCardToPileText, flattenPileParse } from "@/lib/crucible-session";
import { parsePileFromDck } from "@/lib/crucible-share";
import type { ParseResult } from "@/lib/decklist-parser";
import type { DeckData } from "@/lib/types";
import styles from "./crucible.module.css";

/** The search excludes nothing: re-selecting a name bumps its line's count. */
const EMPTY_NAME_SET = new Set<string>();
const EMPTY_CANDIDATES: string[] = [];

/** Reject a `.dck` upload larger than this before reading it into memory. */
const MAX_DCK_FILE_BYTES = 512_000;

export default function CrucibleImport() {
  const { setPile, loadPile } = useCrucibleSession();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFromSearch = useCallback((name: string) => {
    setText((prev) => appendCardToPileText(prev, name));
  }, []);

  async function handleDckFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so re-selecting the same file still fires onChange.
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_DCK_FILE_BYTES) {
      setError("That .dck file is too large to import.");
      return;
    }
    let fileText: string;
    try {
      fileText = await file.text();
    } catch {
      setError("Could not read that file.");
      return;
    }
    const payload = parsePileFromDck(fileText);
    if (!payload) {
      setError("That file is not a readable .dck pile.");
      return;
    }
    loadPile(payload);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/deck-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Could not read the pile - check the list format.");
        return;
      }
      // The parse API returns the deck flattened: { ...deck, warnings }.
      const json = (await res.json()) as DeckData & { warnings?: string[] };
      const parsed: ParseResult = {
        deck: {
          name: json.name,
          source: json.source,
          url: json.url,
          commanders: json.commanders ?? [],
          mainboard: json.mainboard ?? [],
          sideboard: json.sideboard ?? [],
        },
        warnings: json.warnings ?? [],
      };
      const { pool, warnings } = flattenPileParse(parsed);
      if (pool.length === 0) {
        setError("No cards found in the pile.");
        return;
      }
      setPile(pool, warnings);
    } catch {
      setError("Network error - could not reach the parser.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.importMain}>
      <SectionHeader
        slug="crucible"
        eyebrow="The Crucible"
        title="Pour in the pile"
        tagline="Any number of cards. No structure required. Walk out with a legal hundred."
      />
      <form onSubmit={handleSubmit} className={styles.importForm}>
        <CardSearchInput
          deckCardNames={EMPTY_NAME_SET}
          candidateNames={EMPTY_CANDIDATES}
          onAddCard={addFromSearch}
        />
        <label htmlFor="crucible-pile" className={styles.importLabel}>
          Card pile
        </label>
        <Textarea
          id="crucible-pile"
          mono
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"1 Sol Ring\n1 Swords to Plowshares\n12 Plains\n…"}
        />
        {error ? (
          <p role="alert" className={styles.importError}>
            {error}
          </p>
        ) : null}
        <div className={styles.importActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".dck,text/plain"
            aria-hidden="true"
            tabIndex={-1}
            className={styles.hiddenFileInput}
            data-testid="crucible-dck-input"
            onChange={handleDckFile}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Import a .dck file
          </Button>
          <Button type="submit" variant="primary" disabled={!text.trim() || submitting}>
            Begin Refinement
          </Button>
        </div>
      </form>
    </main>
  );
}
