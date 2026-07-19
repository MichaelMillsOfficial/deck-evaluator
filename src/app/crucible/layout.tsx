import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CrucibleSessionProvider } from "@/contexts/CrucibleSessionContext";

export const metadata: Metadata = {
  title: "The Crucible · MTG Deck Evaluator",
  description:
    "Pour in any pile of cards and refine it down to a legal 100-card Commander deck.",
};

export default function CrucibleLayout({ children }: { children: ReactNode }) {
  return <CrucibleSessionProvider>{children}</CrucibleSessionProvider>;
}
