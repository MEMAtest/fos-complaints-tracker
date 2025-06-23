import type { Metadata } from 'next'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"; // Add this import

export const metadata: Metadata = {
  title: 'Financial Complaints Dashboard | MEMA Consultants',
  description: 'Comprehensive analysis of complaint resolution performance across financial firms. Live data from regulatory reporting requirements.',
  keywords: 'financial complaints, FCA, regulatory compliance, complaint resolution, financial services',
  authors: [{ name: 'MEMA Consultants' }],
  openGraph: {
    title: 'Financial Complaints Dashboard',
    description: 'Comprehensive analysis of complaint resolution performance across financial firms',
    url: 'https://foscomplaints.memaconsultants.com',
    siteName: 'FOS Complaints Tracker',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Financial Complaints Dashboard',
    description: 'Comprehensive analysis of complaint resolution performance across financial firms',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#3b82f6" />
      </head>
      <body className="antialiased">
        {children}
        <Analytics /> {/* Add this component inside the body */}
      </body>
    </html>
  )
}