import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export type AdminSession = {
  authed?: boolean;
  challenge?: string;
  challengeKind?: "register" | "login";
  // The admin "user id" is constant — this app supports a single admin role —
  // we store it for SimpleWebAuthn's `userID` field so transports stay stable.
  webauthnUserId?: string;
};

const SESSION_COOKIE = "uzk_admin";

export async function readAdminSession(): Promise<IronSession<AdminSession>> {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET is missing or shorter than 32 chars. " +
        "Set a long random string in .env.local.",
    );
  }
  const jar = await cookies();
  return getIronSession<AdminSession>(jar, {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  });
}

export async function isAdminAuthed(): Promise<boolean> {
  const session = await readAdminSession();
  return session.authed === true;
}

export const ADMIN_RP_NAME = "Užkuraitis admin";

export function getRpId(request: Request): string {
  const url = new URL(request.url);
  return url.hostname;
}

export function getOrigin(request: Request): string {
  const url = new URL(request.url);
  return url.origin;
}
