import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const rawNext = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const nextPath = typeof rawNext === 'string' && rawNext.startsWith('/') ? rawNext : '/complaints';
  return <LoginForm nextPath={nextPath} />;
}
