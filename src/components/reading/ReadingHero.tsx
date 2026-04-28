import type { DeckData } from "@/lib/types";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";
import { Eyebrow, StatTile } from "@/components/ui";
import { deckTagline } from "@/lib/deck-tagline";
import styles from "./ReadingHero.module.css";

export interface ReadingHeroProps {
  deck: DeckData;
  analysis: DeckAnalysisResults;
  /** Wall-clock timestamp at deck import. Used for the READING · DATE eyebrow. */
  createdAt: number;
}

function formatReadingDate(timestamp: number): string {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

export default function ReadingHero({
  deck,
  analysis,
  createdAt,
}: ReadingHeroProps) {
  const tagline = deckTagline(deck, analysis);
  const date = formatReadingDate(createdAt);
  const commanderNames = deck.commanders.map((c) => c.name);
  const topTheme = analysis.synergyAnalysis.deckThemes[0];

  return (
    <section data-testid="reading-hero" className={styles.hero}>
      <Eyebrow>{`READING · ${date}`}</Eyebrow>

      <h1 className={styles.title}>{deck.name}</h1>

      <p data-testid="reading-tagline" className={styles.tagline}>
        {tagline}
      </p>

      {commanderNames.length > 0 && (
        <p className={styles.commanderRow}>
          led by {commanderNames.join(" & ")}
        </p>
      )}

      <div data-testid="reading-stats" className={styles.stats}>
        <StatTile
          label="Bracket"
          value={`B${analysis.bracketResult.bracket}`}
          sub={analysis.bracketResult.bracketName}
        />
        <StatTile
          label="Power Level"
          value={`PL${analysis.powerLevel.powerLevel}`}
          sub={analysis.powerLevel.bandLabel}
          accent
        />
        <StatTile
          label="Total Cost"
          value={analysis.budgetAnalysis.totalCostFormatted}
          sub="USD"
        />
        <StatTile
          label="Top Theme"
          value={topTheme?.axisName ?? "Goodstuff"}
          sub={
            topTheme?.detail
              ? topTheme.detail
              : topTheme
                ? `${topTheme.cardCount} cards`
                : "no dominant theme"
          }
        />
      </div>
    </section>
  );
}
