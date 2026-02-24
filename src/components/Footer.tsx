export default function Footer() {
  const gitTag = process.env.NEXT_PUBLIC_GIT_TAG ?? "unknown";
  const releaseVersion = process.env.NEXT_PUBLIC_RELEASE_VERSION ?? “v0.0.1a";

  return (
    <footer className="border-t border-slate-700 bg-slate-900/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
        <span className="font-mono text-slate-500">{gitTag}</span>
        <span className="text-slate-400">
          Release:{" "}
          <span className="font-semibold">{releaseVersion}</span>
        </span>
        <a
          href="https://github.com/MichaelMillsOfficial/deck-evaluator/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300"
        >
          Release Notes
        </a>
      </div>
    </footer>
  );
}
