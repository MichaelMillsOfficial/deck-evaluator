"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import type { DeckData } from "@/lib/types";
import {
  generateDeckId,
  type DeckSessionPayload,
} from "@/lib/deck-session";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import DeckInput from "@/components/DeckInput";
import styles from "./DeckImportSection.module.css";

function AlertIcon() {
  return (
    <svg
      className={styles.alertIcon}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface ImportFormState {
  loading: boolean;
  error: string | null;
}

type ImportFormAction =
  | { type: "START" }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

const initialState: ImportFormState = { loading: false, error: null };

function reducer(state: ImportFormState, action: ImportFormAction): ImportFormState {
  switch (action.type) {
    case "START":
      return { loading: true, error: null };
    case "ERROR":
      return { loading: false, error: action.error };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export default function DeckImportSection() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();
  const { setPayload } = useDeckSession();

  const handleImport = async (fetcher: () => Promise<Response>) => {
    dispatch({ type: "START" });

    try {
      const res = await fetcher();
      const json = await res.json();

      if (!res.ok) {
        dispatch({
          type: "ERROR",
          error: json.error ?? `Request failed with status ${res.status}`,
        });
        return;
      }

      const { warnings: w, ...deckFields } = json as DeckData & {
        warnings?: string[];
      };
      const deck = deckFields as DeckData;

      const payload: DeckSessionPayload = {
        deckId: generateDeckId(),
        deck,
        parseWarnings: w ?? [],
        cardMap: null,
        notFoundCount: 0,
        spellbookCombos: null,
        createdAt: Date.now(),
      };

      setPayload(payload);
      router.push("/ritual");
    } catch (err) {
      dispatch({
        type: "ERROR",
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again.",
      });
    }
  };

  const handleParseDeck = (text: string, commanders?: string[]) =>
    handleImport(() =>
      fetch("/api/deck-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...(commanders ? { commanders } : {}) }),
      })
    );

  /**
   * Called by DeckInput's Archidekt synopsis "Continue" action. The deck
   * has already been fetched inside DeckInput, so we just persist + route.
   */
  const handleConfirmArchidektDeck = (deck: DeckData, warnings: string[]) => {
    const payload: DeckSessionPayload = {
      deckId: generateDeckId(),
      deck,
      parseWarnings: warnings,
      cardMap: null,
      notFoundCount: 0,
      spellbookCombos: null,
      createdAt: Date.now(),
    };
    setPayload(payload);
    router.push("/ritual");
  };

  const { loading, error } = state;

  return (
    <div className={styles.layout}>
      <DeckInput
        onSubmitText={handleParseDeck}
        onConfirmArchidektDeck={handleConfirmArchidektDeck}
        loading={loading}
        mode="navigate"
      />

      {loading && (
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={styles.status}
        >
          Fetching deck...
        </p>
      )}

      {error && !loading && (
        <div role="alert" className={`${styles.alert} ${styles.alertError}`}>
          <div className={styles.alertContent}>
            <AlertIcon />
            <div className={styles.alertBody}>{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
