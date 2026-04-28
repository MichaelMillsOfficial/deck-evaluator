"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import ReadingHero from "@/components/reading/ReadingHero";
import styles from "./ReadingOverview.module.css";

interface SectionTile {
  /** Unique slug; phase 4 will turn this into a real route under /reading/<slug>. */
  slug: string;
  /** Eyebrow text shown above the tile title. */
  eyebrow: string;
  /** Display title (Spectral). */
  title: string;
  /** One-line description. */
  description: string;
  /** Set true while the route doesn't exist yet — tile renders disabled. */
  pending?: boolean;
}

const SECTION_TILES: SectionTile[] = [
  {
    slug: "cards",
    eyebrow: "Cards",
    title: "The Decklist",
    description: "Every card grouped by zone with mana cost and tags.",
  },
  {
    slug: "composition",
    eyebrow: "Composition",
    title: "The Shape of the Deck",
    description: "Mana curve, color distribution, and land base efficiency.",
    pending: true,
  },
  {
    slug: "synergy",
    eyebrow: "Synergies",
    title: "How the Cards Read Together",
    description: "Top synergies, anti-synergies, combos, and interactions.",
    pending: true,
  },
  {
    slug: "goldfish",
    eyebrow: "Simulation",
    title: "Goldfish Reading",
    description: "Mulligan rates, openers, and turn-by-turn simulations.",
    pending: true,
  },
  {
    slug: "suggestions",
    eyebrow: "Recommendations",
    title: "What to Cut, What to Add",
    description: "Heuristic suggestions based on composition and themes.",
    pending: true,
  },
  {
    slug: "add",
    eyebrow: "Candidates",
    title: "Possible Additions",
    description: "Cards that match the deck's themes but aren't included.",
    pending: true,
  },
  {
    slug: "compare",
    eyebrow: "Compare",
    title: "Side by Side",
    description: "Diff this list against another for overlap and divergence.",
    pending: true,
  },
  {
    slug: "share",
    eyebrow: "Share",
    title: "Take It Elsewhere",
    description: "Export the reading as a link, image, or Discord post.",
    pending: true,
  },
];

export default function ReadingOverview() {
  const { payload, analysisResults, clearSession } = useDeckSession();
  const router = useRouter();

  if (!payload) return null;

  const handleNewReading = () => {
    clearSession();
    router.push("/");
  };

  return (
    <div className={styles.shell}>
      <button
        type="button"
        data-testid="new-reading-button"
        onClick={handleNewReading}
        className={styles.newReadingAction}
        aria-label="Start a new reading"
      >
        + New Reading
      </button>

      {analysisResults && (
        <ReadingHero
          deck={payload.deck}
          analysis={analysisResults}
          createdAt={payload.createdAt}
        />
      )}

      <span className={styles.gridLabel}>What's Inside</span>

      <div data-testid="reading-section-grid" className={styles.grid}>
        {SECTION_TILES.map((tile) => {
          const className = [
            styles.tile,
            tile.pending && styles.tilePending,
          ]
            .filter(Boolean)
            .join(" ");

          if (tile.pending) {
            return (
              <div
                key={tile.slug}
                className={className}
                aria-disabled="true"
              >
                <span className={styles.tileEyebrow}>{tile.eyebrow}</span>
                <h2 className={styles.tileTitle}>{tile.title}</h2>
                <p className={styles.tileDesc}>{tile.description}</p>
                <span className={styles.tilePendingBadge}>Coming next</span>
              </div>
            );
          }

          return (
            <Link
              key={tile.slug}
              href={`/reading/${tile.slug}`}
              className={className}
              aria-label={`${tile.eyebrow} — ${tile.title}`}
            >
              <span className={styles.tileEyebrow}>{tile.eyebrow}</span>
              <h2 className={styles.tileTitle}>{tile.title}</h2>
              <p className={styles.tileDesc}>{tile.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
