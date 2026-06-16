import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import AppShell from '@/components/AppShell';
import PWARegister from '@/components/PWARegister';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

  // Open check-in session (if any) so the header timer reflects check-ins made
  // anywhere — it re-syncs whenever a route calls router.refresh().
  const openEntry = user
    ? await prisma.timeEntry.findFirst({
        where: { userId: user.id, checkOutAt: null },
        orderBy: { checkInAt: 'desc' },
        select: { checkInAt: true },
      })
    : null;
  const attendance = { open: !!openEntry, checkInAt: openEntry ? openEntry.checkInAt.toISOString() : null };

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <AppShell user={user} attendance={attendance}>{children}</AppShell>
        <PWARegister />
      </body>
    </html>
  );
}
