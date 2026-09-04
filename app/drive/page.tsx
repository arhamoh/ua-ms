import Link from 'next/link';
import { HardDrive, Plug } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { driveConfigured } from '@/lib/drive';
import DriveBrowser from '@/components/DriveBrowser';

export const dynamic = 'force-dynamic';

export default async function DrivePage() {
  const me = await getSession();
  if (!me) return null;
  const canProvision = !!me.roles?.includes('SUPER_ADMIN');
  const privileged = me.roles?.some((r) => ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'PROJECT_MANAGER'].includes(r));
  const connected = driveConfigured();
  const people = connected ? await prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Drive</h1>
      <p className="mt-1 text-sm text-slate-500">Browse project files, and tag a teammate on any file to share it with them.</p>

      {!connected ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <HardDrive size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">Google Drive isn’t connected yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Connect Google in Settings → Integrations to browse files and organize client/project folders here.</p>
          <Link href="/settings" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">
            <Plug size={15} /> Go to Integrations
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <DriveBrowser people={people} canProvision={canProvision} rootLabel={privileged ? 'My Drive' : 'My Projects'} />
        </div>
      )}
    </div>
  );
}
