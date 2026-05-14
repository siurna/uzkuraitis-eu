# Architecture

A Eurovision 2026 second-screen party app. Multi-room voting + bonus-bet scoring + chat + bingo + now-playing, real-time via Liveblocks, durable via Supabase Postgres.

Mobile-first. Lithuanian by default; English available. The visual identity is the official ESC 2026 heart-mark; every list row, country chip, and loading state echoes that shape.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next 16 (App Router, typed routes, RSC where possible) |
| Style | Tailwind v4 (CSS-first `@theme`, no `tailwind.config.js`) |
| DB | Supabase Postgres (via pgbouncer transaction pooler) via Drizzle ORM |
| Real-time | Liveblocks (presence + broadcast events) |
| Animation | `motion/react` (framer-motion successor) |
| Drag/drop | `@dnd-kit` |
| Auth (admin) | WebAuthn passkeys via `@simplewebauthn` + iron-session |
| Auth (host) | Per-room `adminToken` baked into a magic share-link |
| Image opt | Next/Image with `unoptimized` for heart-flag SVGs (already vector) |
| Hosting | Vercel |

No state library (React state + context is enough). No Redux/Zustand.

---

## Data model (Supabase Postgres)

```
rooms                  one row per voting room
  id, code (6-char), name, admin_token,
  voting_enabled, tally_enabled,
  home_country_code, now_playing_code,
  created_at, last_active_at

voters                 one row per (room, browser-session)
  id, room_id, session_id, name,
  home_country_prediction,
  bet_* columns (one per bonus bet)

votes                  10 rows per voter (points 12,10,8…1 → country)
  voter_id, points, country_code

reactions              per-country emoji tallies (admin view)
  room_id, country_code, emoji, count

room_settings          k/v overrides per room (currently unused, kept)

admin_credentials      WebAuthn passkey records for the global admin
official_results       contest truth: placement → country
official_facts         contest truth: jury winner, televote winner, etc.
room_results / room_facts   per-room overrides for the above (async parties)

chat_messages          (planned) durable chat, broadcast on insert
chat_reactions         (planned) hold-to-react on a message
push_subscriptions     (planned) Web Push endpoint + prefs jsonb
```

Every long-lived thing is in Supabase Postgres. Liveblocks carries presence + ephemeral broadcasts only.

---

## Real-time

Two stores, one direction:

1. **Server writes to Supabase Postgres** (durable).
2. **Server broadcasts a hint event over Liveblocks** (`scores:updated`, `chat:new`, …).
3. **Clients listen for the hint, refetch the relevant slice of Postgres.**

This is why we don't put chat messages in Liveblocks Storage despite the temptation: persistence + history + moderation belong in the DB. Broadcasts just say "something changed, look again."

### Broadcast event union

Defined in `lib/liveblocks.ts`. Naming convention: `<feature>:<verb>`.

```
reaction:emoji        client → room    (emoji float, spawn particle)
reaction:country      client → room    (country-specific emoji burst)
scores:updated        server → room    (refetch /scores)
leaderboard:updated   server → room    (refetch /leaderboard)
room:updated          server → room    (refetch /api/rooms/[code])

// Planned, follow the same shape:
chat:new              server → room    (refetch /chat)
chat:react            server → room    (refetch /chat — or just patch one msg)
bingo:strike          client → room    (broadcast cross-out, render a reaction)
now-playing:change    server → room    (refetch room + trigger heart swarm)
```

When listeners need state, they refetch via `cache: "no-store"`. We never embed full state in broadcasts — they're hints, not payload.

---

## Auth

Two flows, deliberately separate:

| Audience | Mechanism | Where |
|---|---|---|
| Global admin (you) | WebAuthn passkey, iron-session cookie | `/admin/*` |
| Per-room host | `adminToken` UUID embedded in magic-link `?key=…` | `/r/[code]/manage` |
| Voter | Anonymous `session_id` in localStorage | `/r/[code]` |

