# MTG Deck Evaluator

A web application for importing, parsing, and analyzing Magic: The Gathering decklists. Built with Next.js and TypeScript.

## Features

- **3-tab deck import** — Manual entry, Moxfield export paste, Archidekt export paste
- **Archidekt URL import** — Fetch decks directly via Archidekt API
- **Text-based decklist parsing** — Supports common decklist formats with commander detection
- **Dark-themed UI** — Slate gradient background with purple accents

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker compose up
```

Open [http://localhost:3000](http://localhost:3000). Use `docker compose up --build` to rebuild after code changes.

## Project Structure

```
src/
├── app/
│   ├── globals.css              # Dark slate theme, Tailwind CSS
│   ├── layout.tsx               # Root layout with navigation bar
│   ├── page.tsx                 # Home page: header, deck input, features section
│   └── api/
│       ├── deck/route.ts        # GET — fetch deck by Archidekt URL
│       └── deck-parse/route.ts  # POST — parse pasted decklist text
├── components/
│   ├── DeckInput.tsx            # 3-tab import form (Manual/Moxfield/Archidekt)
│   └── DeckList.tsx             # Renders parsed deck by section
└── lib/
    ├── types.ts                 # DeckData, DeckCard, API response types
    ├── archidekt.ts             # Archidekt API client + card normalization
    ├── moxfield.ts              # Moxfield API types
    ├── scryfall.ts              # Scryfall API helpers
    └── decklist-parser.ts       # Text-based decklist parser
```

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **Language** — TypeScript
- **Styling** — Tailwind CSS 4
- **Runtime** — Node.js 20 (Alpine in Docker)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
