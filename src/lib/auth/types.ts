export const APP_USER_ROLES = ['viewer', 'operator', 'reviewer', 'manager', 'admin'] as const;

export type AppUserRole = typeof APP_USER_ROLES[number];

export interface AuthenticatedAppUser {
  id: string;
  email: string;
  fullName: string;
  role: AppUserRole;
}

export interface AuthSession {
  id: string;
  user: AuthenticatedAppUser;
  expiresAt: string;
  lastSeenAt: string;
}

export interface BootstrapAuthUser {
  email: string;
  fullName: string;
  role: AppUserRole;
  password?: string;
  passwordHash?: string;
}
