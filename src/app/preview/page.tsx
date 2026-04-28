"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardTag,
  Eyebrow,
  Input,
  Sheet,
  StatTile,
  Tag,
  Textarea,
  type DeckRole,
} from "@/components/ui";
import {
  CardRow,
  ColorPie,
  CurveConstellation,
  DeckHero,
  ManaCost,
} from "@/components/deck";
import styles from "./preview.module.css";

const DECK_ROLES: DeckRole[] = [
  "COMMANDER",
  "ENGINE",
  "WINCON",
  "DRAW",
  "RAMP",
  "REMOVAL",
];

export default function PreviewPage() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Eyebrow>ASTRAL · PRIMITIVES · 04.27.26</Eyebrow>
          <h1 className={styles.title}>Astral · Primitives</h1>
          <p className={styles.tagline}>
            Every primitive in every state. The ground truth for the design
            system.
          </p>
        </header>

        {/* ─── Eyebrow ─── */}
        <section className={styles.section} data-testid="preview-eyebrow">
          <div className={styles.sectionHead}>
            <Eyebrow>FOUNDATION · 01</Eyebrow>
            <h2 className={styles.sectionTitle}>Eyebrow</h2>
            <p className={styles.sectionTagline}>
              Mono · 10px · uppercase · 0.22em tracked · accent.
            </p>
          </div>
          <div className={styles.panel}>
            <div className={styles.column}>
              <Eyebrow>READING · 04.27.26</Eyebrow>
              <Eyebrow>CENTRALITY · KEEP RATE</Eyebrow>
              <Eyebrow>POWER · 7.4 / 10</Eyebrow>
            </div>
          </div>
        </section>

        {/* ─── Button ─── */}
        <section className={styles.section} data-testid="preview-button">
          <div className={styles.sectionHead}>
            <Eyebrow>PRIMITIVE · 02</Eyebrow>
            <h2 className={styles.sectionTitle}>Button</h2>
            <p className={styles.sectionTagline}>
              Variants × sizes × states.
            </p>
          </div>
          <div className={styles.panel}>
            <div className={styles.subhead}>Primary</div>
            <div className={styles.row}>
              <Button size="sm">Primary sm</Button>
              <Button size="md">Primary md</Button>
              <Button size="lg">Primary lg</Button>
              <Button disabled>Primary disabled</Button>
            </div>
            <div className={styles.subhead}>Secondary</div>
            <div className={styles.row}>
              <Button variant="secondary" size="sm">
                Secondary sm
              </Button>
              <Button variant="secondary">Secondary md</Button>
              <Button variant="secondary" size="lg">
                Secondary lg
              </Button>
              <Button variant="secondary" disabled>
                Secondary disabled
              </Button>
            </div>
            <div className={styles.subhead}>Ghost</div>
            <div className={styles.row}>
              <Button variant="ghost">Ghost md</Button>
              <Button variant="ghost" disabled>
                Ghost disabled
              </Button>
            </div>
            <div className={styles.subhead}>Danger</div>
            <div className={styles.row}>
              <Button variant="danger">Danger md</Button>
            </div>
            <div className={styles.subhead}>Icon</div>
            <div className={styles.row}>
              <Button variant="icon" aria-label="Close">
                ×
              </Button>
              <Button variant="icon" aria-label="Search">
                ⌕
              </Button>
              <Button variant="icon" aria-label="Share">
                ⤴
              </Button>
            </div>
          </div>
        </section>

        {/* ─── Input ─── */}
        <section className={styles.section} data-testid="preview-input">
          <div className={styles.sectionHead}>
            <Eyebrow>PRIMITIVE · 03</Eyebrow>
            <h2 className={styles.sectionTitle}>Input</h2>
            <p className={styles.sectionTagline}>
              Default · focus · filled · error · disabled. Mono variant for
              code-shaped content.
            </p>
          </div>
          <div className={styles.panel}>
            <div className={styles.column}>
              <Input placeholder="Search by name, role…" />
              <Input mono placeholder="moxfield.com/decks/…" />
              <div>
                <Input
                  aria-label="URL"
                  defaultValue="not-a-real-url"
                  invalid
                />
                <div className={styles.errorHint}>That URL doesn't parse.</div>
              </div>
              <Input placeholder="Disabled" disabled />
              <Textarea placeholder="Paste a decklist…" mono />
            </div>
          </div>
        </section>

        {/* ─── Card ─── */}
        <section className={styles.section} data-testid="preview-card">
          <div className={styles.sectionHead}>
            <Eyebrow>PRIMITIVE · 04</Eyebrow>
            <h2 className={styles.sectionTitle}>Card</h2>
            <p className={styles.sectionTagline}>
              Surface · accent-soft · outline.
            </p>
          </div>
          <div className={styles.grid3}>
            <Card eyebrow="SURFACE-1" title="Default">
              The baseline panel — everything sits in one of these unless it's
              hero or accent-soft.
            </Card>
            <Card variant="accent" eyebrow="ACCENT-SOFT" title="Highlight">
              For "the reading" callouts, primary recommendations, hero blocks.
            </Card>
            <Card variant="outline" eyebrow="OUTLINE" title="Quiet">
              For grouping without weight. Used sparingly.
            </Card>
          </div>
        </section>

        {/* ─── Tag ─── */}
        <section className={styles.section} data-testid="preview-tag">
          <div className={styles.sectionHead}>
            <Eyebrow>PRIMITIVE · 05</Eyebrow>
            <h2 className={styles.sectionTitle}>Tag</h2>
            <p className={styles.sectionTagline}>
              Mono · uppercase · pill. Status-coded.
            </p>
          </div>
          <div className={styles.panel}>
            <div className={styles.row}>
              <Tag variant="accent">ACCENT</Tag>
              <Tag variant="cyan">CYAN</Tag>
              <Tag variant="gold">GOLD</Tag>
              <Tag variant="ok">ON BUDGET</Tag>
              <Tag variant="watch">WATCH</Tag>
              <Tag variant="warn">FLOOD RISK</Tag>
              <Tag variant="ghost">SNOOZED</Tag>
            </div>
          </div>
        </section>

        {/* ─── CardTag ─── */}
        <section className={styles.section} data-testid="preview-cardtag">
          <div className={styles.sectionHead}>
            <Eyebrow>PRIMITIVE · 06</Eyebrow>
            <h2 className={styles.sectionTitle}>CardTag</h2>
            <p className={styles.sectionTagline}>
              Deck role → fixed color lookup.
            </p>
          </div>
          <div className={styles.panel}>
            <div className={styles.row}>
              {DECK_ROLES.map((role) => (
                <CardTag key={role} role={role} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── StatTile ─── */}
        <section className={styles.section} data-testid="preview-stattile">
          <div className={styles.sectionHead}>
            <Eyebrow>PRIMITIVE · 07</Eyebrow>
            <h2 className={styles.sectionTitle}>StatTile</h2>
            <p className={styles.sectionTagline}>
              Mono label, big serif number, optional sub.
            </p>
          </div>
          <div className={styles.grid4}>
            <StatTile label="POWER" value="7.4" accent sub="/10" />
            <StatTile label="WIN RATE" value="87%" />
            <StatTile label="AVG WIN" value="T8.2" sub="TURNS" />
            <StatTile label="CURVE" value="2.84" />
          </div>
        </section>

        {/* ─── ManaCost ─── */}
        <section className={styles.section} data-testid="preview-manacost">
          <div className={styles.sectionHead}>
            <Eyebrow>DOMAIN · 01</Eyebrow>
            <h2 className={styles.sectionTitle}>ManaCost</h2>
            <p className={styles.sectionTagline}>
              Colored pips per WUBRG · numeric · X. Uses --mana-* tokens.
            </p>
          </div>
          <div className={styles.panel}>
            <div className={styles.column}>
              <div className={styles.row}>
                <ManaCost symbols={["2", "U", "G"]} />
                <ManaCost symbols={["W", "W"]} />
                <ManaCost symbols={["X", "B", "R"]} />
                <ManaCost symbols={["3"]} />
              </div>
              <div className={styles.row}>
                <ManaCost symbols={["2", "U", "G"]} size="lg" />
                <ManaCost symbols={["1", "W", "U", "B", "R", "G"]} size="lg" />
              </div>
            </div>
          </div>
        </section>

        {/* ─── ColorPie ─── */}
        <section className={styles.section} data-testid="preview-colorpie">
          <div className={styles.sectionHead}>
            <Eyebrow>DOMAIN · 02</Eyebrow>
            <h2 className={styles.sectionTitle}>ColorPie</h2>
            <p className={styles.sectionTagline}>
              SVG donut for color distribution. Empty colors are skipped.
            </p>
          </div>
          <div className={styles.panel}>
            <ColorPie
              distribution={{ W: 5, U: 12, B: 0, R: 3, G: 7, C: 0 }}
              size={120}
            />
          </div>
        </section>

        {/* ─── CurveConstellation ─── */}
        <section
          className={styles.section}
          data-testid="preview-curveconstellation"
        >
          <div className={styles.sectionHead}>
            <Eyebrow>DOMAIN · 03</Eyebrow>
            <h2 className={styles.sectionTitle}>CurveConstellation</h2>
            <p className={styles.sectionTagline}>
              Planet-sized circles per CMC bucket. Radius ∝ √count.
            </p>
          </div>
          <div className={styles.panel}>
            <CurveConstellation
              curve={{ buckets: [4, 8, 12, 9, 6, 4, 2, 1] }}
            />
          </div>
        </section>

        {/* ─── CardRow ─── */}
        <section className={styles.section} data-testid="preview-cardrow">
          <div className={styles.sectionHead}>
            <Eyebrow>DOMAIN · 04</Eyebrow>
            <h2 className={styles.sectionTitle}>CardRow</h2>
            <p className={styles.sectionTagline}>
              The list unit. Hover surfaces an accent fill.
            </p>
          </div>
          <div className={styles.panel} style={{ padding: "var(--space-2)" }}>
            <CardRow
              qty={1}
              name="Slogurk, the Overslime"
              cost={["1", "G", "G", "U"]}
              role="COMMANDER"
              price="$4.20"
              onClick={() => {}}
            />
            <CardRow
              qty={1}
              name="Crucible of Worlds"
              cost={["3"]}
              role="ENGINE"
              price="$18.00"
              onClick={() => {}}
            />
            <CardRow
              qty={1}
              name="Cultivate"
              cost={["2", "G"]}
              role="RAMP"
              price="$0.50"
              onClick={() => {}}
            />
            <CardRow
              qty={1}
              name="Brainstorm"
              cost={["U"]}
              role="DRAW"
              price="$0.40"
              onClick={() => {}}
            />
            <CardRow
              qty={1}
              name="Cyclonic Rift"
              cost={["1", "U"]}
              role="REMOVAL"
              price="$32.00"
              onClick={() => {}}
            />
          </div>
        </section>

        {/* ─── DeckHero ─── */}
        <section className={styles.section} data-testid="preview-deckhero">
          <div className={styles.sectionHead}>
            <Eyebrow>DOMAIN · 05</Eyebrow>
            <h2 className={styles.sectionTitle}>DeckHero</h2>
            <p className={styles.sectionTagline}>
              Eyebrow → serif title → italic tagline → gradient power score.
            </p>
          </div>
          <DeckHero
            eyebrow="READING · 04.27.26"
            title="Slogurk, the Overslime"
            tagline='"A landfall engine that wins decisively when it gets there — but watches the door for flood."'
            score="7.4"
            scoreMeta="/10 · UPGRADED BRACKET"
          />
        </section>

        {/* ─── Sheet ─── */}
        <section className={styles.section} data-testid="preview-sheet">
          <div className={styles.sectionHead}>
            <Eyebrow>PRIMITIVE · 08</Eyebrow>
            <h2 className={styles.sectionTitle}>Sheet</h2>
            <p className={styles.sectionTagline}>
              Bottom drawer on mobile. Centered modal on desktop.
            </p>
          </div>
          <div className={styles.panel}>
            <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
          </div>
          <Sheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            eyebrow="PEEK"
            title="Crucible of Worlds"
          >
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "var(--text-body)",
                color: "var(--ink-secondary)",
                margin: "0 0 var(--space-10)",
                lineHeight: 1.55,
                padding: "var(--space-5) var(--space-6)",
                background: "rgba(0,0,0,0.3)",
                borderLeft: "2px solid var(--accent)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              "You may play lands from your graveyard."
            </p>
            <div className={styles.grid3}>
              <StatTile label="CENTRALITY" value="#2" accent />
              <StatTile label="KEEP RATE" value="81%" accent />
              <StatTile label="PRICE" value="$18" accent />
            </div>
          </Sheet>
        </section>
      </main>
    </div>
  );
}
