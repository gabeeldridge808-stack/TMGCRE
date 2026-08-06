"use server";

import { revalidatePath } from "next/cache";
import { queryOrThrow } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getCurrentUser } from "@/lib/session";

export interface CreateUserState {
  error?: string;
  success?: boolean;
}

const UNIQUE_VIOLATION = "23505";

export async function createUserAction(_prevState: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "Only admins can create users." };
  }

  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const name = formData.get("name")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const role = formData.get("role")?.toString() === "admin" ? "admin" : "analyst";

  if (!email || !name || password.length < 8) {
    return { error: "Name, email, and a password of at least 8 characters are required." };
  }

  try {
    const passwordHash = await hashPassword(password);
    await queryOrThrow(`insert into users (email, password_hash, name, role) values ($1, $2, $3, $4)`, [
      email,
      passwordHash,
      name,
      role,
    ]);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === UNIQUE_VIOLATION) {
      return { error: "A user with that email already exists." };
    }
    return { error: "Failed to create user." };
  }

  revalidatePath("/admin/users");
  return { success: true };
}
