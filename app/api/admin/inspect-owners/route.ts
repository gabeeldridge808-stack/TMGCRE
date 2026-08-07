import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Temporary, read-only — informs the deals.owner -> owner_id migration plan.
// Delete after use.
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const users = await query<{ id: string; email: string; name: string; role: string }>(
    `select id, email, name, role from users order by created_at`
  );
  const deals = await query<{ id: string; name: string; owner: string }>(
    `select id, name, owner from deals order by created_at`
  );

  return NextResponse.json({ users, deals });
}
