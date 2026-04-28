"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DeckSessionProvider, useDeckSession } from "@/contexts/DeckSessionContext";

function ReadingHydrationGate({ children }: { children: React.ReactNode }) {
  const { hydration } = useDeckSession();
  const router = useRouter();

  useEffect(() => {
    if (hydration === "absent") {
      router.replace("/");
    }
  }, [hydration, router]);

  // While hydration is pending the SessionProvider has not yet read sessionStorage,
  // so we render nothing rather than flash a "no deck" state. The provider's
  // useEffect resolves on the very next tick, so this is invisible in practice.
  if (hydration !== "hydrated") return null;

  return <>{children}</>;
}

export default function ReadingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DeckSessionProvider>
      <ReadingHydrationGate>{children}</ReadingHydrationGate>
    </DeckSessionProvider>
  );
}
