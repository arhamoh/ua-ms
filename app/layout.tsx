import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import AppShell from '@/components/AppShell';
import PWARegister from '@/components/PWARegister';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageAgencyHours } from '@/lib/enums';
import './globals.css';

export const metadata: Metadata = {
  title: 'Keel',
  description: 'The operating system your agency runs on.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Keel',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F5B57',
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

  // Partner-agency clocks for privileged roles (super admin / manager / PM) —
  // appended after the core Montreal/Karachi clocks in the header. Everyone else
  // gets none (TeamClocks still shows the core zones for them).
  let agencyZones: { tz: string; label: string; days: number[]; startMin: number; endMin: number }[] = [];
  if (user && canManageAgencyHours(user.roles)) {
    const agencies = await prisma.agencySchedule.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, timezone: true, days: true, startMin: true, endMin: true },
    });
    agencyZones = agencies.map((a) => ({ tz: a.timezone, label: a.name, days: a.days, startMin: a.startMin, endMin: a.endMin }));
  }

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/* Space Grotesk powers the Keel wordmark. Loaded at runtime (not via
            next/font) so the production build never depends on a font fetch. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <AppShell user={user} attendance={attendance} agencyZones={agencyZones}>{children}</AppShell>
        <PWARegister />
      </body>
    </html>
  );
}
