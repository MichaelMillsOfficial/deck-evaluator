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
    items: ["list"],
  },
  {
    id: "insights",
    label: "Insights",
    items: ["analysis", "synergy", "interactions"],
  },
  {
    id: "tools",
    label: "Tools",
    items: ["hands", "additions", "goldfish"],
  },
  {
    id: "actions",
    label: "Actions",
    items: ["suggestions", "compare", "share"],
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
