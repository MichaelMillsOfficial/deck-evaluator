"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopNav.module.css";

type Tab = { href: string; label: string };

const TABS: Tab[] = [{ href: "/compare", label: "Compare Decks" }];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="MTG Deck Evaluator · Home">
          <svg
            className={styles.brandIcon}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            data-testid="brand-icon"
          >
            <defs>
              <linearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--violet-400)" />
                <stop offset="100%" stopColor="var(--aura-400)" />
              </linearGradient>
            </defs>
            {/* Outer tilted orbit */}
            <ellipse
              cx="12"
              cy="12"
              rx="9.5"
              ry="4.4"
              transform="rotate(18 12 12)"
              fill="none"
              stroke="url(#brand-grad)"
              strokeWidth="0.7"
              opacity="0.55"
            />
            {/* Inner counter-tilted orbit */}
            <ellipse
              cx="12"
              cy="12"
              rx="6"
              ry="2.8"
              transform="rotate(-25 12 12)"
              fill="none"
              stroke="url(#brand-grad)"
              strokeWidth="0.85"
              opacity="0.75"
            />
            {/* Central star outline (5-pointed) */}
            <path
              d="M12 8 L12.94 10.71 L15.80 10.76 L13.52 12.49 L14.35 15.24 L12 13.6 L9.65 15.24 L10.48 12.49 L8.20 10.76 L11.06 10.71 Z"
              fill="none"
              stroke="url(#brand-grad)"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            {/* Planets — one per orbit */}
            <circle cx="17" cy="11.5" r="1.0" fill="url(#brand-grad)" />
            <circle cx="6" cy="7" r="0.85" fill="url(#brand-grad)" />
          </svg>
          <span className={styles.brandWordmark} data-testid="brand-wordmark">
            MTG Deck Evaluator
          </span>
        </Link>

        <div className={styles.tabs}>
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={styles.tab}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className={styles.meta} data-testid="nav-meta">
          <span className={styles.metaDate} aria-hidden="true">
            DECK · READING
          </span>
        </div>
      </div>
    </nav>
  );
}
