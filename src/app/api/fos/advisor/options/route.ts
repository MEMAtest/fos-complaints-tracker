import { getAdvisorOptions } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let optionsCache: { expiresAt: number; payload: unknown } | null = null;
const CACHE_TTL_MS = 10 * 60_000;

export async function GET() {
  try {
    if (optionsCache && optionsCache.expiresAt > Date.now()) {
      return Response.json(optionsCache.payload, {
        headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' },
      });
    }

    const options = await getAdvisorOptions();
    const payload = { success: true, data: options };
    optionsCache = { expiresAt: Date.now() + CACHE_TTL_MS, payload };

    return Response.json(payload, {
      headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch advisor options.' },
      { status: 500 }
    );
  }
}
