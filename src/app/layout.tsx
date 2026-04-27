import type { Metadata } from "next";
import { Inter, Spectral, JetBrains_Mono } from "next/font/google";
import Footer from "@/components/Footer";
import { CosmosBackground, TopNav } from "@/components/shell";
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
        <CosmosBackground />
        <TopNav />
        <div className="relative z-10 flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
