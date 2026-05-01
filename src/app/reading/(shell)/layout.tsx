import DeckReadingShell from "@/components/reading/DeckReadingShell";
import { PendingChangesProvider } from "@/contexts/PendingChangesContext";

/**
 * Layout for every /reading/* sub-route. Wraps the page in DeckReadingShell
 * which provides the persistent sidebar, drawer, top bar, and enrichment
 * alerts. PendingChangesProvider lives here so both candidate state (from
 * /reading/add) and pairing state survive navigation to other tabs, including
 * /reading/compare.
 *
 * The `(shell)` route group keeps the URL structure flat — pages render at
 * /reading/cards, /reading/composition, etc., not /reading/(shell)/cards.
 */
export default function ReadingShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PendingChangesProvider>
      <DeckReadingShell>{children}</DeckReadingShell>
    </PendingChangesProvider>
  );
}
