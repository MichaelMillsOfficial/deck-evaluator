import DeckImportSection from "@/components/DeckImportSection";

const features = [
  "Mana curve and color distribution analysis",
  "Land base efficiency scoring",
  "Card synergy and interaction mapping",
  "Opening hand simulation and mulligan testing",
  "Format-specific deck validation",
  "Performance metrics and win-rate estimation",
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="w-full max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
            <span className="block">Magic: The Gathering</span>
            <span className="block">Deck Evaluator</span>
          </h1>
          <p className="mt-4 text-xl text-slate-300">
            Import your deck and analyze its performance, mana base efficiency,
            and test it under various scenarios
          </p>
        </div>

        <DeckImportSection />

        {/* Features section */}
        <section
          aria-labelledby="features-heading"
          className="mt-12 rounded-xl border border-slate-700 bg-slate-800/50 p-6"
        >
          <h2
            id="features-heading"
            className="mb-4 text-lg font-semibold text-white"
          >
            Features
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-sm text-slate-300"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-purple-500"
                />
                {feature}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
