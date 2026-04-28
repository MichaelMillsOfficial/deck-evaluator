"use client";

import Link from "next/link";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import SectionHeader from "@/components/reading/SectionHeader";

export default function ComparePage() {
  const { payload } = useDeckSession();
  if (!payload) return null;

  return (
    <div
      role="tabpanel"
      id="tabpanel-deck-compare"
      aria-labelledby="tab-deck-compare"
    >
      <SectionHeader
        slug="compare"
        eyebrow="Compare"
        title="Side by Side"
        tagline="Diff this list against another for overlap, mana-curve divergence, and tag composition."
      />
      <div
        style={{
          padding: "var(--space-12)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          background: "var(--surface-2)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            marginBottom: "var(--space-7)",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "var(--text-md)",
            color: "var(--ink-secondary)",
          }}
        >
          The full compare flow lives at <code>/compare</code>. Open it in a
          new tab and import a second deck to diff against this one.
        </p>
        <Link
          href="/compare"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-4) var(--space-10)",
            borderRadius: "var(--btn-radius)",
            background: "var(--accent-gradient)",
            color: "var(--ink-on-accent)",
            fontFamily: "var(--font-sans)",
            fontWeight: "var(--weight-semibold)",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
          }}
        >
          Open Compare
        </Link>
      </div>
    </div>
  );
}
