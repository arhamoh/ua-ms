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
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <AppShell user={user} attendance={attendance} agencyZones={agencyZones}>{children}</AppShell>
        <PWARegister />
      </body>
    </html>
  );
}
