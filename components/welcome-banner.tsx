"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n-client";
import { t, type Language } from "@/lib/i18n";

// "Hello folks" housekeeping widget — the closing card on every room
// home. Renders the markdown the admin set for the current language;
// hides when empty for that language. Polls once per mount (the
// content barely changes mid-event); a manual `uzk:welcome-refresh`
// event lets the admin page force a reload without a hard refresh.

type Welcome = { welcome_md_en: string; welcome_md_lt: string };

export function WelcomeBanner() {
  const lang = useLang();
  const [data, setData] = useState<Welcome | null>(null);

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
    <section className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 bg-gradient-to-br from-dark-blue-800/80 to-dark-blue-900/95 px-5 py-5">
      <header className="flex items-center gap-2 mb-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <Sparkles className="h-4 w-4" fill="currentColor" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.3em] font-display leading-tight text-white/75">
          {t(lang, "welcome_eyebrow")}
        </p>
      </header>
      <WelcomeMarkdown source={md} />
    </section>
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
  // single <ul>; blank lines split paragraphs.
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  type Block =
    | { kind: "p"; text: string }
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
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
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
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i} className="text-balance">
            {renderInline(b.text, `p-${i}`)}
          </p>
        ) : (
          <ul key={i} className="flex flex-col gap-1 pl-1">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2">
                <span className="text-flamingo shrink-0" aria-hidden>
                  •
                </span>
                <span className="min-w-0 flex-1 text-balance">
                  {renderInline(it, `ul-${i}-${j}`)}
                </span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
