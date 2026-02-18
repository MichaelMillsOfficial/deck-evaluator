# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magic: The Gathering Deck Evaluator — a Next.js (TypeScript) web app for importing, parsing, and analyzing MTG decklists. Features a dark-themed UI with purple accents, 3-tab deck import (Manual / Moxfield / Archidekt), and a features roadmap section.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Production build
npm run start      # Run production server
npm run lint       # Run ESLint
npm test           # Run tests (once a test framework is configured)
```

### Docker

The app is containerized with a multi-stage Dockerfile (`node:20-alpine`, standalone output). Use docker-compose for local or production runs:

```bash
docker compose up              # Build & start (foreground, logs visible)
docker compose up -d           # Build & start (detached/background)
docker compose up --build      # Force rebuild after code changes
docker compose down            # Stop and remove containers
docker compose logs -f         # Tail logs from running container
```

The app is served on port **3000** (`http://localhost:3000`).

## Architecture

```
src/
├── app/
│   ├── globals.css          # Dark slate theme, Tailwind CSS
│   ├── layout.tsx           # Root layout with nav bar (sparkle icon + branding)
│   ├── page.tsx             # Home page: header, DeckInput, features section
│   └── api/
│       ├── deck/route.ts    # GET — fetch deck by Archidekt URL
│       └── deck-parse/route.ts  # POST — parse pasted decklist text
├── components/
│   ├── DeckInput.tsx        # 3-tab import form (Manual/Moxfield/Archidekt)
│   └── DeckList.tsx         # Renders parsed deck (commanders, mainboard, sideboard)
└── lib/
    ├── types.ts             # DeckData, DeckCard, API response types
    ├── archidekt.ts         # Archidekt API client + card normalization
    ├── moxfield.ts          # Moxfield API types (fetch support TBD)
    ├── scryfall.ts          # Scryfall API helpers
    └── decklist-parser.ts   # Text-based decklist parser
```

### Data Flow

1. **URL import** (`/api/deck`): Accepts an Archidekt URL → extracts deck ID → fetches from Archidekt API → normalizes to `DeckData`
2. **Text import** (`/api/deck-parse`): Accepts raw decklist text → parses via `decklist-parser.ts` → returns `DeckData`
3. All three UI tabs (Manual, Moxfield, Archidekt) currently route through the text parser; direct Moxfield API fetching is not yet implemented

### Key Types

- `DeckCard` — `{ name: string; quantity: number }`
- `DeckData` — `{ name, source, url, commanders[], mainboard[], sideboard[] }`
- Source can be `"moxfield" | "archidekt" | "text"`

### Design System

- Dark theme: slate gradient background (`from-slate-950 via-slate-900 to-slate-800`)
- Purple accent for primary actions (`bg-purple-600`)
- Card panels: `bg-slate-800/50 border-slate-700 rounded-xl`
- Tab bar: `bg-slate-900` with `bg-slate-600` active state
- Text: `text-white` headings, `text-slate-300` body, `text-slate-400` secondary
