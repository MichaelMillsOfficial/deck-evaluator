"use client";

import { useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";
import type { ViewTab } from "@/lib/view-tabs";
import {
  NAV_CATEGORIES,
  ALL_TABS,
  ENRICHMENT_REQUIRED_TABS,
  TAB_ROUTES,
  tabFromPathname,
} from "@/lib/view-tabs";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import styles from "./DeckSidebar.module.css";

// ---------------------------------------------------------------------------
// Inline SVG icons (Heroicons outline 20x20)
// ---------------------------------------------------------------------------

function IconList() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h12.5M3.75 10h12.5m-12.5 3.25h12.5" />
    </svg>
  );
}

function IconChartBar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V17m4-6v6m4-9.5v9.5m4-13v13" />
    </svg>
  );
}

function IconPuzzle() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function IconHand() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 013.15 0V15M6.9 7.575a1.575 1.575 0 10-3.15 0v8.175a6.75 6.75 0 006.75 6.75h2.018a5.25 5.25 0 003.712-1.538l1.732-1.732a5.25 5.25 0 001.538-3.712l.003-2.024a.668.668 0 01.198-.471 1.575 1.575 0 10-2.228-2.228 3.818 3.818 0 00-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0116.35 15m.002 0h-.002" />
    </svg>
  );
}

function IconPlusCircle() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconArrowsRightLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
    </svg>
  );
}

function IconBeaker() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.014.846a1.5 1.5 0 01-1.922.043L14 14M5 14.5l1.014.846a1.5 1.5 0 001.922.043L10 14" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l7.5-7.5-7.5-7.5" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tab icon map
// ---------------------------------------------------------------------------

function IconScales() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 3v14M4 7l3-3 3 3M16 7l-3-3-3 3M3 17h6M11 17h6M5 14a3 3 0 003-3H2a3 3 0 003 3zm10 0a3 3 0 003-3h-6a3 3 0 003 3z" />
    </svg>
  );
}

function IconShareNode() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5a2.5 2.5 0 11.7 1.7L7.5 11.4a2.5 2.5 0 010 .8l8.2 4.7A2.5 2.5 0 1115 15.5l-8-4.6a2.5 2.5 0 110-3.5l8-4.6c.07-.4.16-.6.3-.8z" />
    </svg>
  );
}

const TAB_ICONS: Record<ViewTab, React.ReactNode> = {
  list: <IconList />,
  analysis: <IconChartBar />,
  synergy: <IconPuzzle />,
  interactions: <IconBolt />,
  hands: <IconHand />,
  additions: <IconPlusCircle />,
  suggestions: <IconArrowsRightLeft />,
  goldfish: <IconBeaker />,
  compare: <IconScales />,
  share: <IconShareNode />,
};

// ---------------------------------------------------------------------------
// Enrichment status indicator
// ---------------------------------------------------------------------------

