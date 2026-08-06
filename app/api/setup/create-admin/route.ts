// Bootstrap-only: creates the first admin account. Refuses once any user
// exists, so this is safe to leave reachable (middleware exempts /api/setup
// from the login requirement, since by definition no one can be logged in
// before this runs) — but it still gets deleted once setup is confirmed,
// same as this project's other temporary routes.
import { NextRequest, NextResponse } from "next/server";
import { query, queryOrThrow } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const existing = await query<{ id: string }>(`select id from users limit 1`);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Setup already completed — a user already exists." }, { status: 403 });
  }

  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : email;

  if (!email || password.length < 8) {
    return NextResponse.json(
      { error: "email and a password of at least 8 characters are required" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  await queryOrThrow(`insert into users (email, password_hash, name, role) values ($1, $2, $3, 'admin')`, [
    email,
    passwordHash,
    name,
  ]);

  return NextResponse.json({ ok: true });
}
