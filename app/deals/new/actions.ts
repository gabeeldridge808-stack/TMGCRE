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
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in to create a deal." };
  }

  // A non-admin can't set owner_id to anyone but themselves — this is
  // enforced here server-side, not just by hiding the picker in the form,
  // since the whole point of access control is not trusting client input.
  const submittedOwnerId = formData.get("owner_id")?.toString() ?? "";
  const ownerId = user.role === "admin" && submittedOwnerId ? submittedOwnerId : user.id;

  const payload = buildDealPayload({
    name: formData.get("name")?.toString() ?? "",
    asset_class: formData.get("asset_class")?.toString() ?? "",
    stage: formData.get("stage")?.toString() ?? "",
    owner_id: ownerId,
    deal_category: formData.get("deal_category")?.toString() ?? "",
    development_stage: formData.get("development_stage")?.toString() ?? "",
  });

  if (!payload.name || !payload.asset_class || !payload.owner_id) {
    return { error: "Name, asset class, and owner are required." };
  }

  let dealId: string;
  try {
    const deal = await createDeal(payload);
    dealId = deal.id;
  } catch (error) {
    return { error: describeDealWriteError(error).message };
  }

  await recordAuditLog(user, { dealId, action: "deal.created" });

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