The host flow is intentionally low-friction: no signup, no email, just the link. The global admin flow is high-trust (passkey-only) since it nukes rooms and reveals official results.

---

## Routing

```
/                       Join screen (RoomGate)
/?room=ABCDEF           Pre-filled join
/?leave=1               Clears LAST_ROOM_KEY, then renders gate

/r/[code]               Room (standings, leaderboard, sticky CTA)
/r/[code]/vote          Vote form (ballot + bonus bets)
/r/[code]/manage        Magic-link admin (host)

/admin                  Admin room list
/admin/rooms/[code]     Admin room detail (tabbed: Overview/Voters/Settings/Danger)
/admin/results          Official results + facts editor
/admin/settings         Passkeys panel
/admin/login            WebAuthn login
```

Planned tab shell will move the room into:
```
/r/[code]               (Home — standings + leaderboard)
/r/[code]/chat          (Chat)
/r/[code]/bingo         (Bingo)
/r/[code]/vote          (Vote — already exists)
```
Layout in `app/r/[code]/layout.tsx` owns the tab bar + now-playing strip + room context + particle layer.

---

## Component organisation

```
components/
  ui/                     Shared primitives (Bottom-sheet, Button, Input, Tabs)
  page-transition.tsx     Top-level fade between routes (opacity-only!)

  flag.tsx                <Flag/> + <HeartFlag/> + <MetaPill/>
                          The brand atom. Heart-clipped flag SVGs from
                          eurovision.com. EVERY country chip in the app
                          renders through this.

  avatar-picker.tsx       Grid of 42 iconic ESC acts. pulseSelected
                          heartbeat hook for the gate.
  name-gate.tsx           Two-step bottom-sheet welcome (name → avatar).
  settings-modal.tsx      Edit identity + share + leave. Avatar section
                          opens a nested picker bottom-sheet.

  room-shell.tsx          Room layout (will become app/r/[code]/layout.tsx
                          when tabs land).
  presence-bar.tsx        Top header: heart-mark + avatar tile.
  standings.tsx           Live scoreboard.
  leaderboard.tsx         Per-voter bonus-bet leaderboard.
  honeycomb-presence.tsx  Bottom-left presence hex grid (Home-tab only
                          after tabs land).
  floating-reactions.tsx  Emoji reactions bar + the floating particles.
                          (Heart-fly-in to slot lives in vote-form.tsx.
                          When the third particle system lands, consolidate.)

  vote-form.tsx           Ballot drag/drop + bonus bets tabs.
  bonus-bets-form.tsx     Side-bet rows (Country / MultiCountry / YesNo /
                          Number).
  country-drawer.tsx      Country picker bottom-sheet.

  heartbeat-backdrop.tsx  Decorative pulsing heart on the join screen.
  logo-2026.tsx           70-logo wordmark for the join screen.

  admin-*.tsx             Admin surfaces (login, nav, room toggle, rename,
                          danger zone, passkeys, etc).
  room-manage.tsx         Host magic-link page (NOT under /admin).
```

Each component owns its own state. Cross-component state goes through
`useRoomLive()` (room props) and localStorage (identity, prefs).

---

## Animation patterns

- **`@keyframes heartbeat`** in `globals.css` — single source of truth for the lub-dub-lub-dub rhythm. `.heartbeat` runs once, `.heartbeat-loop` runs forever, `.heartbeat-focus` is the same rhythm on `box-shadow` for focused inputs.
- **`<PageTransition/>`** in `app/layout.tsx` — opacity-only between routes. NEVER add `transform` here — it'd establish a containing block for fixed children and break every drawer.
- **`<BottomSheet/>`** is portaled to `document.body` for the same reason — defends against ancestor transforms.
- **Particle effects** currently live in two places: `floating-reactions.tsx` (emoji floats) and `vote-form.tsx` (heart-to-slot). When the third lands (now-playing heart swarm or end-of-show reveal), refactor to a single `<ParticleLayer/>` mounted by the room layout with a `useParticles().spawn({...})` API. Until then, don't pre-abstract.

