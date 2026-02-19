import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-white">404</h1>
      <p className="mt-2 text-slate-400">Page not found</p>
      <Link
        href="/"
        className="mt-4 rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        Go home
      </Link>
    </div>
  );
}
