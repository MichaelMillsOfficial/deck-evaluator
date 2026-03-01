import type { DeckData } from "./types";
import type { DeckAnalysisResults } from "./deck-analysis-aggregate";

// ---------------------------------------------------------------------------
// Discord Section Registry
// ---------------------------------------------------------------------------

export interface DiscordSection {
  id: string;
  label: string;
  priority: number;
  enabledByDefault: boolean;
  locked?: boolean;
  render: (results: DeckAnalysisResults, deck: DeckData) => string;
}

function renderHeader(results: DeckAnalysisResults, deck: DeckData): string {
  const commanders = deck.commanders.map((c) => c.name).join(" & ");
  const totalCards =
    deck.commanders.reduce((s, c) => s + c.quantity, 0) +
    deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
    deck.sideboard.reduce((s, c) => s + c.quantity, 0);
  const lines = [`**${deck.name}**`];
  if (commanders) lines.push(`Commander: ${commanders}`);
  lines.push(
    `B${results.bracketResult.bracket} | PL${results.powerLevel.powerLevel} | ${totalCards} cards | via ${deck.source}`
  );
  return lines.join("\n");
}

function renderCurve(results: DeckAnalysisResults): string {
  const { manaCurve, manaBaseMetrics } = results;
  const maxCount = Math.max(
    ...manaCurve.map((b) => b.permanents + b.nonPermanents),
    1
  );
  const lines = [`**Mana Curve** (avg CMC ${manaBaseMetrics.averageCmc.toFixed(2)})`];
  for (const bucket of manaCurve) {
    const total = bucket.permanents + bucket.nonPermanents;
    const barLen = Math.round((total / maxCount) * 8);
    const bar = "\u25AA".repeat(barLen);
    lines.push(`\`${bucket.cmc.padStart(2)}\` ${bar} ${total}`);
  }
  return lines.join("\n");
}

function renderLandEfficiency(results: DeckAnalysisResults): string {
  const { landEfficiency } = results;
  return `**Land Efficiency:** ${landEfficiency.overallScore}/100 (${landEfficiency.scoreLabel})`;
}

function renderSynergyThemes(results: DeckAnalysisResults): string {
  const { synergyAnalysis } = results;
  const themes = synergyAnalysis.deckThemes.slice(0, 5);
  if (themes.length === 0) return "**Synergy Themes:** None detected";
  const lines = ["**Synergy Themes:**"];
  for (const theme of themes) {
    lines.push(`- ${theme.axisName} (${theme.cardCount} cards)`);
  }
  return lines.join("\n");
}

function renderOpeningHands(results: DeckAnalysisResults): string {
  const { simulationStats } = results;
  const keepPct = Math.round(simulationStats.keepableRate * 100);
  const avgLands = simulationStats.avgLandsInOpener.toFixed(1);
  const t1 = Math.round(simulationStats.probT1Play * 100);
  const t2 = Math.round(simulationStats.probT2Play * 100);
  const t3 = Math.round(simulationStats.probT3Play * 100);
  const lines = [
    `**Opening Hands** (${simulationStats.totalSimulations} sims)`,
    `Keep rate: ${keepPct}% | Avg lands: ${avgLands}`,
    `T1 play: ${t1}% | T2: ${t2}% | T3: ${t3}%`,
  ];
  return lines.join("\n");
}

function renderCompositionGaps(results: DeckAnalysisResults): string {
  const { compositionScorecard } = results;
  const gaps = compositionScorecard.categories.filter(
    (c) => c.status === "low" || c.status === "critical"
  );
  if (gaps.length === 0) return "**Composition:** All categories healthy";
  const lines = ["**Composition Gaps:**"];
  for (const gap of gaps) {
    lines.push(
      `- ${gap.label}: ${gap.count}/${gap.min}-${gap.max} (${gap.status})`
    );
  }
  return lines.join("\n");
}