function EnrichmentStatus({
  enrichLoading,
  cardMap,
  enrichError,
}: {
  enrichLoading: boolean;
  cardMap: Record<string, EnrichedCard> | null;
  enrichError: string | null;
}) {
  if (enrichLoading) {
    return (
      <span
        className={`${styles.enrichmentStatus} ${styles.enrichmentLoading}`}
        title="Loading card details..."
      >
        <svg className={styles.enrichmentSpinner} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
          <path fill="currentColor" opacity="0.85" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="sr-only">Loading card details</span>
      </span>
    );
  }
  if (!enrichLoading && cardMap && !enrichError) {
    return (
      <span
        className={`${styles.enrichmentStatus} ${styles.enrichmentOk}`}
        title="Card details loaded"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
        <span className="sr-only">Card details loaded</span>
      </span>
    );
  }
  if (!enrichLoading && enrichError) {
    return (
      <span
        className={`${styles.enrichmentStatus} ${styles.enrichmentError}`}
        title="Card enrichment error"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span className="sr-only">Card enrichment error</span>
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Nav button
// ---------------------------------------------------------------------------

/**
 * Sidebar nav entry. After Phase 4 each tab maps to a real /reading/* route;
 * the link renders as `<Link>` so navigation is soft (provider stays mounted).
 *
 * When the tab is disabled (e.g. enrichment-required tab before enrichment
 * completes), we render a non-interactive button-shaped element instead so
 * a click still does nothing. role="tab" + aria-selected mirror the tablist
 * semantics expected by existing tests.
 */
function NavButton({
  tabKey,
  label,
  badge,
  isActive,
  isDisabled,
  collapsed,
  onAfterClick,
  onKeyDown,
}: {
  tabKey: ViewTab;
  label: string;
  badge?: string;
  isActive: boolean;
  isDisabled: boolean;
  collapsed: boolean;
  /** Optional hook fired after a successful click — used to close the mobile drawer. */
  onAfterClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
}) {
  const icon = TAB_ICONS[tabKey];
  const route = TAB_ROUTES[tabKey];

  const classes = [
    styles.navButton,
    isActive && styles.navButtonActive,
    collapsed && styles.navButtonCollapsed,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = collapsed ? (
    <span className={styles.navIcon}>{icon}</span>
  ) : (
    <span className={styles.navLabel}>
      {label}
      {badge && <span className={styles.navBadge}>{badge}</span>}
    </span>
  );

  if (isDisabled) {
    return (
      <button
        id={`tab-deck-${tabKey}`}
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-deck-${tabKey}`}
        tabIndex={isActive ? 0 : -1}
        type="button"
        disabled
        onKeyDown={onKeyDown}
        title={collapsed ? label : undefined}
        className={classes}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      id={`tab-deck-${tabKey}`}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-deck-${tabKey}`}
      tabIndex={isActive ? 0 : -1}
      href={route}
      onClick={onAfterClick}
      onKeyDown={onKeyDown}
      title={collapsed ? label : undefined}
      className={classes}
    >
      {inner}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar inner content (shared between desktop and drawer)
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
  enrichError: string | null;
  analysisResults: DeckAnalysisResults | null;
  onNewReading?: () => void;
  collapsed: boolean;
  onClose?: () => void;
}

function SidebarContent({
  deck,
  cardMap,
  enrichLoading,
  enrichError,
  analysisResults,
  onNewReading,
  collapsed,
  onClose,
}: SidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab: ViewTab = tabFromPathname(pathname ?? "") ?? "list";

  const analysisDisabled = !cardMap || enrichLoading;

  // Flat ordered list of all tabs for keyboard navigation
  const allTabKeys = ALL_TABS.map((t) => t.key);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const currentIndex = allTabKeys.indexOf(activeTab);
      let newIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        newIndex = (currentIndex + 1) % allTabKeys.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        newIndex = (currentIndex - 1 + allTabKeys.length) % allTabKeys.length;
      } else if (e.key === "Home") {
        newIndex = 0;
      } else if (e.key === "End") {
        newIndex = allTabKeys.length - 1;
      } else {
        return;
      }

      e.preventDefault();

      // Skip disabled tabs
      let nextIndex = newIndex;
      for (let attempts = 0; attempts < allTabKeys.length; attempts++) {
        const target = allTabKeys[nextIndex];
        const isDisabled = ENRICHMENT_REQUIRED_TABS.has(target) && analysisDisabled;
        if (!isDisabled) break;
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Home") {
          nextIndex = (nextIndex + 1) % allTabKeys.length;
        } else {
          nextIndex = (nextIndex - 1 + allTabKeys.length) % allTabKeys.length;
        }
      }

      const nextTab = allTabKeys[nextIndex];
      router.push(TAB_ROUTES[nextTab]);
      const nextButton = document.getElementById(`tab-deck-${nextTab}`);
      nextButton?.focus();
    },
    [activeTab, allTabKeys, analysisDisabled, router]
  );

  const totalCards =
    deck.commanders.reduce((s, c) => s + c.quantity, 0) +
    deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
    deck.sideboard.reduce((s, c) => s + c.quantity, 0);

  const commanderNames = deck.commanders.map((c) => c.name);

  // Tab clicks are now Link navigations; only fire onClose to dismiss the
  // mobile drawer after the user picks a destination.
  const handleAfterNavClick = () => {
    onClose?.();
  };

  return (
    <div className={styles.content}>
      {/* Deck identity — manuscript margin: serif title, italic commander, mono meta. */}
      {!collapsed && (
        <div className={styles.identity}>
          <div className={styles.identityHeader}>
            <div className={styles.identityMain}>
              <h2 className={styles.deckTitle} title={deck.name}>
                {deck.name}
              </h2>
              {commanderNames.length > 0 && (
                <p className={styles.commanderText} title={commanderNames.join(" & ")}>
                  {commanderNames.join(" & ")}
                </p>
              )}
              <div className={styles.metaRow}>
                <span>
                  via{" "}
                  {deck.url ? (
                    <a
                      href={deck.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.metaLink}
                    >
                      {deck.source}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className={styles.metaLink}>{deck.source}</span>
                  )}
                </span>
                <span>·</span>
                <span>{totalCards} cards</span>
              </div>
            </div>
            <div className={styles.identityActions}>
              <EnrichmentStatus
                enrichLoading={enrichLoading}
                cardMap={cardMap}
                enrichError={enrichError}
              />
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className={styles.closeButton}
                  aria-label="Close navigation"
                >
                  <IconX />
                </button>
              )}
            </div>
          </div>
          {/* Bracket/power retained as a quiet anchor for tests + at-a-glance verdict. */}
          {analysisResults && (
            <span data-testid="bracket-power-badge" className={styles.bracketBadge}>
              B{analysisResults.bracketResult.bracket} · PL
              {analysisResults.powerLevel.powerLevel}
            </span>
          )}
        </div>
      )}

      {/* Collapsed: show enrichment icon only */}
      {collapsed && (
        <div className={styles.collapsedStatusRow}>
          <EnrichmentStatus
            enrichLoading={enrichLoading}
            cardMap={cardMap}
            enrichError={enrichError}
          />
        </div>
      )}

      {/* Manuscript margin index — chapter headings + text-only nav. */}
      <nav
        role="tablist"
        aria-label="Deck view"
        className={[styles.nav, collapsed && styles.navCollapsed]
          .filter(Boolean)
          .join(" ")}
      >
        {NAV_CATEGORIES.map((category) => (
          <div key={category.id} className={styles.category}>
            {!collapsed && (
              <h3 className={styles.categoryHeading}>{category.label}</h3>
            )}
            <div
              className={[
                styles.categoryGroup,
                collapsed && styles.categoryGroupCollapsed,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {category.items.map((tabKey) => {
                const tabDef = ALL_TABS.find((t) => t.key === tabKey)!;
                const isDisabled =
                  ENRICHMENT_REQUIRED_TABS.has(tabKey) && analysisDisabled;
                return (
                  <NavButton
                    key={tabKey}
                    tabKey={tabKey}
                    label={tabDef.label}
                    badge={tabDef.badge}
                    isActive={activeTab === tabKey}
                    isDisabled={isDisabled}
                    collapsed={collapsed}
                    onAfterClick={handleAfterNavClick}
                    onKeyDown={handleTabKeyDown}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {onNewReading && (
        <div className={styles.newReadingSection}>
          <button
            type="button"
            data-testid="new-reading-button"
            onClick={onNewReading}
            className={[
              styles.newReadingButton,
              collapsed && styles.newReadingButtonCollapsed,
            ]
              .filter(Boolean)
              .join(" ")}
            title={collapsed ? "New reading" : undefined}
            aria-label={collapsed ? "New reading" : undefined}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={styles.newReadingIcon}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h12M10 4v12" />
            </svg>
            <span className={styles.newReadingLabel}>New Reading</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop sidebar
// ---------------------------------------------------------------------------

export interface DeckSidebarProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
  enrichError: string | null;
  analysisResults: DeckAnalysisResults | null;
  onNewReading?: () => void;
}

export function DeckSidebar({
  deck,
  cardMap,
  enrichLoading,
  enrichError,
  analysisResults,
  onNewReading,
}: DeckSidebarProps) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <div
      data-testid="deck-header"
      style={{ width: collapsed ? 52 : 240 }}
      className={styles.sidebar}
    >
      <SidebarContent
        deck={deck}
        cardMap={cardMap}
        enrichLoading={enrichLoading}
        enrichError={enrichError}
        analysisResults={analysisResults}
        onNewReading={onNewReading}
        collapsed={collapsed}
      />

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className={[
          styles.collapseToggle,
          collapsed && styles.collapseToggleCollapsed,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        {!collapsed && <span className={styles.collapseLabel}>Collapse</span>}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile drawer
// ---------------------------------------------------------------------------

export interface DeckDrawerProps extends DeckSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function DeckDrawer({
  open,
  onClose,
  deck,
  cardMap,
  enrichLoading,
  enrichError,
  analysisResults,
  onNewReading,
}: DeckDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, open);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div
      className={[styles.drawer, open ? styles.drawerOpen : styles.drawerClosed]
        .filter(Boolean)
        .join(" ")}
      aria-modal="true"
      role="dialog"
      aria-label="Navigation"
    >
      {/* Overlay */}
      <div
        className={styles.drawerOverlay}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div ref={drawerRef} className={styles.drawerPanel}>
        {open && (
          <SidebarContent
            deck={deck}
            cardMap={cardMap}
            enrichLoading={enrichLoading}
            enrichError={enrichError}
            analysisResults={analysisResults}
            onNewReading={onNewReading}
            collapsed={false}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
