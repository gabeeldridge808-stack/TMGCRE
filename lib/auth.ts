// Stateless session tokens: a JWT signed with AUTH_SECRET, carrying
// (id, email, name, role) so middleware can verify a request on the Edge
// runtime without a database round trip (Edge can't open a `pg` TCP
// connection; jose's JWT verification works there, unlike a DB query).
//
// Password hashing (lib/password.ts, bcryptjs) is deliberately a separate
// module: bcryptjs uses Node-only APIs (setImmediate) that aren't available
// on the Edge runtime, and this file is imported by middleware.ts. Keeping
// them apart means middleware's bundle never pulls in bcryptjs at all.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type UserRole = "admin" | "analyst";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "analyst";
}

/** Returns null for a missing, expired, or tampered token rather than throwing — callers treat this as "not logged in". */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string" || !isUserRole(payload.role)) {
      return null;
    }
    return { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}
