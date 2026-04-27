// ---------------------------------------------------------------------------
// Client-side PNG export helper
// Calls the server-side /api/export-image route to generate a PNG summary card
// and triggers a browser download.
// ---------------------------------------------------------------------------

export interface ExportImageData {
  deckName: string;
  commanders: string[];
  cardCount: number;
  powerLevel: number;
  bracket: number;
  bracketName: string;
  averageCmc: number;
  keepableRate: number;
  landEfficiencyScore: number;
  themes: string[];
  combos: { cards: string[]; description: string }[];
  manaCurve: { cmc: string; count: number }[];
}

/**
 * Generate a PNG summary card via the server-side API and trigger a download.
 * Throws an error if image generation fails.
 */
export async function generateAndDownloadPng(data: ExportImageData): Promise<void> {
  const response = await fetch("/api/export-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let message = "Image generation failed";
    try {
      const json = await response.json();
      if (typeof json?.error === "string") {
        message = json.error;
      }
    } catch {
      // ignore parse errors — use default message
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(data.deckName)}-analysis.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build ExportImageData from DeckAnalysisResults for use with generateAndDownloadPng.
 */
export function buildExportImageData(
  deckName: string,
  commanders: string[],
  cardCount: number,
  results: {
    powerLevel: { powerLevel: number };
    bracketResult: { bracket: number; bracketName: string };
    manaBaseMetrics: { averageCmc: number };
    simulationStats: { keepableRate: number };
    landEfficiency: { overallScore: number };
    synergyAnalysis: {
      deckThemes: { axisName: string }[];
      knownCombos: { cards: string[]; description: string }[];
    };
    manaCurve: { cmc: string; permanents: number; nonPermanents: number }[];
  }
): ExportImageData {
  return {
    deckName,
    commanders,
    cardCount,
    powerLevel: results.powerLevel.powerLevel,
    bracket: results.bracketResult.bracket,
    bracketName: results.bracketResult.bracketName,
    averageCmc: results.manaBaseMetrics.averageCmc,
    keepableRate: Math.round(results.simulationStats.keepableRate * 100),
    landEfficiencyScore: results.landEfficiency.overallScore,
    themes: results.synergyAnalysis.deckThemes.slice(0, 5).map((t) => t.axisName),
    combos: results.synergyAnalysis.knownCombos.map((c) => ({
      cards: c.cards,
      description: c.description,
    })),
    manaCurve: results.manaCurve
      .map((b) => ({
        cmc: b.cmc,
        count: b.permanents + b.nonPermanents,
      }))
      .filter((b) => b.count > 0),
  };
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "deck";
}
