import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import AppShell from '@/components/AppShell';
import { getSession } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'UA Agency Platform',
  description: 'Project management platform for the agency',
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
      </body>
    </html>
  );
}
