import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { countries } from "@/lib/countries";
import { findRoomByCode } from "@/lib/rooms";

// Social share card. Renders the voter's TOP10 ballot as a 3:4 portrait
// PNG (good for Stories / iMessage). Inline styles only — next/og's
// runtime doesn't understand Tailwind. No room code, no domain, no
// "united by music" — just the ballot, in the Eurovision display face
// (Singing Sans, fetched from /public at request time).
//
// URL: /api/og/<roomCode>/<voterId>

export const contentType = "image/png";
export const size = { width: 1080, height: 1440 };

type RouteCtx = {
  params: Promise<{ code: string; voterId: string }>;
};

const POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

async function loadDisplayFont(origin: string): Promise<ArrayBuffer | null> {
  // satori (next/og) handles TTF/OTF/WOFF — not WOFF2 — so we point at
  // the .woff copy in /public. Best-effort: a failed fetch just means
  // the card falls back to the system sans.
  try {
    const res = await fetch(`${origin}/fonts/Singing_Sans-BERC94M5.woff`, {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: RouteCtx) {
  const { code, voterId } = await params;
  const origin = new URL(req.url).origin;

  const room = await findRoomByCode(code);
  if (!room) return notFound();

  const [voter] = await db
    .select({ id: voters.id, name: voters.name })
    .from(voters)
    .where(eq(voters.id, voterId))
    .limit(1);
  if (!voter || voter.id === undefined) return notFound();

  const ballot = await db
    .select({ points: votes.points, countryCode: votes.countryCode })
    .from(votes)
    .where(eq(votes.voterId, voterId));
  const byPoints = new Map(ballot.map((b) => [b.points, b.countryCode]));

  const picks = POINTS.map((p) => {
    const cc = byPoints.get(p);
    const c = cc ? countries.find((x) => x.code === cc) : null;
    return { points: p, country: c };
  });

  const fontData = await loadDisplayFont(origin);
  const display = fontData ? "Singing Sans, sans-serif" : "system-ui, sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0b22",
          backgroundImage:
            "radial-gradient(820px 560px at 82% -4%, rgba(255,46,222,0.55), transparent 60%), radial-gradient(820px 640px at 8% 104%, rgba(76,201,240,0.45), transparent 60%), radial-gradient(640px 460px at 50% 50%, rgba(146,87,255,0.28), transparent 65%)",
          padding: 64,
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          color: "white",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 26,
              letterSpacing: 12,
              textTransform: "uppercase",
              fontFamily: display,
              color: "rgba(255,255,255,0.55)",
              display: "flex",
            }}
          >
            ♥ Eurovision 2026
          </div>
          <div
            style={{
              fontSize: 96,
              fontFamily: display,
              lineHeight: 1.05,
              marginTop: 6,
              display: "flex",
            }}
          >
            {voter.name}
          </div>
          <div
            style={{
              fontSize: 56,
              fontFamily: display,
              letterSpacing: 2,
              textTransform: "uppercase",
              background: "linear-gradient(90deg,#ffd166,#ff5fa2,#b15bff,#4cc9f0)",
              backgroundClip: "text",
              color: "transparent",
              display: "flex",
            }}
          >
            My TOP 10
          </div>
        </div>

        {/* Ballot rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 40,
          }}
        >
          {picks.map(({ points, country }) => {
            const top = points === 12;
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
                    ? "linear-gradient(90deg, rgba(255,214,10,0.30), rgba(255,46,222,0.16))"
                    : "rgba(255,255,255,0.05)",
                  border: top
                    ? "2px solid rgba(255,214,10,0.55)"
                    : "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <span
                  style={{
                    fontFamily: display,
                    fontSize: top ? 50 : 40,
                    width: 86,
                    display: "flex",
                    color: top ? "#ffd60a" : "rgba(255,255,255,0.85)",
                  }}
                >
                  {points}
                </span>
                <span style={{ fontSize: 50, display: "flex" }}>
                  {country?.flag ?? "🏳️"}
                </span>
                <span
                  style={{
                    fontFamily: display,
                    fontSize: 42,
                    display: "flex",
                    flex: 1,
                    overflow: "hidden",
                  }}
                >
                  {country?.name ?? "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: "Singing Sans", data: fontData, weight: 400, style: "normal" }]
        : [],
    },
  );
}

function notFound() {
  return new Response("Not found", { status: 404 });
}
