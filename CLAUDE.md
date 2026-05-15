# CLAUDE.md

Quick orientation for Claude (or any future contributor) editing this repo.

## What this is

A Eurovision second-screen companion app. Multi-room voting, scoreboard, bonus bets, chat, bingo, now-playing, trivia, commentator. All real-time. Mobile-first. LT default, EN available.

Stack: Next.js 16 (App Router, typed routes) + React 19 + Tailwind v4 (CSS-first, no config file) + motion/react + Supabase (Postgres + Realtime) on Vercel.

Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the deep dive.

## Writing rules

- **No em dashes (`—`) anywhere in user-facing strings.** Period. They land as a Claude-fingerprint and read clunky in LT. Use a comma, a period, or rephrase. (Comments, doc-block prose, commit messages, and PR bodies stay free to use them — and they're better off for it.)

## Brand conventions

1. **Brand language is non-negotiable.** Every country chip is a `<HeartFlag/>`; every primary CTA is `bg-white text-dark-blue rounded-2xl` inside a `rainbow-border`; every list row is `bg-white/[0.04] ring-1 ring-white/8 rounded-2xl`. New surfaces echo this language.

2. **Hearts beat; everything else doesn't.** `@keyframes heartbeat` in `globals.css` is the single source of truth — `.heartbeat`, `.heartbeat-loop`, `.heartbeat-focus`. Don't invent a new pulse.

3. **Icon tiles are squircles.** The `.uzk-icon-squircle` utility (`border-radius: 100px; corner-shape: squircle;` with `-webkit-` prefix) renders Apple-style continuous-curve corners on supporting browsers and falls back to a full circle on the rest. Use it on every 8–12px icon-tile (admin section headers, host link rows, notification toggles, bet-chip marquees, etc.) instead of `rounded-xl`.

4. **Bingo emoji rule: never a country flag, always a literal noun.** Even when a trope text is *about* a country ("UK finishes bottom five (again)"), the leading emoji must be an object, symbol, or action — `🥶`, `🎶`, `🪦` — never `🇬🇧` / `🇫🇷` / etc. Microsoft Fluent doesn't ship 3D country flags, so a flag-led trope falls back to a flat OS emoji and breaks the 3D matrix on the card.

5. **LT is the only country-flag URL override.** `lib/fluent-emoji.ts` carries a `url` field for `🇱🇹` pointing at our hand-rendered Fluent-style PNG. Used where Lithuania is part of brand identity (presence-bar idle eyebrow, home bet-chips marquee). Don't add more country overrides — and the bingo rule above still applies (LT included).

## State + realtime model

- **Dual store, one-way flow.** Writes go to Supabase Postgres. Server broadcasts a hint event over Supabase Realtime. Clients refetch the relevant slice. Don't bundle durable data in broadcast payloads — except chat:new, which carries the full message row to avoid a follow-up GET.

- **Broadcast events are `<feature>:<verb>`.** Documented in `lib/realtime.tsx`. New event? Extend the union, add a note in the doc block.

- **Helpers in `lib/chat-system.ts` return `Promise<boolean>`.** They swallow internal errors (DB + Supabase) by design — "best-effort, never break the action that triggered them" — but they return false on failure so callers (the admin broadcast route, the trivia route) can surface real "did this land" diagnostics to the admin instead of silently lying.

- **Server-side delay via `meta.firesAt`.** When a chat message needs to land later than its `createdAt` (commentator bot waits for the now-playing takeover to finish, future trivia delays), the server stamps an ISO timestamp into `meta.firesAt`. The client's chat:new handler reads it and schedules a `setTimeout` append instead of inserting immediately. Late arrivals (firesAt already past, e.g. after a reload) fall through and append now.

## Layout patterns that bite

- **No transforms on the page wrapper.** `PageTransition` is opacity-only. Any ancestor transform breaks `position: fixed` for every drawer in the app.

- **BottomSheet is portaled to `document.body`.** Defends against the above. Don't undo this.

- **`.glass-card` does NOT set `position: relative`.** Callers that need a positioning context add `relative` themselves. The class carries only the surface (bg + border + blur + shadow).

- **Padding-inside-max-width.** Use `<div max-w-3xl mx-auto px-4>` (padding lives INSIDE the max-width box). The chat panel had its `px-4` on the outer `<main>` for a while, which made chat content 32px wider than home widgets on lg+. Don't repeat that.

- **Bottom-stacking lists need `mt-auto`, not `justify-end`.** Chat-style "stack at the bottom of the scroll area when underfilled, scroll naturally when overfull" is `<div overflow-y-auto flex flex-col><ul mt-auto>...</ul></div>`. `justify-content: flex-end` on the scroll container looks the same but locks `scrollTop` on iOS Safari when content overflows — old messages become unreachable.

- **Use `inert` on hidden tab panes.** Tabs stay mounted with `display: none` for instant switching, but their `<input>` elements are still discoverable by iOS Safari's form-input scanner — which then renders the `‹ › ✓` multi-input keyboard accessory bar on top of UNRELATED single-input screens. `inert={!show}` on `TabPane` (and `inert={!active}` on the chat panel's `<main>`) removes hidden subtrees from focus + AX trees so iOS only counts the active tab's inputs.

