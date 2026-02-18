import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "MTG Deck Evaluator",
  description: "Magic: The Gathering deck analysis tool",
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
        <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-6 w-6 text-purple-400"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l2.09 6.26L20.18 9.27l-5.09 3.9L16.18 19.27 12 15.77l-4.18 3.5 1.09-6.1-5.09-3.9 6.09-1.01z" />
              </svg>
              <span className="text-lg font-bold text-white">
                MTG Deck Evaluator
              </span>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
