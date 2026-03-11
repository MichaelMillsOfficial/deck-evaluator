import type { Metadata } from "next";
import ComparePageClient from "./ComparePageClient";

export const metadata: Metadata = {
  title: "Compare Decks",
  description:
    "Compare two Magic: The Gathering decklists side by side. See card overlap, mana curve differences, tag composition, and key metrics.",
};

export default function ComparePage() {
  return (
    <main>
      <ComparePageClient />
    </main>
  );
}