function renderCombos(results: DeckAnalysisResults): string {
  const { synergyAnalysis } = results;
  const combos = synergyAnalysis.knownCombos.slice(0, 3);
  if (combos.length === 0) return "**Known Combos:** None detected";
  const lines = ["**Known Combos:**"];
  for (const combo of combos) {
    lines.push(`- ${combo.cards.join(" + ")}`);
  }
  return lines.join("\n");
}

function renderBudget(results: DeckAnalysisResults): string {
  const { budgetAnalysis } = results;
  const lines = [
    `**Budget:** ${budgetAnalysis.totalCostFormatted}`,
  ];
  if (budgetAnalysis.mostExpensive.length > 0) {
    const top = budgetAnalysis.mostExpensive[0];
    lines.push(
      `Most expensive: ${top.name} ($${top.unitPrice.toFixed(2)})`
    );
  }
  return lines.join("\n");
}

function renderColorDistribution(results: DeckAnalysisResults): string {
  const { colorDistribution } = results;
  const colors = ["W", "U", "B", "R", "G"] as const;
  const parts: string[] = [];
  for (const c of colors) {
    const sources = colorDistribution.sources[c];
    if (sources > 0) parts.push(`${c}:${sources}`);
  }
  if (colorDistribution.colorlessSources > 0) {
    parts.push(`C:${colorDistribution.colorlessSources}`);
  }
  return `**Color Sources:** ${parts.join(" | ")}`;
}

function renderPowerBracket(results: DeckAnalysisResults): string {
  return `**Classification:** ${results.powerLevel.bandLabel} (PL${results.powerLevel.powerLevel}) | ${results.bracketResult.bracketName} (B${results.bracketResult.bracket})`;
}

function renderRecommendations(results: DeckAnalysisResults): string {
  const { manaRecommendations } = results;
  const recs = manaRecommendations.recommendations.slice(0, 3);
  if (recs.length === 0)
    return "**Mana Recommendations:** No issues found";
  const lines = ["**Mana Recommendations:**"];
  for (const rec of recs) {
    const icon =
      rec.severity === "critical"
        ? "\u{1F534}"
        : rec.severity === "warning"
          ? "\u{1F7E1}"
          : "\u{1F535}";
    lines.push(`${icon} ${rec.title}`);
  }
  return lines.join("\n");
}

export const DISCORD_SECTIONS: DiscordSection[] = [
  {
    id: "header",
    label: "Header",
    priority: 1,
    enabledByDefault: true,
    locked: true,
    render: renderHeader,
  },
  {
    id: "curve",
    label: "Mana Curve",
    priority: 2,
    enabledByDefault: true,
    render: renderCurve,
  },
  {
    id: "land-efficiency",
    label: "Land Efficiency",
    priority: 3,
    enabledByDefault: true,
    render: renderLandEfficiency,
  },
  {
    id: "synergy-themes",
    label: "Synergy Themes",
    priority: 4,
    enabledByDefault: true,
    render: renderSynergyThemes,
  },
  {
    id: "opening-hands",
    label: "Opening Hands",
    priority: 5,
    enabledByDefault: true,
    render: renderOpeningHands,
  },
  {
    id: "composition-gaps",
    label: "Composition Gaps",
    priority: 6,
    enabledByDefault: true,
    render: renderCompositionGaps,
  },
  {
    id: "combos",
    label: "Known Combos",
    priority: 7,
    enabledByDefault: true,
    render: renderCombos,
  },
  {
    id: "budget",
    label: "Budget",
    priority: 8,
    enabledByDefault: true,
    render: renderBudget,
  },
  {
    id: "color-distribution",
    label: "Color Distribution",
    priority: 9,
    enabledByDefault: false,
    render: renderColorDistribution,
  },
  {
    id: "power-bracket",
    label: "Power & Bracket",
    priority: 10,
    enabledByDefault: false,
    render: renderPowerBracket,
  },
  {
    id: "recommendations",
    label: "Mana Recommendations",
    priority: 11,
    enabledByDefault: false,
    render: renderRecommendations,
  },
];

