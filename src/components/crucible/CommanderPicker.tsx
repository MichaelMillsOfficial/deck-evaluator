"use client";

import { useMemo, useRef, useState } from "react";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { isLegalCommander, canPairCommanders } from "@/lib/commander-validation";
import { Button, Input, Popover, Tag } from "@/components/ui";
import ManaSymbol from "@/components/ManaSymbol";
import styles from "./crucible.module.css";

export default function CommanderPicker() {
  const { payload, cardMap, setCommanders } = useCrucibleSession();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const anchorRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(() => {
    if (!payload || !cardMap) return [];
    return payload.pool
      .filter((card) => {
        if (payload.commanders.includes(card.name)) return false;
        const enriched = cardMap[card.name];
        return enriched ? isLegalCommander(enriched) : false;
      })
      .map((card) => card.name);
  }, [payload, cardMap]);

  const partnerCandidates = useMemo(() => {
    if (!payload || !cardMap || payload.commanders.length !== 1) return [];
    const chosen = cardMap[payload.commanders[0]];
    if (!chosen) return [];
    return payload.pool
      .filter((card) => {
        if (payload.commanders.includes(card.name)) return false;
        const enriched = cardMap[card.name];
        return enriched ? canPairCommanders(chosen, enriched) : false;
      })
      .map((card) => card.name);
  }, [payload, cardMap]);

  if (!payload) return null;

  const commanders = payload.commanders;
  const options = commanders.length === 0 ? candidates : partnerCandidates;
  const query = filter.trim().toLowerCase();
  const filtered = query
    ? options.filter((name) => name.toLowerCase().includes(query))
    : options;

  const close = () => {
    setOpen(false);
    setFilter("");
  };

  const choose = (name: string) => {
    setCommanders([...commanders, name]);
    close();
  };

  const trigger =
    commanders.length === 0 ? (
      candidates.length === 0 ? (
        <Tag variant="watch">No legal commanders in the pile</Tag>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
        >
          Choose from {candidates.length}{" "}
          {candidates.length === 1 ? "candidate" : "candidates"}
          <span className={styles.commanderCaret} aria-hidden="true">
            ▾
          </span>
        </Button>
      )
    ) : commanders.length === 1 && partnerCandidates.length > 0 ? (
      <Button
        variant="ghost"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Add a partner
        <span className={styles.commanderCaret} aria-hidden="true">
          ▾
        </span>
      </Button>
    ) : null;

  return (
    <div
      ref={anchorRef}
      data-testid="crucible-commander-picker"
      className={styles.commanderPicker}
    >
      <span className={styles.commanderEyebrow}>
        {commanders.length === 2
          ? "Commanders"
          : commanders.length === 1
            ? "Commander"
            : "Command zone"}
      </span>
      <span className={styles.commanderRow}>
        {commanders.map((name) => (
          <span key={name} className={styles.commanderName}>
            {name}
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${name}`}
              onClick={() => setCommanders(commanders.filter((n) => n !== name))}
            >
              Remove
            </Button>
          </span>
        ))}
        {trigger}
      </span>
      <Popover
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        ariaLabel={commanders.length === 0 ? "Choose a commander" : "Add a partner"}
        data-testid="crucible-commander-popover"
      >
        <div className={styles.commanderFilter}>
          <Input
            aria-label="Filter commander candidates"
            placeholder="Filter legendaries…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <ul className={styles.commanderOptions}>
          {filtered.map((name) => (
            <li key={name}>
              <button
                type="button"
                className={styles.commanderOption}
                aria-label={`Choose ${name}`}
                onClick={() => choose(name)}
              >
                <span className={styles.commanderOptionPips} aria-hidden="true">
                  {(cardMap?.[name]?.colorIdentity ?? []).map((color) => (
                    <ManaSymbol key={color} symbol={color} size="sm" />
                  ))}
                </span>
                <span className={styles.commanderOptionName}>{name}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className={styles.commanderNoMatch}>
              No candidates match &ldquo;{filter.trim()}&rdquo;
            </li>
          ) : null}
        </ul>
      </Popover>
    </div>
  );
}
