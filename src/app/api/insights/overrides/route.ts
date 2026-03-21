import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import {
  deleteInsightPublicationOverride,
  listInsightPublicationCandidates,
  listInsightPublicationOverrides,
  resetInsightPublicationOverridesCache,
  resolveInsightHref,
  saveInsightPublicationOverride,
} from '@/lib/insights/repository';
import type { InsightKind, InsightPublicationOverrideInput } from '@/lib/insights/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_KINDS: Array<InsightKind> = ['year', 'firm', 'product', 'type', 'year-product', 'firm-product'];

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request, 'manager');
    const searchParams = request.nextUrl.searchParams;
    const kind = normalizeKind(searchParams.get('kind'));
    const query = (searchParams.get('q') || '').trim();
    const [candidates, overrides] = await Promise.all([
      listInsightPublicationCandidates({ kind: kind || 'all', query }),
      listInsightPublicationOverrides(),
    ]);
    return Response.json({ success: true, candidates, overrides });
  } catch (error) {
    return failure(error, 'Failed to load insight publication overrides.');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request, 'admin');
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const payload = normalizeOverridePayload(body as Partial<InsightPublicationOverrideInput>);
    if (!payload) {
      return Response.json({ success: false, error: 'kind and entityKey are required.' }, { status: 400 });
    }

    const override = await saveInsightPublicationOverride(payload);
    await revalidateInsightSurfaces(payload.kind, payload.entityKey);
    return Response.json({ success: true, override });
  } catch (error) {
    return failure(error, 'Failed to save insight publication override.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request, 'admin');
    const body = await request.json().catch(() => null);
    const kind = normalizeKind(typeof body?.kind === 'string' ? body.kind : null);
    const entityKey = typeof body?.entityKey === 'string' ? body.entityKey.trim() : '';
    if (!kind || !entityKey) {
      return Response.json({ success: false, error: 'kind and entityKey are required.' }, { status: 400 });
    }

    await deleteInsightPublicationOverride(kind, entityKey);
    await revalidateInsightSurfaces(kind, entityKey);
    return Response.json({ success: true });
  } catch (error) {
    return failure(error, 'Failed to delete insight publication override.');
  }
}

function normalizeKind(value: string | null): InsightKind | null {
  if (!value) return null;
  return VALID_KINDS.includes(value as InsightKind) ? (value as InsightKind) : null;
}

function normalizeOverridePayload(body: Partial<InsightPublicationOverrideInput>): InsightPublicationOverrideInput | null {
  const kind = normalizeKind(typeof body.kind === 'string' ? body.kind : null);
  const entityKey = typeof body.entityKey === 'string' ? body.entityKey.trim() : '';
  if (!kind || !entityKey) return null;
  const rawFeaturedRank = body.featuredRank as string | number | null | undefined;
  const featuredRank = rawFeaturedRank == null || rawFeaturedRank === ''
    ? null
    : Number.isFinite(Number(rawFeaturedRank))
      ? Math.max(1, Math.trunc(Number(rawFeaturedRank)))
      : null;
  return {
    kind,
    entityKey,
    isPublished: body.isPublished !== false,
    isNoindex: Boolean(body.isNoindex),
    titleOverride: normalizeNullable(body.titleOverride),
    descriptionOverride: normalizeNullable(body.descriptionOverride),
    heroDekOverride: normalizeNullable(body.heroDekOverride),
    featuredRank,
  };
}

function normalizeNullable(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

async function revalidateInsightSurfaces(kind: InsightKind, entityKey: string): Promise<void> {
  resetInsightPublicationOverridesCache();
  revalidatePath('/insights');
  revalidatePath('/insights/years');
  revalidatePath('/insights/firms');
  revalidatePath('/insights/products');
  revalidatePath('/insights/types');
  revalidatePath('/insights/year-products');
  revalidatePath('/insights/firm-products');
  revalidatePath('/sitemap.xml');

  const path = await resolveInsightHref(kind, entityKey);
  if (path) {
    revalidatePath(path);
  }
}

function failure(error: unknown, fallback: string) {
  const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
  return Response.json({ success: false, error: error instanceof Error ? error.message : fallback }, { status });
}
