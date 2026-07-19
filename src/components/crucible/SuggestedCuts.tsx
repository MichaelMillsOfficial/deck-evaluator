"use client";

import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { Tag } from "@/components/ui";
import styles from "./crucible.module.css";

const MAX_SHOWN = 15;

export default function SuggestedCuts() {
  const { payload, cutSuggestions, setStatus, dismissSuggestion } = useCrucibleSession();

  if (!payload) return null;

  const shown = cutSuggestions.slice(0, MAX_SHOWN);

  return (
    <section
      data-testid="crucible-suggested-cuts"
      aria-label="Suggested cuts"
      className={styles.panel}
    >
      <h2 className={styles.panelTitle}>Suggested Cuts</h2>
      <p className={styles.panelMuted}>
        Ranked by reason — nothing is cut without your click.
      </p>
      {payload.commanders.length === 0 ? (
        <p className={styles.panelMuted}>
          Choose a commander to unlock off-identity suggestions.
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className={styles.panelMuted}>No cuts to suggest right now.</p>
      ) : (
        <ul className={styles.suggestionList}>
          {shown.map((suggestion) => (
            <li key={suggestion.name} className={styles.suggestionRow}>
              <span className={styles.suggestionName}>{suggestion.name}</span>
              <span className={styles.suggestionReasons}>
                {suggestion.reasons.map((reason) => (
                  <Tag key={reason} variant="watch">
                    {reason}
                  </Tag>
                ))}
              </span>
              <span className={styles.suggestionActions}>
                <button
                  type="button"
                  className={styles.comboAction}
                  aria-label={`Cut ${suggestion.name}`}
                  onClick={() => setStatus(suggestion.name, "cut")}
                >
                  Cut {suggestion.name}
                </button>
                <button
                  type="button"
                  className={styles.suggestionDismiss}
                  aria-label={`Dismiss ${suggestion.name}`}
                  onClick={() => dismissSuggestion(suggestion.name)}
                >
                  –
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {cutSuggestions.length > MAX_SHOWN ? (
        <p className={styles.panelMuted}>
          {cutSuggestions.length - MAX_SHOWN} more suggestions below the fold — act on
          these first.
        </p>
      ) : null}
    </section>
  );
}
