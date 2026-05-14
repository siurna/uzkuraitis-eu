"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { FluentEmoji } from "@/components/fluent-emoji";
import { useLang } from "@/lib/i18n-client";
import { t, type Language } from "@/lib/i18n";

// "A word from the organizers" — the closing widget on every room
// home. Now a compact tappable card with a flamingo-violet wash:
// tap it and the full markdown opens in a bottom-sheet drawer so the
// home scroll stays scannable. Same fetch + `uzk:welcome-refresh`
// listener as before; the widget self-hides when the admin hasn't
// authored anything for the viewer's language yet.

type Welcome = { welcome_md_en: string; welcome_md_lt: string };

export function WelcomeBanner() {
  const lang = useLang();
  const [data, setData] = useState<Welcome | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/welcome", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Welcome | null) => {
          if (alive && d) setData(d);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("uzk:welcome-refresh", load);
    return () => {
      alive = false;
      window.removeEventListener("uzk:welcome-refresh", load);
    };
  }, []);

  const md = lang === "lt" ? data?.welcome_md_lt : data?.welcome_md_en;
  if (!md || !md.trim()) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4">
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full overflow-hidden rounded-3xl text-left
                   ring-1 ring-white/10
                   shadow-[0_18px_44px_-22px_rgba(0,0,0,0.6)]"
        style={{
          background:
            "radial-gradient(120% 130% at 0% 0%, oklch(58% 0.22 336 / 0.55) 0%, transparent 55%), linear-gradient(135deg, #2a1664 0%, #4a1f7a 55%, #1b2360 100%)",
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.16), transparent)" }}
          aria-hidden
        />
        <div className="relative flex items-center gap-4 p-5">
          {/* Fluent 3D waving hand, large + sporadically waving. Same
              wave choreography lives in `globals.css` — every ~7s
              the hand tilts left/right twice then rests. The
              animation moved off the outer chip and onto the inner
              <FluentEmoji> wrapper below: the whole rectangle
              waving was distracting; only the hand should move. */}
          <span
            className="shrink-0 grid place-items-center h-12 w-12 rounded-2xl
                       bg-white/12 ring-1 ring-white/20"
            aria-hidden
          >
            <span
              className="motion-safe:[animation:waving-hand_7s_ease-in-out_infinite] origin-[70%_70%] inline-flex"
            >
              <FluentEmoji glyph="👋" size={30} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg text-white leading-tight text-balance">
              {t(lang, "welcome_card_title")}
            </p>
            <p className="text-xs text-white/65 leading-snug mt-0.5">
              {t(lang, "welcome_card_sub")}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/55 shrink-0" />
        </div>
      </motion.button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t(lang, "welcome_card_title")}
      >
        <WelcomeMarkdown source={md} />
      </BottomSheet>
    </div>
  );
}

// Tiny markdown subset for housekeeping notes — **bold**, *italic*,
// __underline__, http(s):// + www.* autolinks, blank-line paragraphs,
// `- ` / `* ` bullet lists. Mirrors the chat renderer's INLINE_RE so
// the inline syntax matches everywhere users see it.
//
// Exported so the admin preview pane renders exactly what voters see.
const INLINE_RE =
  /\*\*([^*]+?)\*\*|\*([^*]+?)\*|__([^_]+?)__|(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/g;

function renderInline(s: string, key: string): React.ReactNode {
  if (!s.includes("*") && !s.includes("__") && !/https?:\/\/|www\./.test(s)) {
    return s;
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[1] != null) parts.push(<strong key={`${key}-${k++}`}>{m[1]}</strong>);
    else if (m[2] != null) parts.push(<em key={`${key}-${k++}`}>{m[2]}</em>);
    else if (m[3] != null) parts.push(<u key={`${key}-${k++}`}>{m[3]}</u>);
    else if (m[4] != null) {
      let url = m[4];
      let tail = "";
      while (/[.,!?:;)]/.test(url[url.length - 1] ?? "")) {
        tail = url[url.length - 1] + tail;
        url = url.slice(0, -1);
      }
      const href = url.startsWith("http") ? url : `https://${url}`;
      parts.push(
        <a
          key={`${key}-${k++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-flamingo/60 underline-offset-2 hover:decoration-flamingo break-all"
        >
          {url}
        </a>,
      );
      if (tail) parts.push(tail);
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.length > 0 ? parts : s;
}

export function WelcomeMarkdown({ source }: { source: string }) {
  // Group lines into blocks: contiguous bullet lines fold into a
  // single <ul>; blank lines split paragraphs; `#`/`##`/`###` at the
  // start of a line lifts into h1/h2/h3 (with the level visible by
  // type size so a long welcome reads structured, not as a wall).
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  type Block =
    | { kind: "p"; text: string }
    | { kind: "h"; level: 1 | 2 | 3; text: string }
    | { kind: "ul"; items: string[] };
  const blocks: Block[] = [];
  let buf: string[] = [];
  let listBuf: string[] = [];
  const flushP = () => {
    if (buf.length) {
      blocks.push({ kind: "p", text: buf.join(" ").trim() });
      buf = [];
    }
  };
  const flushUl = () => {
    if (listBuf.length) {
      blocks.push({ kind: "ul", items: [...listBuf] });
      listBuf = [];
    }
  };
  // Lines matching the `---[Label]---` chat-ticket split marker
  // are content metadata (they tell the chat ticket where the
  // short-version cut is), not visible text — drop them from the
  // rendered output entirely.
  const DIVIDER_RE = /^---\s*\[(.+?)\]\s*---$/;
  for (const raw of lines) {
    const line = raw.trim();
    if (DIVIDER_RE.test(line)) {
      flushP();
      flushUl();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (heading) {
      flushP();
      flushUl();
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
      blocks.push({ kind: "h", level, text: heading[2] });
    } else if (bullet) {
      flushP();
      listBuf.push(bullet[1]);
    } else if (line === "") {
      flushP();
      flushUl();
    } else {
      flushUl();
      buf.push(line);
    }
  }
  flushP();
  flushUl();

  return (
    <div className="flex flex-col gap-2 text-sm text-white/85 leading-snug">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          const sizeCls =
            b.level === 1
              ? "font-display text-2xl text-white leading-tight"
              : b.level === 2
                ? "font-display text-xl text-white leading-tight"
                : "font-display text-base text-white leading-tight";
          return (
            <p key={i} className={`${sizeCls} text-balance mt-2 first:mt-0`}>
              {renderInline(b.text, `h-${i}`)}
            </p>
          );
        }
        if (b.kind === "p") {
          return (
            <p key={i} className="text-balance whitespace-pre-line">
              {renderInline(b.text, `p-${i}`)}
            </p>
          );
        }
        return (
          <ul key={i} className="flex flex-col gap-1 pl-1">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2">
                <span className="text-flamingo shrink-0" aria-hidden>•</span>
                <span className="min-w-0 flex-1 text-balance">
                  {renderInline(it, `ul-${i}-${j}`)}
                </span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
