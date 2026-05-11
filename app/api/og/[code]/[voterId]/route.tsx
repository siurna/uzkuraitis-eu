import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { countries } from "@/lib/countries";
import { findRoomByCode } from "@/lib/rooms";

// Social share card. Renders the voter's TOP10 ballot as a 3:4 portrait
// PNG (good for Stories / iMessage). Inline styles only — next/og's
// runtime doesn't understand Tailwind. No room code, no domain, no
// "united by music" — just the ballot, Eurovision-flavoured.
//
// URL: /api/og/<roomCode>/<voterId>

export const contentType = "image/png";
export const size = { width: 1080, height: 1440 };

type RouteCtx = {
  params: Promise<{ code: string; voterId: string }>;
};

const POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

export async function GET(_req: Request, { params }: RouteCtx) {
  const { code, voterId } = await params;

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
            "radial-gradient(900px 600px at 80% -5%, rgba(255,46,222,0.55), transparent 60%), radial-gradient(900px 700px at 10% 105%, rgba(76,201,240,0.45), transparent 60%), radial-gradient(700px 500px at 50% 50%, rgba(146,87,255,0.30), transparent 65%)",
          padding: 80,
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          color: "white",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 28,
              letterSpacing: 14,
              textTransform: "uppercase",
              fontWeight: 700,
              color: "rgba(255,255,255,0.55)",
              display: "flex",
            }}
          >
            ♥ Eurovision 2026
          </div>
          <div
            style={{
              fontSize: 110,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -2,
              display: "flex",
            }}
          >
            {voter.name}
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
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
            gap: 14,
            marginTop: 56,
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
                  gap: 24,
                  padding: "18px 28px",
                  borderRadius: 28,
                  background: top
                    ? "linear-gradient(90deg, rgba(255,214,10,0.30), rgba(255,46,222,0.18))"
                    : "rgba(255,255,255,0.05)",
                  border: top
                    ? "2px solid rgba(255,214,10,0.55)"
                    : "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: top ? 56 : 44,
                    width: 96,
                    display: "flex",
                    color: top ? "#ffd60a" : "rgba(255,255,255,0.85)",
                  }}
                >
                  {points}
                </span>
                <span style={{ fontSize: 56, display: "flex" }}>
                  {country?.flag ?? "🏳️"}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 46,
                    display: "flex",
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
    { ...size },
  );
}

function notFound() {
  return new Response("Not found", { status: 404 });
}
