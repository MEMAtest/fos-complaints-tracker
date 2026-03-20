import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { deleteBoardPackDefinition, saveBoardPackDefinition } from "@/lib/complaints/repository";
import type { BoardPackRequest } from "@/lib/board-pack/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ definitionId: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request, "manager");
    const { definitionId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ success: false, error: "Invalid request body." }, { status: 400 });
    }
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return Response.json({ success: false, error: "Definition name is required." }, { status: 400 });
    }
    const requestPayload = typeof body.request === "object" && body.request && !Array.isArray(body.request)
      ? (body.request as Omit<BoardPackRequest, "format">)
      : null;
    if (!requestPayload) {
      return Response.json({ success: false, error: "Definition request payload is required." }, { status: 400 });
    }
    const definition = await saveBoardPackDefinition({
      id: definitionId,
      name: body.name,
      templateKey: typeof body.templateKey === "string" ? body.templateKey : null,
      request: requestPayload,
      performedBy: user.fullName,
    });
    return Response.json({ success: true, definition });
  } catch (error) {
    const status = "status" in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to update board pack definition." }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ definitionId: string }> }) {
  try {
    await requireAuthenticatedUser(request, "manager");
    const { definitionId } = await params;
    const deleted = await deleteBoardPackDefinition(definitionId);
    if (!deleted) {
      return Response.json({ success: false, error: "Board pack definition not found." }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    const status = "status" in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to delete board pack definition." }, { status });
  }
}
