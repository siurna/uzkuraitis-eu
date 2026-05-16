// Markdown + URL renderer for a single string segment.
// Supports **bold**, *italic*, __underline__ (non-greedy, no nesting),
// plus auto-linking of http(s):// URLs and bare www.* URLs. Returns a
// string when there's no markup, else an array of nodes.
//
// Lives in lib/ as a leaf module — no app component imports — so chat,
// welcome, and highlights surfaces can all share it without forming a
// circular dependency through room-shell → home-panel → highlights →
// chat-row.

import type { ReactNode } from "react";

const INLINE_RE =
  /\*\*([^*]+?)\*\*|\*([^*]+?)\*|__([^_]+?)__|(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/g;

export function renderInline(s: string): ReactNode {
  if (!s.includes("*") && !s.includes("__") && !/https?:\/\/|www\./.test(s)) {
    return s;
  }
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[1] != null) parts.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2] != null) parts.push(<em key={k++}>{m[2]}</em>);
    else if (m[3] != null) parts.push(<u key={k++}>{m[3]}</u>);
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
          key={k++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline decoration-flamingo/60 underline-offset-2 hover:decoration-flamingo break-all"
        >
          {url}
        </a>,
      );
      if (tail) parts.push(tail);
    }
    last = INLINE_RE.lastIndex;
  }
  if (parts.length === 0) return s;
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
