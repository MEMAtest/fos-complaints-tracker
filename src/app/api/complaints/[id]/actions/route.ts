import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createComplaintAction, listComplaintActions } from "@/lib/complaints/repository";
import type { ComplaintActionMutationInput } from "@/lib/complaints/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser(request, "viewer");
    const { id } = await params;
    const actions = await listComplaintActions(id);
    return Response.json({ success: true, actions });
  } catch (error) {
    const status = "status" in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to fetch complaint actions." }, { status });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request, "operator");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return Response.json({ success: false, error: "Action title is required." }, { status: 400 });
    }
    const action = await createComplaintAction({
      complaintId: id,
      title: body.title,
      description: typeof body.description === "string" ? body.description : null,
      owner: typeof body.owner === "string" ? body.owner : null,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
      status: typeof body.status === "string" ? (body.status as ComplaintActionMutationInput["status"]) : undefined,
      actionType: typeof body.actionType === "string" ? (body.actionType as ComplaintActionMutationInput["actionType"]) : undefined,
      source: typeof body.source === "string" ? (body.source as ComplaintActionMutationInput["source"]) : undefined,
    }, user.fullName);
    return Response.json({ success: true, action }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create complaint action.";
    const status = "status" in (error as object)
      ? Number((error as { status?: number }).status || 500)
      : (message.toLowerCase().includes("required") ? 400 : 500);
    return Response.json({ success: false, error: message }, { status });
  }
}
