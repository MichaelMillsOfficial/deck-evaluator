"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/compare"
        aria-current={pathname === "/compare" ? "page" : undefined}
        className="rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 aria-[current=page]:text-purple-400 motion-reduce:transition-none"
      >
        Compare Decks
      </Link>
    </div>
  );
}
