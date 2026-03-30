const configuredAppBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim().replace(/\/$/, '') || '';

export function getAppHref(path = '/'): string {
  const normalizedPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;

  if (configuredAppBaseUrl) {
    return `${configuredAppBaseUrl}${normalizedPath}`;
  }

  return path === '/' ? '/workspace' : normalizedPath || '/workspace';
}

export function getAppBaseUrl(): string {
  return configuredAppBaseUrl || '/workspace';
}
