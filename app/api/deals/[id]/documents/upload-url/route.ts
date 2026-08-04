import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { UPLOADABLE_MIME_TYPES } from "@/lib/dealConstants";

// Issues short-lived tokens for direct browser → Vercel Blob uploads (see
// app/deals/[id]/DealDocumentUpload.tsx) — the file never passes through
// this server, only this token exchange does. No auth check here: this
// whole app is unauthenticated by design (internal tool, see README), so
// this route is no more or less exposed than every other one.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: dealId } = await params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`deals/${dealId}/`)) {
          throw new Error("Upload path must be scoped to this deal");
        }
        return {
          allowedContentTypes: [...UPLOADABLE_MIME_TYPES],
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload authorization failed" },
      { status: 400 }
    );
  }
}
