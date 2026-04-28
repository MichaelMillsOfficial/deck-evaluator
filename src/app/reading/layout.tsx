"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDeckSession } from "@/contexts/DeckSessionContext";

export default function ReadingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydration } = useDeckSession();
  const router = useRouter();

  useEffect(() => {
    if (hydration === "absent") {
      router.replace("/");
    }
  }, [hydration, router]);

  // While hydration is pending the SessionProvider has not yet read sessionStorage,
  // so we render nothing rather than flash a "no deck" state.
  if (hydration !== "hydrated") return null;

  return <>{children}</>;
}
