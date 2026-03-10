"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "deck-sidebar-collapsed";

/**
 * Reads/writes the sidebar collapsed state from localStorage.
 * Hydrates after mount to avoid SSR mismatch.
 */
export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") {
        setCollapsedState(true);
      }
    } catch {
      // localStorage not available
    }
    setHydrated(true);
  }, []);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      // localStorage not available
    }
  };

  // Before hydration, always show expanded to avoid layout shift
  return [hydrated ? collapsed : false, setCollapsed];
}
