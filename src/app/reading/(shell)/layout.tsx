import DeckReadingShell from "@/components/reading/DeckReadingShell";

/**
 * Layout for every /reading/* sub-route. Wraps the page in DeckReadingShell
 * which provides the persistent sidebar (desktop), drawer (mobile), top
 * bar (mobile), enrichment alerts, and the Discord export modal. The
 * `(shell)` route group keeps the URL structure flat — pages render at
 * /reading/cards, /reading/composition, etc., not /reading/(shell)/cards.
 */
export default function ReadingShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DeckReadingShell>{children}</DeckReadingShell>;
}