// ---------------------------------------------------------------------------
// Budget Allocator
// ---------------------------------------------------------------------------

export function allocateDiscordSections(
  results: DeckAnalysisResults,
  deck: DeckData,
  enabledSections: Set<string>,
  maxChars = 2000,
  shareUrl?: string
): { included: string[]; excluded: string[]; text: string; charCount: number } {
  const included: string[] = [];
  const excluded: string[] = [];
  const rendered: string[] = [];
  let totalChars = 0;

  // Reserve space for share URL footer if provided
  const footerText = shareUrl ? `\n\nView full analysis: ${shareUrl}` : "";
  const effectiveMax = maxChars - footerText.length;

  // Always include header first
  const headerSection = DISCORD_SECTIONS.find((s) => s.id === "header")!;
  const headerText = headerSection.render(results, deck);
  rendered.push(headerText);
  totalChars += headerText.length;
  included.push("header");

  // Sort remaining enabled sections by priority
  const remaining = DISCORD_SECTIONS.filter(
    (s) => !s.locked && enabledSections.has(s.id)
  ).sort((a, b) => a.priority - b.priority);

  for (const section of remaining) {
    const sectionText = "\n\n" + section.render(results, deck);
    if (totalChars + sectionText.length <= effectiveMax) {
      rendered.push(sectionText);
      totalChars += sectionText.length;
      included.push(section.id);
    } else {
      excluded.push(section.id);
    }
  }

  // Add non-enabled non-locked sections to excluded
  for (const section of DISCORD_SECTIONS) {
    if (
      !section.locked &&
      !enabledSections.has(section.id) &&
      !excluded.includes(section.id)
    ) {
      excluded.push(section.id);
    }
  }

  // Append share URL footer
  if (footerText) {
    rendered.push(footerText);
    totalChars += footerText.length;
  }

  const text = rendered.join("");
  return { included, excluded, text, charCount: text.length };
}

// ---------------------------------------------------------------------------
// Markdown Formatter
// ---------------------------------------------------------------------------