- **`flex-1` doesn't fill its parent if the parent has no height.** Inner divs inside `<main style={{height: ...}}>` need to actually inherit that height — either via the default `align-items: stretch` (cross-axis on a flex row) or by an explicit `h-full` / `flex-1`. The chat panel relies on stretch; if you nest a non-stretching wrapper between, the panel collapses to content height and leaves a gap above the dock.

## Animation patterns

- **Animate transforms / opacity / mask-image. Not layout.** Don't animate `width` / `height` / `padding` — they trigger layout reflow. Use transform-based motion. Exception: short FLIP-style `layout` transitions in motion/react are OK when they map to compositor properties.

- **`overflow: hidden` on a `motion.div` clips outset rings.** If you've added a `height: 0 → auto` motion to reveal a child with `ring-1`, the wrapper's clip rect eats the 1px ring (rings are outset box-shadows, live outside the element's border box). Drop the height tween, animate opacity + a small `y` offset instead — the parent flex layout absorbs the natural height immediately, the ring shows.

- **`Date.now()` in render is a smell.** Even when only used in an effect predicate (`fresh = Date.now() - parsed < TTL`), put it behind `useState(() => ...)` so it's evaluated once on mount and stays stable across re-renders.

## Hydration

- **Never read `localStorage` (or any browser-only state) in `useState`'s lazy initialiser.** Server returns `null`, client returns the stored value, JSX diverges, React tears the subtree. Initialise state as `null` and load in a post-mount `useEffect`. If a downstream effect needs the loaded value to make a decision, make that effect depend on the state and re-run on the change (see `lib/use-fire-once-when.ts` and `components/admin-trivia-scheduler.tsx` for the canonical patterns).

## iOS / PWA

- **Don't auto-send on `onBlur`.** "Blur with no `relatedTarget`" catches tab switches, app backgrounding, and any programmatic blur — not just iOS Done. The chat composer has a visible Send pill (appears when input has text) and the iOS keyboard's Send key (handled via `enterKeyHint="send"` + `onKeyDown` Enter). Tapping iOS Done dismisses the keyboard and leaves the draft in the composer. Don't reintroduce blur-based sending.

- **Bump the service worker `CACHE` version whenever a real bug fix ships.** PWAs are cache-first on static assets via `public/sw.js`. Old JS bundles can serve stale code after a deploy until the SW activates with a new cache name and the `activate` handler wipes the old cache. Find `const CACHE = "esc-2026-vN"` in `public/sw.js` and increment N.

- **iOS safe-area is asymmetric.** `env(safe-area-inset-top)` (~60px with dynamic island) is meaningfully larger than `env(safe-area-inset-bottom)` (~34px home indicator). A naive `justify-center pt-safe-top pb-safe-bottom` on `h-dvh` lands its content visibly above geometric centre. For small decorative blocks (loader, splash), use plain `justify-center` without safe-area padding. For real content that mustn't clip system chrome, accept the asymmetry or compensate with custom CSS.

## i18n

- **Every user-facing string goes through `t()`** from `lib/i18n.ts`. If you're typing English into JSX, you're doing it wrong.
- **Function-form keys for templated strings.** `pick_n_more: { en: (n) => ..., lt: (n) => ... }`. Plain strings with `{0}`-style placeholders DON'T interpolate — `t()`'s type system enforces this.
- **Locale-aware quote glyphs.** LT uses `„low-9 + left-open"` (U+201E + U+201C); EN uses curly `"…"` (U+201C + U+201D). See the home Highlights hero / drawer for the pattern.

## Admin chrome

- **Admin pages stay English.** Voter-facing surfaces use `t(lang, key)`. Admin uses literal English strings by design.

- **Admin pages share one chrome.** Every `/admin/*` page opens with `<AdminPageTitle>Title</AdminPageTitle>` (`components/admin-page-title.tsx`) — a large gradient `<h1>`, no icon. The nav tabs (`components/admin-nav.tsx`) carry icons (Live → `Radio`, Rooms → `Vote`, Trivia → `Lightbulb`, MC → `Mic`, Results → `Trophy`, Settings → `Settings`); the page title doesn't repeat them. Card-section headers inside a page do keep the `h-10 w-10` flamingo-tinted icon-tile pattern (with `.uzk-icon-squircle`).

## Schema changes — no migration files

This is a small project; we don't keep a migration ledger.

1. Edit `lib/db/schema.ts` so the Drizzle types match the new shape.
2. Hand the user a copy-pasteable SQL snippet (CREATE TABLE / ALTER TABLE / etc.) in your reply. They paste it into the Supabase SQL editor themselves.
3. Do NOT create a file under `drizzle/`. Do NOT run `drizzle-kit generate` or `drizzle-kit migrate`. The `drizzle/` folder is historical only.

## Useful scripts

```bash
pnpm dev         # local dev server
pnpm typecheck   # tsc --noEmit
pnpm build       # production build (Vercel runs this)
```

## Where things live

| Want to add… | Edit |
|---|---|
| A new country chip surface | `components/flag.tsx` (`<HeartFlag/>`) |
| A new bonus bet | `lib/scoring.ts` + `components/bonus-bets-form.tsx` + DB column + i18n keys |
| A new admin surface | `app/admin/(authed)/<name>/page.tsx` (open with `<AdminPageTitle/>`) + maybe a tab in `components/admin-nav.tsx` |
| A new admin broadcast | `app/api/admin/broadcast/route.ts` (kind union + dispatch) + `components/admin-live-controls.tsx` (SHOTS list) + a card in `components/chat-broadcast-cards.tsx` + i18n keys |
| A new translation | `lib/i18n.ts` (both `en` and `lt`) |
| A new broadcast event | `lib/realtime.tsx` (union) + emit + listen |
| A new bottom-sheet | `<BottomSheet/>` from `components/ui/bottom-sheet.tsx` |
| A new tab | `components/room-tab-bar.tsx` (TABS array) + `components/room-shell.tsx` (TabPane) + the panel component |

## Things to think about before writing code

- **Where does the heart live in this surface?** If you can't answer, pause.
- **Does this need DB durability or is broadcast enough?** Chat/votes/bets = durable. Reactions/floating emoji = ephemeral.
- **Mobile first.** Test on a 390×844 viewport before desktop.
- **Inert the things that need to disappear.** Use `inert` on hidden tab panes, not `aria-hidden` or tabindex tricks.
- **Bingo tropes (`lib/bingo-tropes.ts`) ↔ Fluent emoji manifest.** When you add or change a trope emoji, also map it in `lib/fluent-emoji.ts` so the 3D PNG renders consistently across the bingo card, list view, and home banner.

## Things to avoid

- ❌ `tailwind.config.js`. Tailwind v4 is CSS-first; everything lives in `globals.css` `@theme`.
- ❌ Lucide icons as stroke-only when they should be filled (Heart, Flame, Star, Sparkles — set `fill="currentColor"`).
- ❌ Animating `width` / `height` / `padding`. Use transform-based motion.
- ❌ Hard-coded country lists. Always derive from `lib/countries.ts`.
- ❌ Coupling chat/bingo/now-playing to ESC-specific scoring. The room model is reusable; the scoring is contest-specific.
- ❌ Adding new packages without checking the bundle impact.
- ❌ `localStorage` in `useState(() => ...)`. Hydration mismatch.
- ❌ Auto-send on `onBlur`. Use an explicit Send affordance.
- ❌ `justify-end` on a scroll container with overflow. Use `mt-auto` on the child.
- ❌ Reading the model identifier from training and including it in commits / PRs / code comments.
