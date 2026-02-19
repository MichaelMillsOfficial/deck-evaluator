"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
      <p className="mt-2 text-slate-400">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        Try again
      </button>
    </div>
  );
}
