import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Magic: The Gathering Deck Evaluator",
    template: "%s | MTG Deck Evaluator",
  },
  description:
    "Import and analyze your Magic: The Gathering decklists. Evaluate mana curves, color distribution, and deck performance.",
  openGraph: {
    title: "Magic: The Gathering Deck Evaluator",
    description: "Import and analyze your MTG decklists",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav
          aria-label="Main navigation"
          className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm"
        >
          <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <svg
                className="h-6 w-6 text-purple-400"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12 2l2.09 6.26L20.18 9.27l-5.09 3.9L16.18 19.27 12 15.77l-4.18 3.5 1.09-6.1-5.09-3.9 6.09-1.01z" />
              </svg>
              <span className="text-lg font-bold text-white">
                MTG Deck Evaluator
              </span>
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
