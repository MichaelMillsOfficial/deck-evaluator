"use client";

import { useMemo, useState } from "react";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { buildFinalDeck } from "@/lib/crucible-session";
import { computeManaCurve } from "@/lib/mana-curve";
import {
  computeColorDistribution,
  computeManaBaseMetrics,
  MTG_COLORS,
} from "@/lib/color-distribution";
import type { DeckData } from "@/lib/types";
import { CurveConstellation, type ManaCurve } from "@/components/deck/CurveConstellation";
import { ColorPie } from "@/components/deck/ColorPie";
import styles from "./crucible.module.css";

type Scope = "kept" | "pool";

export default function CrucibleCharts() {
  const { payload, cardMap } = useCrucibleSession();
  const [scope, setScope] = useState<Scope>("kept");

  const deck = useMemo<DeckData | null>(() => {
    if (!payload) return null;
    if (scope === "kept") {
      // Kept + commanders only; cuts (sideboard) excluded.
      return { ...buildFinalDeck(payload, "Kept"), sideboard: [] };
    }
    return {
      name: "Pool",
      source: "text",
      url: "",
      commanders: [],
      mainboard: payload.pool,
      sideboard: [],
    };
  }, [payload, scope]);

  const curve = useMemo<ManaCurve | null>(() => {
    if (!deck || !cardMap) return null;
    const buckets = computeManaCurve(deck, cardMap);
    return {
      buckets: buckets.map((b) => b.permanents + b.nonPermanents) as ManaCurve["buckets"],
    };
  }, [deck, cardMap]);

  const distribution = useMemo(() => {
    if (!deck || !cardMap) return null;
    return computeColorDistribution(deck, cardMap);
  }, [deck, cardMap]);

  const metrics = useMemo(() => {
    if (!deck || !cardMap) return null;
    return computeManaBaseMetrics(deck, cardMap);
  }, [deck, cardMap]);

  if (!payload || !cardMap || !curve || !distribution) return null;

  return (
    <section data-testid="crucible-charts" aria-label="Charts" className={styles.panel}>
      <div className={styles.chartsHead}>
        <h2 className={styles.panelTitle}>Charts</h2>
        <div className={styles.chartsScope} role="group" aria-label="Chart scope">
          <button
            type="button"
            className={`${styles.scopeButton} ${scope === "kept" ? styles.scopeButtonActive : ""}`}
            aria-pressed={scope === "kept"}
            onClick={() => setScope("kept")}
          >
            Kept
          </button>
          <button
            type="button"
            className={`${styles.scopeButton} ${scope === "pool" ? styles.scopeButtonActive : ""}`}
            aria-pressed={scope === "pool"}
            onClick={() => setScope("pool")}
          >
            Pool
          </button>
        </div>
      </div>

      <h3 className={styles.chartsEyebrow}>Mana Curve</h3>
      <CurveConstellation curve={curve} />

      <div className={styles.chartsSplit}>
        <div>
          <h3 className={styles.chartsEyebrow}>Color Pips</h3>
          <ColorPie distribution={distribution.pips} />
        </div>
        <div className={styles.chartsPips}>
          <h3 className={styles.chartsEyebrow}>Pip Coverage · sources vs pips</h3>
          {MTG_COLORS.map((color) => {
            const sources = distribution.sources[color];
            const pips = distribution.pips[color];
            if (sources === 0 && pips === 0) return null;
            const ratio = pips === 0 ? 1 : Math.min(1, sources / pips);
            return (
              <div key={color} className={styles.pipRow}>
                <span className={styles.pipColor}>{color}</span>
                <span className={styles.pipBar}>
                  <span
                    className={styles.pipFill}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </span>
                <span className={styles.pipValue}>
                  {sources} src / {pips} pips
                </span>
              </div>
            );
          })}
          {metrics ? (
            <p className={styles.panelMuted}>
              {metrics.landCount} lands · {metrics.landPercentage.toFixed(0)}% ·
              avg mana value {metrics.averageCmc.toFixed(2)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
