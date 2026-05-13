# CLAUDE.md

Quick orientation for Claude (or any future contributor) editing this repo.

## What this is

A Eurovision 2026 second-screen companion app. Multi-room voting, scoreboard, bonus bets, chat, bingo, now-playing — all real-time. Mobile-first. LT default, EN available.

Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the deep dive.

## Writing rules (USER-FACING strings only)

- **No em dashes (`—`) anywhere in user-facing strings.** Period. They land as a Claude-fingerprint and read clunky in LT. Use a comma, a period, or rephrase. (Comments, doc-block prose, commit messages, and PR bodies stay free to use them.)

## Conventions that matter

1. **Brand language is non-negotiable.** Every country chip is a `<HeartFlag/>`, every CTA is `bg-white text-dark-blue rounded-2xl` inside a `rainbow-border`, every list row is `bg-white/[0.04] ring-1 ring-white/8 rounded-2xl`. New surfaces must echo this language.

2. **Hearts beat; everything else doesn't.** `@keyframes heartbeat` in `globals.css` is the single source of truth. Use `.heartbeat`, `.heartbeat-loop`, or `.heartbeat-focus`. Don't invent a new pulse.

3. **Dual store, one-way flow.** Writes go to Neon. Server broadcasts a hint event over Liveblocks. Clients refetch the relevant slice. Don't put durable data in Liveblocks Storage and don't broadcast full payloads.

4. **Broadcast events are `<feature>:<verb>`.** Documented in `lib/liveblocks.ts`. New event? Extend the union, add a note in the doc block.

5. **No transforms on the page wrapper.** `PageTransition` is opacity-only. Any ancestor transform breaks `position: fixed` for every drawer in the app.

6. **BottomSheet is portaled.** Always renders into `document.body` to defend against the above. Don't undo this.

7. **`.glass-card` does NOT set `position: relative`.** Callers that need a positioning context add `relative` themselves. The class only carries the surface (bg + border + blur + shadow).

8. **Admin pages stay English.** Voter-facing surfaces use `t(lang, key)`. Admin uses literal English strings — by design.

9. **Admin pages share one chrome.** Every `/admin/*` page opens with `<AdminPageTitle icon={Icon}>Title</AdminPageTitle>` (`components/admin-page-title.tsx`) — a flamingo-tinted icon tile + gradient `<h1>`. The icon must match that section's icon in `components/admin-nav.tsx` (Live → `Radio`, Rooms → `Vote`, Results → `Trophy`, Settings → `Settings`). Card-section headers inside a page repeat the same icon-tile pattern at `h-10 w-10`.

## Useful scripts

```bash
pnpm dev         # local dev server
pnpm typecheck   # tsc --noEmit
pnpm build       # production build (Vercel runs this)
pnpm db:generate # drizzle-kit generate (new migrations)
pnpm db:migrate  # apply migrations (we usually do this manually via @neondatabase/serverless HTTP from a script)
```

## Where things live

| Want to add… | Edit |
|---|---|
| A new country chip surface | `components/flag.tsx` (`<HeartFlag/>`) |
| A new bonus bet | `lib/scoring.ts` + `components/bonus-bets-form.tsx` + DB column + i18n keys |
| A new admin surface | `app/admin/(authed)/<name>/page.tsx` (open with `<AdminPageTitle/>`) + maybe a tab in `components/admin-room-tabs.tsx` |
| A new translation | `lib/i18n.ts` (both `en` and `lt`) |
| A new broadcast event | `lib/liveblocks.ts` (union) + emit + listen |
| A new bottom-sheet | Wrap your content in `<BottomSheet/>` from `components/ui/bottom-sheet.tsx` |
| A new room page (tab) | Will be `app/r/[code]/<tab>/page.tsx` once tab shell lands |

## Things to think about before writing code

- **Where does the heart live in this surface?** If you can't answer, pause.
- **Does this need DB durability or is broadcast enough?** Chat/votes/bets = durable. Reactions/floating emoji = ephemeral.
- **Mobile first.** Test on a 390×844 viewport before desktop. Vote CTA + bottom-sheet + emoji bar all stack at the bottom; don't break that stacking.
- **i18n.** Every user-facing string goes through `t()`. If you're typing English into JSX, you're doing it wrong.

## Things to avoid

- ❌ Adding a `tailwind.config.js`. Tailwind v4 is CSS-first; everything lives in `globals.css` `@theme`.
- ❌ Using lucide icons as stroke-only when they should be filled (Heart, Flame, Star, Sparkles — set `fill="currentColor"`).
- ❌ Animating layout (`width`/`height`/`padding`). Use transform-based motion.
- ❌ Coupling chat/bingo/now-playing to ESC-specific scoring. The room model is reusable; the scoring is contest-specific.
- ❌ Hard-coded country lists. Always derive from `lib/countries.ts`.
- ❌ Adding new packages without checking the bundle impact.

## Active workstreams (May 2026)

See `ARCHITECTURE.md` § "Future surfaces" for the full sequence. Today's priority: tab shell + now-playing + bingo + chat before the final on May 16.
