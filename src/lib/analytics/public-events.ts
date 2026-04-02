'use client';

import { track } from '@vercel/analytics/react';

export type PublicEventProperties = Record<string, string | number | boolean | null | undefined>;

function cleanProperties(properties: PublicEventProperties): Record<string, string | number | boolean> | undefined {
  const entries = Object.entries(properties).filter(([, value]) => value != null);
  if (!entries.length) return undefined;
  return Object.fromEntries(entries) as Record<string, string | number | boolean>;
}

export function trackPublicEvent(name: string, properties: PublicEventProperties = {}) {
  try {
    track(name, cleanProperties(properties));
  } catch {
    // Instrumentation must never block public navigation or submissions.
  }
}
