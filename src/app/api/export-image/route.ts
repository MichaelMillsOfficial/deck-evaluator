// ---------------------------------------------------------------------------
// POST /api/export-image
// Server-side PNG summary card generation via Satori + resvg-wasm
//
// Accepts analysis data as JSON in the request body and returns a PNG image.
// WASM is initialized once at module scope to avoid re-initialization overhead.
// ---------------------------------------------------------------------------

import type React from "react";
import { NextResponse } from "next/server";
import type { AnalysisSummaryCardProps } from "@/components/AnalysisSummaryCard";

// Lazy-loaded modules to avoid pulling satori/resvg into the client bundle
type SatoriModule = typeof import("satori");
type ResvgModule = typeof import("@resvg/resvg-wasm");

let satoriModule: SatoriModule | null = null;
let resvgModule: ResvgModule | null = null;

async function ensureModules() {
  if (!satoriModule) {
    satoriModule = await import("satori");
  }
  if (!resvgModule) {
    resvgModule = await import("@resvg/resvg-wasm");
  }
}

// Promise-based singleton to prevent WASM init race conditions
let wasmPromise: Promise<void> | null = null;

async function ensureWasm() {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const { initWasm } = resvgModule!;
      // Load the WASM binary from disk. fetch(import.meta.url) and
      // require.resolve are not supported in Next.js Turbopack, so we
      // resolve via process.cwd() + node_modules at runtime.
      const fs = await import("fs");
      const path = await import("path");
      const wasmPath = path.join(
        process.cwd(),
        "node_modules/@resvg/resvg-wasm/index_bg.wasm"
      );
      const wasmBuffer = fs.readFileSync(wasmPath);
      await initWasm(wasmBuffer);
    })();
  }
  return wasmPromise;
}

async function loadInterFont(weight: 400 | 700): Promise<ArrayBuffer> {
  // Fetch Inter font from Google Fonts at a stable URL.
  // Using v20 .ttf URLs (the versioned .woff URLs expire over time).
  const fontUrls: Record<number, string> = {
    400: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf",
    700: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
  };

  const response = await fetch(fontUrls[weight], {
    // Cache for 24 hours to avoid re-fetching on every request
    next: { revalidate: 86400 },
  } as RequestInit);

  if (!response.ok) {
    throw new Error(`Failed to load Inter ${weight} font: ${response.status}`);
  }
  return response.arrayBuffer();
}

function buildCardProps(data: Record<string, unknown>): AnalysisSummaryCardProps {
  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return {
    deckName: (data.deckName as string) ?? "Unknown Deck",
    commanders: (data.commanders as string[]) ?? [],
    cardCount: Number(data.cardCount) || 0,
    powerLevel: Number(data.powerLevel) || 0,
    bracket: Number(data.bracket) || 1,
    bracketName: (data.bracketName as string) ?? "",
    averageCmc: Number(data.averageCmc) || 0,
    keepableRate: Number(data.keepableRate) || 0,
    landEfficiencyScore: Number(data.landEfficiencyScore) || 0,
    themes: (data.themes as string[]) ?? [],
    combos: (data.combos as { cards: string[]; description: string }[]) ?? [],
    manaCurve: (data.manaCurve as { cmc: string; count: number }[]) ?? [],
    exportDate,
  };
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    // Ensure satori and resvg-wasm are loaded
    await ensureModules();
    await ensureWasm();

    const satori = satoriModule!.default ?? satoriModule;
    const { Resvg } = resvgModule!;

    // Load fonts (both weights in parallel)
    const [fontRegular, fontBold] = await Promise.all([
      loadInterFont(400),
      loadInterFont(700),
    ]);

    // Build the card props
    const cardProps = buildCardProps(body);

    // Import the JSX component (server-side only import)
    const { AnalysisSummaryCard } = await import("@/components/AnalysisSummaryCard");

    // Render JSX to SVG via Satori
    // Satori requires React.createElement calls — use the JSX pragma
    const { createElement } = await import("react");
    const element = createElement(AnalysisSummaryCard, cardProps);

    const svg = await satori(element, {
      width: 600,
      height: 450,
      fonts: [
        {
          name: "Inter",
          data: fontRegular,
          weight: 400,
          style: "normal",
        },
        {
          name: "Inter",
          data: fontBold,
          weight: 700,
          style: "normal",
        },
      ],
    });

    // Convert SVG to PNG via resvg
    const resvgInstance = new Resvg(svg, {
      fitTo: { mode: "width", value: 600 },
    });
    const pngData = resvgInstance.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="deck-analysis.png"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export-image] Error generating PNG:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate image",
      },
      { status: 500 }
    );
  }
}
