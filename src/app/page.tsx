import Link from "next/link";
import DeckImportSection from "@/components/DeckImportSection";
import { Card, Eyebrow } from "@/components/ui";
import styles from "./home.module.css";

const features = [
  "Mana curve and color distribution analysis",
  "Land base efficiency scoring",
  "Card synergy and interaction mapping",
  "Opening hand simulation and mulligan testing",
  "Format-specific deck validation",
  "Performance metrics and win-rate estimation",
];

export default function HomePage() {
  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <Eyebrow>DECK EVALUATION · BEGIN A READING</Eyebrow>
        <h1 className={styles.title}>
          <span>Magic: The Gathering</span>
          <br />
          <span className={styles.titleAccent}>Deck Evaluator</span>
        </h1>
        <p className={styles.tagline}>
          Import your deck and analyze its performance, mana base efficiency,
          and synergy structure under simulated play.
        </p>
      </header>

      <div className={styles.shell}>
        <DeckImportSection />

        <Card
          variant="accent"
          eyebrow="SIDE BY SIDE"
          aria-labelledby="compare-callout-title"
        >
          <div className={styles.compareCard}>
            <div>
              <h2 id="compare-callout-title" className={styles.compareTitle}>
                Compare Decks
              </h2>
              <p className={styles.compareCopy}>
                Import two decklists side by side to see card overlap, mana
                curve differences, and tag composition.
              </p>
            </div>
            <Link href="/compare" className={styles.compareCta}>
              Compare Decks
            </Link>
          </div>
        </Card>

        <Card eyebrow="WHAT YOU GET" aria-labelledby="features-heading">
          <h2 id="features-heading" className={styles.compareTitle}>
            Features
          </h2>
          <ul className={styles.featuresList}>
            {features.map((feature) => (
              <li key={feature} className={styles.featureItem}>
                <span aria-hidden="true" className={styles.featureBullet} />
                {feature}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