export function formatMarkdownReport(
  results: DeckAnalysisResults,
  deck: DeckData
): string {
  const totalCards =
    deck.commanders.reduce((s, c) => s + c.quantity, 0) +
    deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
    deck.sideboard.reduce((s, c) => s + c.quantity, 0);

  const lines: string[] = [];

  lines.push(`# Deck Analysis: ${deck.name}`);
  lines.push("");

  if (deck.commanders.length > 0) {
    lines.push(
      `**Commander:** ${deck.commanders.map((c) => c.name).join(" & ")}`
    );
  }
  lines.push(`**Cards:** ${totalCards} | **Source:** ${deck.source}`);
  lines.push(
    `**Bracket:** ${results.bracketResult.bracket} (${results.bracketResult.bracketName}) | **Power Level:** ${results.powerLevel.powerLevel} (${results.powerLevel.bandLabel})`
  );
  lines.push("");

  // Mana Curve
  lines.push("## Mana Curve");
  lines.push("");
  lines.push(`Average CMC: ${results.manaBaseMetrics.averageCmc.toFixed(2)}`);
  lines.push("");
  lines.push("| CMC | Count |");
  lines.push("|-----|-------|");
  for (const bucket of results.manaCurve) {
    const total = bucket.permanents + bucket.nonPermanents;
    if (total > 0) {
      lines.push(`| ${bucket.cmc} | ${total} |`);
    }
  }
  lines.push("");

  // Color Distribution
  lines.push("## Color Distribution");
  lines.push("");
  lines.push("| Color | Sources | Pips |");
  lines.push("|-------|---------|------|");
  const colors = ["W", "U", "B", "R", "G"] as const;
  for (const c of colors) {
    const sources = results.colorDistribution.sources[c];
    const pips = results.colorDistribution.pips[c];
    if (sources > 0 || pips > 0) {
      lines.push(`| ${c} | ${sources} | ${pips} |`);
    }
  }
  lines.push("");

  // Land Base Efficiency
  lines.push("## Land Base Efficiency");
  lines.push("");
  lines.push(
    `**Overall:** ${results.landEfficiency.overallScore}/100 (${results.landEfficiency.scoreLabel})`
  );
  lines.push("");
  for (const factor of results.landEfficiency.factors) {
    lines.push(
      `- ${factor.name}: ${factor.score}/100 (weight: ${(factor.weight * 100).toFixed(0)}%)`
    );
  }
  lines.push("");

  // Synergy Themes
  if (results.synergyAnalysis.deckThemes.length > 0) {
    lines.push("## Synergy Themes");
    lines.push("");
    for (const theme of results.synergyAnalysis.deckThemes) {
      lines.push(
        `- **${theme.axisName}** — ${theme.cardCount} cards (strength: ${(theme.strength * 100).toFixed(0)}%)`
      );
    }
    lines.push("");
  }

  // Opening Hands
  lines.push("## Opening Hands");
  lines.push("");
  const { simulationStats } = results;
  lines.push(
    `**Keepable Rate:** ${Math.round(simulationStats.keepableRate * 100)}% | **Avg Lands:** ${simulationStats.avgLandsInOpener.toFixed(1)} | **Avg Score:** ${Math.round(simulationStats.avgScore)}`
  );
  lines.push(
    `**T1 Play:** ${Math.round(simulationStats.probT1Play * 100)}% | **T2:** ${Math.round(simulationStats.probT2Play * 100)}% | **T3:** ${Math.round(simulationStats.probT3Play * 100)}%`
  );
  lines.push("");
  const verdicts = simulationStats.verdictDistribution;
  lines.push("| Verdict | Count |");
  lines.push("|---------|-------|");
  for (const [verdict, count] of Object.entries(verdicts)) {
    lines.push(`| ${verdict} | ${count} |`);
  }
  lines.push("");

  // Known Combos
  if (results.synergyAnalysis.knownCombos.length > 0) {
    lines.push("## Known Combos");
    lines.push("");
    for (const combo of results.synergyAnalysis.knownCombos) {
      lines.push(`- ${combo.cards.join(" + ")}: ${combo.description}`);
    }
    lines.push("");
  }

  // Budget
  lines.push("## Budget");
  lines.push("");
  lines.push(`**Total Cost:** ${results.budgetAnalysis.totalCostFormatted}`);
  lines.push(
    `**Average per Card:** $${results.budgetAnalysis.averagePricePerCard.toFixed(2)}`
  );
  if (results.budgetAnalysis.mostExpensive.length > 0) {
    lines.push("");
    lines.push("**Most Expensive:**");
    for (const card of results.budgetAnalysis.mostExpensive.slice(0, 5)) {
      lines.push(`- ${card.name}: $${card.unitPrice.toFixed(2)}`);
    }
  }
  lines.push("");

  // Composition
  lines.push("## Composition");
  lines.push("");
  lines.push(
    `**Health:** ${results.compositionScorecard.overallHealth} — ${results.compositionScorecard.healthSummary}`
  );
  lines.push("");
  lines.push("| Category | Count | Target | Status |");
  lines.push("|----------|-------|--------|--------|");
  for (const cat of results.compositionScorecard.categories) {
    lines.push(
      `| ${cat.label} | ${cat.count} | ${cat.min}-${cat.max} | ${cat.status} |`
    );
  }
  lines.push("");

  // Mana Recommendations
  if (results.manaRecommendations.recommendations.length > 0) {
    lines.push("## Mana Recommendations");
    lines.push("");
    for (const rec of results.manaRecommendations.recommendations) {
      const icon =
        rec.severity === "critical"
          ? "🔴"
          : rec.severity === "warning"
            ? "🟡"
            : "🔵";
      lines.push(`${icon} **${rec.title}**: ${rec.explanation}`);
    }
    lines.push("");
  }

  lines.push(
    "---\n*Generated by MTG Deck Evaluator*"
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// JSON Formatter
// ---------------------------------------------------------------------------

export function formatJsonReport(
  results: DeckAnalysisResults,
  deck: DeckData
): string {
  const obj = {
    deckName: deck.name,
    commanders: deck.commanders.map((c) => c.name),
    source: deck.source,
    bracketResult: {
      bracket: results.bracketResult.bracket,
      bracketName: results.bracketResult.bracketName,
      cedhStapleOverlap: results.bracketResult.cedhStapleOverlap,
      comboSource: results.bracketResult.comboSource,
    },
    powerLevel: {
      powerLevel: results.powerLevel.powerLevel,
      rawScore: results.powerLevel.rawScore,
      bandLabel: results.powerLevel.bandLabel,
    },
    manaCurve: results.manaCurve.map((b) => ({
      cmc: b.cmc,
      permanents: b.permanents,
      nonPermanents: b.nonPermanents,
      total: b.permanents + b.nonPermanents,
    })),
    colorDistribution: {
      sources: results.colorDistribution.sources,
      pips: results.colorDistribution.pips,
      colorlessSources: results.colorDistribution.colorlessSources,
    },
    manaBaseMetrics: {
      landCount: results.manaBaseMetrics.landCount,
      totalCards: results.manaBaseMetrics.totalCards,
      averageCmc: results.manaBaseMetrics.averageCmc,
    },
    landEfficiency: {
      overallScore: results.landEfficiency.overallScore,
      scoreLabel: results.landEfficiency.scoreLabel,
      factors: results.landEfficiency.factors.map((f) => ({
        name: f.name,
        score: f.score,
        weight: f.weight,
      })),
    },
    budgetAnalysis: {
      totalCost: results.budgetAnalysis.totalCost,
      averagePricePerCard: results.budgetAnalysis.averagePricePerCard,
      medianPricePerCard: results.budgetAnalysis.medianPricePerCard,
      mostExpensive: results.budgetAnalysis.mostExpensive.slice(0, 10).map(
        (c) => ({ name: c.name, price: c.unitPrice })
      ),
    },
    openingHands: {
      keepableRate: results.simulationStats.keepableRate,
      avgLandsInOpener: results.simulationStats.avgLandsInOpener,
      avgScore: results.simulationStats.avgScore,
      probT1Play: results.simulationStats.probT1Play,
      probT2Play: results.simulationStats.probT2Play,
      probT3Play: results.simulationStats.probT3Play,
      verdictDistribution: results.simulationStats.verdictDistribution,
    },
    synergyThemes: results.synergyAnalysis.deckThemes.map((t) => ({
      axis: t.axisName,
      cardCount: t.cardCount,
      strength: t.strength,
    })),
    knownCombos: results.synergyAnalysis.knownCombos.map((c) => ({
      cards: c.cards,
      type: c.type,
      description: c.description,
    })),
    compositionHealth: {
      overallHealth: results.compositionScorecard.overallHealth,
      summary: results.compositionScorecard.healthSummary,
      categories: results.compositionScorecard.categories.map((c) => ({
        label: c.label,
        count: c.count,
        target: `${c.min}-${c.max}`,
        status: c.status,
      })),
    },
    manaRecommendations: results.manaRecommendations.recommendations.map(
      (r) => ({
        severity: r.severity,
        title: r.title,
        explanation: r.explanation,
      })
    ),
  };

  return JSON.stringify(obj, null, 2);
}

// ---------------------------------------------------------------------------
// Discord Formatter
// ---------------------------------------------------------------------------

export function formatDiscordReport(
  results: DeckAnalysisResults,
  deck: DeckData,
  enabledSections?: Set<string>,
  shareUrl?: string
): { text: string; charCount: number; included: string[]; excluded: string[] } {
  const enabled =
    enabledSections ??
    new Set(
      DISCORD_SECTIONS.filter((s) => s.enabledByDefault).map((s) => s.id)
    );

  return allocateDiscordSections(results, deck, enabled, 2000, shareUrl);
}
