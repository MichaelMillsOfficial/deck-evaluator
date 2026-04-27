import type { Metadata } from "next";
import { Inter, Spectral, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import Footer from "@/components/Footer";
import NavLinks from "@/components/NavLinks";
import "./globals.css";
import "../../design-system/tokens.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const spectral = Spectral({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
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
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${spectral.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased">
        <nav
          aria-label="Main navigation"
          className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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

            <NavLinks />
          </div>
        </nav>
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
