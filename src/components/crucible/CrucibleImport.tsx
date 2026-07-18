"use client";

import { useState, type FormEvent } from "react";
import SectionHeader from "@/components/reading/SectionHeader";
import { Button, Textarea } from "@/components/ui";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { flattenPileParse } from "@/lib/crucible-session";
import type { ParseResult } from "@/lib/decklist-parser";
import type { DeckData } from "@/lib/types";
import styles from "./crucible.module.css";

export default function CrucibleImport() {
  const { setPile } = useCrucibleSession();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        setError(json?.error ?? "Could not read the pile — check the list format.");
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
      setError("Network error — could not reach the parser.");
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
          <Button type="submit" variant="primary" disabled={!text.trim() || submitting}>
            Begin Refinement
          </Button>
        </div>
      </form>
    </main>
  );
}
