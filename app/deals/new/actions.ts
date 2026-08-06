"use server";

import { buildDealPayload } from "@/lib/dealForm";
import { createDeal, describeDealWriteError } from "@/lib/deals";
import { getCurrentUser } from "@/lib/session";
import { recordAuditLog } from "@/lib/auditLog";

export interface CreateDealState {
  error?: string;
  dealId?: string;
}

export async function createDealAction(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const payload = buildDealPayload({
    name: formData.get("name")?.toString() ?? "",
    asset_class: formData.get("asset_class")?.toString() ?? "",
    stage: formData.get("stage")?.toString() ?? "",
    owner: formData.get("owner")?.toString() ?? "",
  });

  if (!payload.name || !payload.asset_class || !payload.owner) {
    return { error: "Name, asset class, and owner are required." };
  }

  let dealId: string;
  try {
    const deal = await createDeal(payload);
    dealId = deal.id;
  } catch (error) {
    return { error: describeDealWriteError(error).message };
  }

  const user = await getCurrentUser();
  if (user) await recordAuditLog(user, { dealId, action: "deal.created" });

  // Return the new id and let the client navigate (router.push), rather
  // than calling redirect() here. redirect() to a middleware-protected
  // path from inside a Server Action bounces back to /login even for an
  // authenticated user — Next.js's internal re-render of the redirect
  // target doesn't carry the session cookie the way a real browser
  // navigation does. Every other mutation in this app already navigates
  // client-side after the action resolves; this makes create/edit consistent
  // with that instead of the one place still using redirect().
  return { dealId };
}
