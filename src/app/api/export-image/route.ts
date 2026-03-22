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
interface SatoriModule {
  default: (element: React.ReactElement, options: Record<string, unknown>) => Promise<string>;
}

interface ResvgModule {
  initWasm: (wasm: ArrayBuffer) => Promise<void>;
  Resvg: new (svg: string, options: Record<string, unknown>) => {
    render: () => { asPng: () => Uint8Array };
  };
}

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
      const { initWasm } = resvgModule;
      // resvg-wasm needs the WASM binary — fetch it from the bundled location
      const wasmUrl = new URL(
        "@resvg/resvg-wasm/index_bg.wasm",
        import.meta.url
      );
      const wasmResponse = await fetch(wasmUrl.toString());
      const wasmBuffer = await wasmResponse.arrayBuffer();
      await initWasm(wasmBuffer);
    })();
  }
  return wasmPromise;
}

async function loadInterFont(): Promise<ArrayBuffer> {
  // Fetch Inter font from Google Fonts at a stable URL
  // This is cached at the edge / server level after first call
  const fontUrl =
    "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff";

  const response = await fetch(fontUrl, {
    // Cache for 24 hours to avoid re-fetching on every request
    next: { revalidate: 86400 },
  } as RequestInit);

  if (!response.ok) {
    throw new Error(`Failed to load Inter font: ${response.status}`);
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

    // Load font
    const fontBuffer = await loadInterFont();

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
          data: fontBuffer,
          weight: 400,
          style: "normal",
        },
        {
          name: "Inter",
          data: fontBuffer,
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

    return new Response(pngBuffer, {
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
