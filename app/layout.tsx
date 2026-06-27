import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import AppShell from '@/components/AppShell';
import PWARegister from '@/components/PWARegister';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tzLabel } from '@/lib/schedule';
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

  // Distinct timezones the team spans, minus the viewer's own — shown as live
  // header clocks so people across timezones can see each other's local time.
  let teamZones: { tz: string; label: string }[] = [];
  if (user) {
    const [me, others] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, select: { timezone: true } }),
      prisma.user.findMany({ where: { timezone: { not: null }, NOT: { id: user.id } }, select: { timezone: true }, distinct: ['timezone'] }),
    ]);
    const seen = new Set<string>();
    teamZones = others
      .map((o) => o.timezone as string)
      .filter((tz) => tz && tz !== me?.timezone && !seen.has(tz) && (seen.add(tz), true))
      .map((tz) => ({ tz, label: tzLabel(tz) }));
  }

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <AppShell user={user} attendance={attendance} teamZones={teamZones}>{children}</AppShell>
        <PWARegister />
      </body>
    </html>
  );
}
