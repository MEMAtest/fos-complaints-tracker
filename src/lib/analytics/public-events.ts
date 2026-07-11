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

export function trackOwnedEvent(
  name: 'lead_submitted' | 'signup_completed' | 'demo_requested' | 'download_completed' | 'checkout_started' | 'purchase_completed',
  properties: Record<string, string | number | boolean> = {},
) {
  if (typeof window === 'undefined') return false;
  const analyticsWindow = window as typeof window & {
    ownedPortfolioTrack?: (eventName: string, values?: Record<string, string | number | boolean>) => boolean;
    ownedPortfolioQueue?: Array<[string, Record<string, string | number | boolean>]>;
  };
  if (analyticsWindow.ownedPortfolioTrack) {
    return analyticsWindow.ownedPortfolioTrack(name, properties);
  }
  (analyticsWindow.ownedPortfolioQueue ||= []).push([name, properties]);
  return true;
}
