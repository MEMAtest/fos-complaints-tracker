import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawNext = Array.isArray(resolvedSearchParams?.next) ? resolvedSearchParams.next[0] : resolvedSearchParams?.next;
  const nextPath = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : '/complaints';
  return <LoginForm nextPath={nextPath} />;
}
