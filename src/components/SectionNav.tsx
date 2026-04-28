"use client";

import styles from "./SectionNav.module.css";

interface SectionNavProps {
  sections: readonly { id: string; label: string }[];
  expandedSections: Set<string>;
  onSelectSection: (id: string) => void;
}

export default function SectionNav({
  sections,
  expandedSections,
  onSelectSection,
}: SectionNavProps) {
  function handleClick(id: string) {
    const wasExpanded = expandedSections.has(id);
    onSelectSection(id);

    // Only scroll when expanding, not when collapsing
    if (!wasExpanded) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`panel-${id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  return (
    <nav
      aria-label="Section navigation"
      data-testid="section-nav"
      className={styles.nav}
    >
      {sections.map((section) => {
        const isExpanded = expandedSections.has(section.id);
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => handleClick(section.id)}
            data-testid={`section-nav-${section.id}`}
            className={[styles.pill, isExpanded && styles.pillActive]
              .filter(Boolean)
              .join(" ")}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
