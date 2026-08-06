// TEMPORARY — removes test accounts created while verifying auth/setup
// works, so the real bootstrap-admin creation isn't blocked by one.
// Deleted along with the other /api/setup/* routes once real setup is done.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const TEST_EMAILS = ["schema-check3@test.local", "verify-agent@test.local"];

export async function GET() {
  const deleted = await query<{ email: string }>(
    `delete from users where email = any($1) returning email`,
    [TEST_EMAILS]
  );
  return NextResponse.json({ deleted });
}
