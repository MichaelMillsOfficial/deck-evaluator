"use client";

import { useState } from "react";

interface ZoneDisclosureProps {
  label: string;
  count: number;
  cards: string[];
  color: string;
  testId: string;
}

export default function ZoneDisclosure({
  label,
  count,
  cards,
  color,
  testId,
}: ZoneDisclosureProps) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-400"
        aria-expanded={open}
      >
        <span
          className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span>
          {label}{" "}
          <span className={color}>({count})</span>
        </span>
      </button>
      {open && (
        <ul className="space-y-1">
          {cards.map((card, i) => (
            <li
              key={i}
              className="rounded bg-slate-900/50 px-2 py-1 text-slate-400"
            >
              {card}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
