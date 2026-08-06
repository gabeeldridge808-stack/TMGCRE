"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export interface LoginState {
  error?: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "analyst";
  password_hash: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const next = formData.get("next")?.toString() || "/";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // query(), not queryOrThrow — an unauthenticated request must never be
  // able to distinguish "wrong password" from "database unreachable" from
  // the response it gets back.
  const [user] = await query<UserRow>(
    `select id, email, name, role, password_hash from users where email = $1`,
    [email]
  );

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Invalid email or password." };
  }

  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });

  redirect(next);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
