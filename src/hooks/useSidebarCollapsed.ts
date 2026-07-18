"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "deck-sidebar-collapsed";

/** In-memory fallback so toggling still works when localStorage throws. */
let memoryValue = false;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // Keep multiple tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    // localStorage not available
  }
  return memoryValue;
}

function getServerSnapshot(): boolean {
  // Server renders expanded to avoid layout shift before hydration.
  return false;
}

/**
 * Reads/writes the sidebar collapsed state from localStorage.
 * Backed by useSyncExternalStore so the value is read synchronously on the
 * client render (no setState-in-effect) and stays in sync across tabs.
 */
export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setCollapsed = useCallback((v: boolean) => {
    memoryValue = v;
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      // localStorage not available
    }
    emit();
  }, []);

  return [collapsed, setCollapsed];
}
