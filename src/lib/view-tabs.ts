export type ViewTab = "list" | "analysis" | "synergy" | "hands" | "additions" | "interactions" | "suggestions" | "goldfish";

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
    items: ["suggestions"],
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
];
