import type { Metadata } from 'next';
import { Manrope, Sora } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
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
  title: 'FOS Complaints Intelligence | MEMA Consultants',
  description:
    'Search-first analytics for Financial Ombudsman decisions with yearly trend analysis, drill-down insights, and full case detail.',
  keywords: [
    'financial ombudsman',
    'FOS complaints',
    'complaints analytics',
    'adjudication intelligence',
    'MEMA consultants',
  ],
  authors: [{ name: 'MEMA Consultants' }],
  openGraph: {
    title: 'FOS Complaints Intelligence',
    description: 'Interactive analytics and precedent intelligence for Financial Ombudsman decisions.',
    url: 'https://foscomplaints.memaconsultants.com',
    siteName: 'FOS Complaints Tracker',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FOS Complaints Intelligence',
    description: 'Interactive analytics and precedent intelligence for Financial Ombudsman decisions.',
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
        <link rel="icon" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f1f4f" />
      </head>
      <body className={`${bodyFont.variable} ${headingFont.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
