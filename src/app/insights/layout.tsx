import { PublicInsightsShell } from '@/components/insights/public-insights-shell';

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return <PublicInsightsShell>{children}</PublicInsightsShell>;
}