---

## i18n

Single file `lib/i18n.ts`. Two languages — `en`, `lt`. LT is the default (this is a Lithuanian Eurovision party).

```ts
t(lang, "key", ...args)   // type-safe; function-typed keys take args
fmt(template, vars)        // {home} → "Lietuva"
useLang()                  // hook that subscribes to writes
LANGUAGE_NAMES             // "In English" / "Lietuviškai"
```

Function-typed values exist for plural-ish keys (`pick_n_more(n)`). Templating uses `{name}` placeholders + `fmt()` because we sometimes interpolate the home country / host country.

Admin pages are intentionally English-only — the maintenance overhead isn't worth it for one or two power-users.

---

## Brand language (visual cohesion checklist)

When adding a new surface, hold it against:

1. **Every country chip is a `<HeartFlag/>`** — never a rectangle.
2. **Every CTA is the ESC poster button** — `bg-white text-dark-blue` filled, `rainbow-border rounded-2xl` wrapper. The rainbow stroke is the brand's "Curved Line" leitmotif; nothing else uses it.
3. **Every focused input gets `.heartbeat-focus`** — the brand red border pulses to the same lub-dub.
4. **Every list row uses the same quiet tile** — `bg-white/[0.04] ring-1 ring-white/8 rounded-2xl`. No gradients, no glow.
5. **Hearts beat. Everything else doesn't.** The brand mark, the rehydrate loader, the picked avatar, the freshly-filled slot. Animation is reserved for moments that matter.
6. **No emojis as glyphs** — use lucide icons in coloured circles instead (Apple-Watch style). The reaction bar is the only place we'd consider it, and we already replaced those with filled lucide icons.

---

## Performance budget

- Liveblocks throttle: 80 ms. Don't broadcast on every keystroke; only on commits.
- Fallback poll: 60 s for `/scores`, fires only when no broadcast has been seen. Cheap insurance against dropped WebSockets.
- DB writes are scoped per-room (always `where room_id = …`). No cross-room queries.
- Server components for data fetches where possible; client components only for interactive surfaces.
- Heart-flag SVGs are vector + `unoptimized` so Next doesn't re-encode them.
- Background image uses `soft-light` blend on a fixed `html::before` so it doesn't scroll-paint.

---

## Things we deliberately don't do

- **Voice/video chat.** Liveblocks doesn't do it; bringing Daily/LiveKit in is a separate product.
- **Cross-year history / achievements.** Year-1 of the rebuild. No data to mine yet.
- **Custom avatar uploads.** The 42 iconic acts grid is a feature. Avoids moderation.
- **Feature flags / A/B tests.** This is a 3-night event app. Ship + measure later.
- **Public OAuth/email login.** Anonymous session is the right friction floor.

---

## Future surfaces (planned, in order)

1. Tab shell — `app/r/[code]/layout.tsx` with home/chat/bingo/vote tabs.
2. Now-playing — admin sets active country, server broadcasts, all clients animate a heart-flag swarm across the screen.
3. Bingo — 5×5 trope card seeded per-voter, click to strike, broadcast strike reactions. No DB.
4. PWA + Web Push — manifest + service worker + VAPID + `push_subscriptions` table. Notification prefs (chat all / chat replies / now-playing / voting state / results tallied).
5. Chat — `chat_messages` + `chat_reactions` tables. Replies, hold-to-react, GIFs via Klipy.
6. Klipy GIF picker — proxy + cache via `/api/gif/search`, cached in Postgres for 24h.
7. Country deep-dive sheet — tap any heart-flag → opens artist photo + lyrics + video.
8. End-of-show reveal animation — per-bet "your guess vs. truth" reveal sequence.
9. Social share card — `/api/og/[voterId]` PNG via Next image generation.

Each one is its own PR; none should reach into ESC-specific code (scoring, bets) unless it's scoring-specific.
