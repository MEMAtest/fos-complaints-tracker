import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { deleteComplaintAction, updateComplaintAction } from "@/lib/complaints/repository";
import type { ComplaintActionMutationInput } from "@/lib/complaints/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ actionId: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request, "operator");
    const { actionId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }
    const action = await updateComplaintAction(actionId, body as ComplaintActionMutationInput, user.fullName);
    if (!action) {
      return Response.json({ success: false, error: "Complaint action not found." }, { status: 404 });
    }
    return Response.json({ success: true, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update complaint action.";
    const status = "status" in (error as object)
      ? Number((error as { status?: number }).status || 500)
      : (message.toLowerCase().includes("required") ? 400 : 500);
    return Response.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ actionId: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request, "manager");
    const { actionId } = await params;
    const deleted = await deleteComplaintAction(actionId, user.fullName);
    if (!deleted) {
      return Response.json({ success: false, error: "Complaint action not found." }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    const status = "status" in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to delete complaint action." }, { status });
  }
}
