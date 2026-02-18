# Passwordless Authentication Plan

## Context

The Deck Evaluator currently has zero auth and zero database. We need user login so users can persist their decks and preferences. The hard requirement is **no password option whatsoever** — only passwordless methods (social login, magic links, passkeys, etc.).

## Current State

- **Next.js 16.1.6** with App Router, TypeScript, Tailwind CSS
- No auth library, no database, no session management
- Stateless API routes that call external MTG APIs

---

## Options Evaluated

| | Auth.js + Google OAuth | Raw Google OAuth | Descope | Clerk | Supabase Auth |
|---|---|---|---|---|---|
| **Free MAU limit** | Unlimited | Unlimited | 7,500 | 10,000 | 50,000 |
| **Google OAuth** | Yes | Yes | Yes | Yes | Yes |
| **Magic Links** | Yes (needs DB + email) | No | Yes | Yes | Yes |
| **Passkeys** | Experimental | No | Yes (production) | Yes | Partial |
| **DB required for auth** | No (JWT mode) | DIY | No | No | Bundled Postgres |
| **Next.js integration** | Low | High | Low | Very Low | Moderate |
| **Vendor lock-in** | None (OSS) | None | Yes | Yes | Moderate |
| **Cost at scale** | $0 forever | $0 forever | $249/mo after 7.5K | $25/mo after 10K | $25/mo after 50K |

### Why not the others?

- **Raw Google OAuth:** Same end result but 10x more code, DIY session management, DIY CSRF — all things Auth.js handles out of the box.
- **Descope:** 7,500 MAU cap is the lowest, $249/mo Pro tier is expensive, adds vendor dependency for something Auth.js does natively.
- **Clerk:** Great DX but adds vendor lock-in and a $25/mo cost after 10K MAUs for something that's free with Auth.js. Worth considering if we later want magic links + passkeys with zero effort.
- **Supabase Auth:** Good free tier (50K MAUs) but couples auth to their platform. Better suited if we also choose Supabase for the database layer.

---

## Chosen Approach: Auth.js (NextAuth v5) with Google OAuth

Zero cost at any scale, no vendor lock-in, no database required for the auth layer, and the simplest path to "Google sign-in only, no passwords."

### What we get

- Google OAuth as the sole sign-in method (no password surface exists)
- JWT-based sessions stored in encrypted HttpOnly cookies (no DB needed for auth)
- Server-side session access in API routes and server components
- Middleware-based route protection

### Database strategy (separate from auth)

Auth.js in JWT mode needs **no database**. To store user-specific data (saved decks, preferences), a lightweight DB will be needed in a future phase. Top candidates:

- **Supabase Postgres** (free tier: 500MB, 2 projects) — recommended
- **Neon Postgres** (free tier: 0.5GB, 1 project)

The user table would store the Google `sub` (subject ID) and profile info from the JWT, created on first login. This is a future task — auth works without it.

### Environment variables needed

```
AUTH_SECRET=<generated-secret>
AUTH_GOOGLE_ID=<from-google-cloud-console>
AUTH_GOOGLE_SECRET=<from-google-cloud-console>
```

---

## Implementation Tasks

- [ ] **Task 1: Install Auth.js dependency**
  - Run `npm install next-auth@beta`
  - Verify it appears in `package.json`

- [ ] **Task 2: Create Auth.js configuration**
  - Create `src/auth.ts` with Google provider and JWT session strategy
  - Configure callbacks for session and JWT if needed
  - Export `auth`, `handlers`, `signIn`, `signOut`

- [ ] **Task 3: Create Auth.js API route handler**
  - Create `src/app/api/auth/[...nextauth]/route.ts`
  - Export GET and POST handlers from `src/auth.ts`

- [ ] **Task 4: Create auth middleware**
  - Create `src/middleware.ts` to protect routes that require login
  - Configure `matcher` to exclude public routes (home page, API health, static assets)

- [ ] **Task 5: Add SessionProvider to root layout**
  - Modify `src/app/layout.tsx` to wrap children with `<SessionProvider>`
  - Ensure it works with the App Router (client component boundary)

- [ ] **Task 6: Create AuthButton component**
  - Create `src/components/AuthButton.tsx`
  - Show "Sign in with Google" button when unauthenticated
  - Show Google avatar, user name, and "Sign out" button when authenticated
  - Follow the existing design system (dark theme, purple accents)

- [ ] **Task 7: Integrate AuthButton into navigation**
  - Modify `src/app/layout.tsx` or `src/app/page.tsx` to add AuthButton to the nav bar

- [ ] **Task 8: Create environment variable template**
  - Create `.env.local.example` with placeholder values for `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - Ensure `.env.local` is in `.gitignore`

- [ ] **Task 9: Update Docker configuration**
  - Update `Dockerfile` and/or `docker-compose.yml` to pass auth environment variables
  - Ensure `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` are available at runtime

- [ ] **Task 10: Verification**
  - Run `npm run build` — no type errors
  - Run `npm run dev` and verify Google OAuth flow end-to-end
  - Confirm no password input exists anywhere in the UI
  - Confirm protected routes redirect to sign-in when unauthenticated
  - Confirm nav bar shows avatar/name after sign-in

---

## Files to Create/Modify

| File | Action |
|---|---|
| `src/auth.ts` | Create — Auth.js config with Google provider |
| `src/app/api/auth/[...nextauth]/route.ts` | Create — Auth.js API route handler |
| `src/middleware.ts` | Create — Route protection middleware |
| `src/app/layout.tsx` | Modify — Add SessionProvider wrapper |
| `src/components/AuthButton.tsx` | Create — Sign in / Sign out / avatar UI |
| `src/app/page.tsx` | Modify — Show auth state in nav (if needed) |
| `.env.local.example` | Create — Environment variable template |
| `package.json` | Modify — Add next-auth dependency |
| `Dockerfile` / `docker-compose.yml` | Modify — Pass auth env vars |
