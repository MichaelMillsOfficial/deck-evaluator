import DeckReadingShell from "@/components/reading/DeckReadingShell";
import { CandidatesProvider } from "@/contexts/CandidatesContext";

/**
 * Layout for every /reading/* sub-route. Wraps the page in DeckReadingShell
 * which provides the persistent sidebar, drawer, top bar, and enrichment
 * alerts. The CandidatesProvider lives here so candidate state added on
 * /reading/add survives navigation to other tabs.
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
    <CandidatesProvider>
      <DeckReadingShell>{children}</DeckReadingShell>
    </CandidatesProvider>
  );
}
