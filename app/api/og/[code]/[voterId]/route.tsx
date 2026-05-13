import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { countries, countryName } from "@/lib/countries";
import { countryColors } from "@/lib/country-colors";
import { findRoomByCode } from "@/lib/rooms";
import type { Language } from "@/lib/i18n";

// Localised in-route (instead of importing `t` from "@/lib/i18n", which
// drags the React-bearing client module into the server route).
const HEADLINE: Record<Language, string> = {
  en: "My TOP10",
  lt: "Mano TOP10",
};

// "#rrggbb" + alpha → "rgba(...)" so the satori card can wash a colour.
function rgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255,46,222,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Social share card — the voter's TOP10 ballot as a 3:4 portrait PNG
// (good for Stories / iMessage). Inline styles only (satori doesn't
// understand Tailwind). No room code, no domain.
//
// The Eurovision display face (Singing Sans) is fetched from /public over
// HTTPS off this request's own origin — a CDN-cached static asset, so the
// fetch is reliable. (Don't `fetch(new URL(import.meta.url))`: in the
// Node serverless runtime that's a `file://` URL and undici's fetch
// rejects those → no font → satori can't render → 500.) satori can't
// read woff2, so we ship the plain `.woff`.
//
// URL: /api/og/<roomCode>/<voterId>

export const contentType = "image/png";
export const size = { width: 1080, height: 1440 };
const SANS = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const FONT_PATH = "/fonts/Singing_Sans-BERC94M5.woff";

type RouteCtx = { params: Promise<{ code: string; voterId: string }> };

const POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

export async function GET(req: Request, { params }: RouteCtx) {
  const { code, voterId } = await params;

  try {
    const url = new URL(req.url);
    const origin = url.origin;
    const lang: Language = url.searchParams.get("lang") === "en" ? "en" : "lt";

    const room = await findRoomByCode(code);
    if (!room) return new Response("Not found", { status: 404 });

    const [voter] = await db
      .select({ id: voters.id, name: voters.name })
      .from(voters)
      .where(eq(voters.id, voterId))
      .limit(1);
    if (!voter) return new Response("Not found", { status: 404 });

    const ballot = await db
      .select({ points: votes.points, countryCode: votes.countryCode })
      .from(votes)
      .where(eq(votes.voterId, voterId));
    const byPoints = new Map(ballot.map((b) => [b.points, b.countryCode]));

    const picks = POINTS.map((p) => {
      const cc = byPoints.get(p);
      const c = cc ? countries.find((x) => x.code === cc) : null;
      return { points: p, code: cc ?? null, country: c };
    });

    // Wash the card in the flag colours of the top 3 picks (12 / 10 / 8),
    // falling back to the brand rainbow for any empty slot.
    const BRAND: [string, string][] = [["#ff2ede", "#4cc9f0"], ["#4cc9f0", "#9257ff"], ["#9257ff", "#ffd166"]];
    const accents = [picks[0]?.code, picks[1]?.code, picks[2]?.code].map((cc, i) =>
      cc ? countryColors(cc) : BRAND[i],
    );
    const backgroundImage = [
      `radial-gradient(880px 600px at 84% -6%, ${rgba(accents[0][0], 0.62)}, transparent 60%)`,
      `radial-gradient(820px 640px at 6% 106%, ${rgba(accents[1][0], 0.5)}, transparent 60%)`,
      `radial-gradient(700px 520px at 50% 52%, ${rgba(accents[2][0], 0.3)}, transparent 65%)`,
    ].join(", ");

    const fontRes = await fetch(`${origin}${FONT_PATH}`);
    if (!fontRes.ok) throw new Error(`font fetch ${fontRes.status}`);
    const fontData = await fontRes.arrayBuffer();
    const display = `Singing Sans, ${SANS}`;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0a0b22",
            backgroundImage,
            padding: 64,
            fontFamily: SANS,
            color: "white",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 28,
                letterSpacing: 12,
                textTransform: "uppercase",
                fontFamily: display,
                color: "rgba(255,255,255,0.55)",
                display: "flex",
              }}
            >
              EUROVISION 2026
            </div>
            <div style={{ fontSize: 100, fontFamily: display, lineHeight: 1.05, marginTop: 8, display: "flex" }}>
              {voter.name}
            </div>
            <div
              style={{
                fontSize: 60,
                fontFamily: display,
                letterSpacing: 2,
                textTransform: "uppercase",
                backgroundImage: "linear-gradient(90deg,#ffd166,#ff5fa2,#b15bff,#4cc9f0)",
                backgroundClip: "text",
                color: "transparent",
                display: "flex",
              }}
            >
              {HEADLINE[lang]}
            </div>
          </div>

          {/* Ballot rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 40 }}>
            {picks.map(({ points, code: cc, country }) => {
              const top = points === 12;
              const [c1] = cc ? countryColors(cc) : ["#ffffff"];
              return (
                <div
                  key={points}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    padding: "14px 26px",
                    borderRadius: 24,
                    background: top
                      ? `linear-gradient(90deg, ${rgba(c1, 0.34)}, rgba(255,255,255,0.06))`
                      : `linear-gradient(90deg, ${rgba(c1, 0.16)}, rgba(255,255,255,0.04))`,
                    border: top ? `2px solid ${rgba(c1, 0.6)}` : `1px solid ${rgba(c1, 0.28)}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: display,
                      fontSize: top ? 52 : 42,
                      width: 90,
                      display: "flex",
                      color: top ? "#ffd60a" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {points}
                  </span>
                  <span style={{ fontSize: 50, display: "flex" }}>{country?.flag ?? "🏳️"}</span>
                  <span style={{ fontFamily: display, fontSize: 44, display: "flex", flex: 1, overflow: "hidden" }}>
                    {cc ? countryName(cc, lang) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ),
      {
        ...size,
        emoji: "twemoji",
        fonts: [{ name: "Singing Sans", data: fontData, weight: 400 as const, style: "normal" as const }],
      },
    );
  } catch (err) {
    console.error("og card failed", err);
    return new Response("Couldn't render the card", { status: 500 });
  }
}
