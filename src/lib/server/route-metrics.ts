type RouteMetric = {
  route: string;
  method: string;
  status: number;
  durationMs: number;
  actor?: string | null;
  detail?: Record<string, unknown>;
};

export function logRouteMetric(metric: RouteMetric) {
  const payload = {
    at: new Date().toISOString(),
    ...metric,
  };
  console.info(`[route-metric] ${JSON.stringify(payload)}`);
}
