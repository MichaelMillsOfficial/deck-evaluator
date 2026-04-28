export type ViewTab =
  | "list"
  | "analysis"
  | "synergy"
  | "hands"
  | "additions"
  | "interactions"
  | "suggestions"
  | "goldfish"
  | "compare"
  | "share";

export interface NavCategory {
  id: string;
  label: string;
  items: ViewTab[];
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "deck",
    label: "Deck",
    items: ["list", "analysis"],
  },
  {
    id: "mechanics",
    label: "Mechanics",
    items: ["synergy", "interactions"],
  },
  {
    id: "simulations",
    label: "Simulations",
    items: ["hands", "goldfish"],
  },
  {
    id: "studio",
    label: "Studio",
    items: ["additions", "suggestions", "compare", "share"],
  },
];

/** Which tabs require enrichment to be enabled */
export const ENRICHMENT_REQUIRED_TABS = new Set<ViewTab>([
  "analysis",
  "synergy",
  "hands",
  "interactions",
  "suggestions",
  "goldfish",
  "share",
]);

export const ALL_TABS: { key: ViewTab; label: string; badge?: string }[] = [
  { key: "list", label: "Deck List" },
  { key: "analysis", label: "Analysis" },
  { key: "synergy", label: "Synergy" },
  { key: "hands", label: "Hands" },
  { key: "additions", label: "Additions" },
  { key: "interactions", label: "Interactions", badge: "BETA" },
  { key: "suggestions", label: "Suggestions" },
  { key: "goldfish", label: "Goldfish", badge: "BETA" },
  { key: "compare", label: "Compare" },
  { key: "share", label: "Share" },
];

/**
 * Map each view-tab slug to its real /reading/* sub-route. Phase 4 turned
 * the prior single-page tab state into URL navigation; the sidebar's
 * NavButtons are now Links to these paths.
 */
export const TAB_ROUTES: Record<ViewTab, string> = {
  list: "/reading/cards",
  analysis: "/reading/composition",
  synergy: "/reading/synergy",
  interactions: "/reading/interactions",
  hands: "/reading/hands",
  additions: "/reading/add",
  goldfish: "/reading/goldfish",
  suggestions: "/reading/suggestions",
  compare: "/reading/compare",
  share: "/reading/share",
};

/** Inverse of TAB_ROUTES — derive the active tab from a pathname. */
export function tabFromPathname(pathname: string): ViewTab | null {
  for (const [tab, route] of Object.entries(TAB_ROUTES) as [ViewTab, string][]) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return tab;
    }
  }
  return null;
}

/**
 * Editorial reading order for the chapter-footer prev/next links.
 * Walks the user through: see the cards → understand the shape →
 * study the mechanics → simulate play → tune → share.
 */
export const READING_ORDER: ViewTab[] = [
  "list",
  "analysis",
  "synergy",
  "interactions",
  "hands",
  "goldfish",
  "additions",
  "suggestions",
  "compare",
  "share",
];

export interface ReadingNeighbor {
  tab: ViewTab;
  label: string;
  route: string;
}

/**
 * Resolve the previous and next chapters for a given tab in editorial
 * reading order. Returns null at the boundaries.
 */
export function readingNeighbors(tab: ViewTab): {
  prev: ReadingNeighbor | null;
  next: ReadingNeighbor | null;
} {
  const idx = READING_ORDER.indexOf(tab);
  const prevTab = idx > 0 ? READING_ORDER[idx - 1] : null;
  const nextTab =
    idx >= 0 && idx < READING_ORDER.length - 1
      ? READING_ORDER[idx + 1]
      : null;
  const toNeighbor = (t: ViewTab): ReadingNeighbor => {
    const def = ALL_TABS.find((x) => x.key === t)!;
    return { tab: t, label: def.label, route: TAB_ROUTES[t] };
  };
  return {
    prev: prevTab ? toNeighbor(prevTab) : null,
    next: nextTab ? toNeighbor(nextTab) : null,
  };
}
