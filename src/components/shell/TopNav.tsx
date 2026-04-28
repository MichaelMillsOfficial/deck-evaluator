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
            <path
              d="M12 2l2.09 6.26L20.18 9.27l-5.09 3.9L16.18 19.27 12 15.77l-4.18 3.5 1.09-6.1-5.09-3.9 6.09-1.01z"
              fill="url(#brand-grad)"
            />
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
