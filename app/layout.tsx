import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import AppShell from '@/components/AppShell';
import PWARegister from '@/components/PWARegister';
import { getSession } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'UA Digital',
  description: 'Project management platform for the agency',
  icons: { icon: '/logo.png', apple: '/logo.png' },
  appleWebApp: {
    capable: true,
    title: 'UA Digital',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#E11D48',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <AppShell user={user}>{children}</AppShell>
        <PWARegister />
      </body>
    </html>
  );
}
