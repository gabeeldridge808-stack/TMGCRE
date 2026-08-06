import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createDeal, describeDealWriteError, type Deal } from "@/lib/deals";

export async function GET() {
  const deals = await query<Deal>(
    `select * from deals order by created_at desc`
  );
  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, asset_class, stage, owner } = body;

  if (!name || !asset_class || !owner) {
    return NextResponse.json(
      { error: "name, asset_class, and owner are required" },
      { status: 400 }
    );
  }

  try {
    const deal = await createDeal({ name, asset_class, stage: stage || "sourcing", owner });
    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    const { status, message } = describeDealWriteError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
