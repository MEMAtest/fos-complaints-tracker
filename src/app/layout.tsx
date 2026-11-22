import type { Metadata } from 'next';
import { Manrope, Sora } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '@/components/auth/auth-provider';
import { SidebarLayout } from '@/components/layout/sidebar-layout';
import './globals.css';

const headingFont = Sora({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600', '700'],
});

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://regcomplaints.com'),
  title: 'RegComplaints | UK FOS Complaints & Ombudsman Intelligence',
  description:
    'Ombudsman insight. Decisive resolution. Search-first precedent analytics for Financial Ombudsman decisions with yearly trend analysis, outcome estimation, and full case detail.',
  keywords: [
    'RegComplaints',
    'financial ombudsman',
    'FOS complaints',
    'complaints analytics',
    'adjudication intelligence',
    'MEMA consultants',
  ],
  authors: [{ name: 'RegComplaints — MEMA Consultants' }],
  openGraph: {
    title: 'RegComplaints | UK FOS Complaints & Ombudsman Intelligence',
    description: 'Ombudsman insight. Decisive resolution. Interactive analytics and precedent intelligence for Financial Ombudsman decisions.',
    url: 'https://regcomplaints.com',
    siteName: 'RegComplaints',
    type: 'website',
    images: [
      {
        url: '/images/brand/regcomplaints-og.png',
        width: 1200,
        height: 630,
        alt: 'RegComplaints - ombudsman insight. Decisive resolution.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RegComplaints | UK FOS Complaints & Ombudsman Intelligence',
    description: 'Ombudsman insight. Decisive resolution. Interactive analytics and precedent intelligence for Financial Ombudsman decisions.',
    images: ['/images/brand/regcomplaints-og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico?v=2" sizes="16x16 32x32 48x48" />
        <link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml" />
        <link rel="icon" type="image/png" href="/images/favicon.png?v=2" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png?v=2" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#08162f" />
      </head>
      <body className={`${bodyFont.variable} ${headingFont.variable} antialiased`}>
        <AuthProvider>
          <SidebarLayout>
            {children}
          </SidebarLayout>
        </AuthProvider>
        {process.env.VERCEL === '1' ? <Analytics /> : null}
        {process.env.DISABLE_OWNED_ANALYTICS !== '1' ? <script
          defer
          src="https://owned-portfolio-analytics.mema-consultants.workers.dev/tracker.js"
          data-project="fos-complaints-tracker"
        /> : null}
      </body>
    </html>
  );
}
