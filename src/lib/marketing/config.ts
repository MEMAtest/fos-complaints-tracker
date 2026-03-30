const configuredAppOrigin = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim().replace(/\/$/, '') || '';

export function getWorkspaceEntryHref(): string {
  return configuredAppOrigin ? `${configuredAppOrigin}/workspace` : '/workspace';
}

export function getAppHref(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return configuredAppOrigin ? `${configuredAppOrigin}${normalizedPath}` : normalizedPath;
}

export function getAppBaseUrl(): string {
  return configuredAppOrigin || '/';
}
