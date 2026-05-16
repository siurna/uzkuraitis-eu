"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// Recovery landing page. The participant taps the admin-issued link
// (e.g. via WhatsApp/SMS), and we silently POST the token to
// /api/recover/<token>, write the recovered identity into
// localStorage, and bounce them into the room. No name-gate
// re-entry; the room shell heartbeats with the restored sessionId on
// next paint and everything tied to that voter (ballot, bets,
// reactions, score) snaps back.

export default function RecoverPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const ran = useRef(false);
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params?.token;
    if (!token) {
      setStatus("error");
      setMessage("Missing recovery token.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/recover/${token}`, { method: "POST" });
        const data = (await res.json().catch(() => null)) as
          | { sessionId?: string; name?: string | null; avatarId?: string | null; roomCode?: string; error?: string }
          | null;
        if (!res.ok || !data?.sessionId || !data?.roomCode) {
          setStatus("error");
          setMessage(data?.error ?? "Recovery failed.");
          return;
        }
        try {
          localStorage.setItem("uzk_session", data.sessionId);
          if (data.name) localStorage.setItem("uzk_name", data.name);
          if (data.avatarId) localStorage.setItem("uzk_avatar", data.avatarId);
          // Drop any "you last left tab X" memory for this room so the
          // recovered viewer lands on Home, not somewhere weird.
          localStorage.removeItem(`uzk_last_tab_${data.roomCode}`);
        } catch {
          /* private mode — cookie alone is enough for server identity */
        }
        router.replace(`/r/${data.roomCode}`);
      } catch {
        setStatus("error");
        setMessage("Couldn't reach the server. Try the link again in a moment.");
      }
    })();
  }, [params, router]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center gap-3">
      {status === "loading" ? (
        <p className="font-display text-lg text-white/80">Atstatomas tavo profilis…</p>
      ) : (
        <>
          <p className="font-display text-lg text-white">Nepavyko.</p>
          <p className="text-sm text-white/60 max-w-sm text-balance">{message}</p>
          <a
            href="/"
            className="mt-3 rainbow-border rounded-2xl"
          >
            <span className="block px-5 py-2.5 rounded-[14px] bg-white text-dark-blue font-display">
              Į pradžią
            </span>
          </a>
        </>
      )}
    </main>
  );
}
