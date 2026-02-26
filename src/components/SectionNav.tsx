"use client";

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
      className="mb-4 flex flex-wrap gap-2"
    >
      {sections.map((section) => {
        const isExpanded = expandedSections.has(section.id);
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => handleClick(section.id)}
            data-testid={`section-nav-${section.id}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${
              isExpanded
                ? "border-purple-500 bg-purple-900/30 text-purple-300"
                : "border-slate-600 bg-slate-800 text-slate-400 hover:border-purple-500 hover:text-slate-200"
            }`}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
