import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voters, votes } from "@/lib/db/schema";
import { countries } from "@/lib/countries";
import { findRoomByCode } from "@/lib/rooms";

// Social share card. Renders the voter's TOP10 ballot as a 1200×630
// PNG suitable for Twitter / iMessage / Facebook previews. Inline
// styles only — next/og's runtime doesn't understand Tailwind.
//
// URL: /api/og/<roomCode>/<voterId>.png

// Default Node runtime — our db proxy uses @neondatabase/serverless
// over HTTP which works fine here without forcing edge.
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

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

  // Build ordered picks (12, 10, 8, 7, …, 1).
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
          backgroundColor: "#10142a",
          backgroundImage:
            "radial-gradient(ellipse at top, rgba(146,87,255,0.45), transparent 60%), radial-gradient(ellipse at bottom, rgba(255,46,222,0.35), transparent 70%)",
          padding: 64,
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Eurovision · Vienna 2026
          </div>
        </div>

        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1,
            marginBottom: 8,
            display: "flex",
          }}
        >
          {voter.name}&rsquo;s TOP10
        </div>
        <div style={{ fontSize: 26, color: "rgba(255,255,255,0.6)", display: "flex" }}>
          Cast in room {room.code}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            marginTop: 36,
          }}
        >
          {picks.map(({ points, country }) => (
            <div
              key={points}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 22px",
                borderRadius: 999,
                background:
                  points === 12
                    ? "linear-gradient(90deg, rgba(255,214,10,0.35), rgba(255,46,222,0.15))"
                    : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontSize: 28,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  width: 48,
                  textAlign: "left",
                  color: points === 12 ? "#ffd60a" : "rgba(255,255,255,0.9)",
                }}
              >
                {points}
              </span>
              <span style={{ fontSize: 30 }}>{country?.flag ?? "🏳️"}</span>
              <span style={{ fontWeight: 500 }}>{country?.name ?? "—"}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            fontSize: 20,
            color: "rgba(255,255,255,0.45)",
            display: "flex",
          }}
        >
          uzkuraitis.eu · United by music
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

function notFound() {
  return new Response("Not found", { status: 404 });
}
