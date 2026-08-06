// TEMPORARY — removes the test account created while verifying the setup
// route works, so the real bootstrap-admin creation isn't blocked by it.
// Deleted along with the other /api/setup/* routes once real setup is done.
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const deleted = await query<{ email: string }>(
    `delete from users where email = 'schema-check3@test.local' returning email`
  );
  return NextResponse.json({ deleted });
}
