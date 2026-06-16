import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { updateUser } from '@/app/actions';
import { ROLES, ROLE_LABELS } from '@/lib/enums';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

export default async function EditTeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.user.findUnique({ where: { id } });
  if (!member) notFound();

  return (
    <div>
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700">
        <ArrowLeft size={14} /> Team
      </Link>
      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-bold tracking-tight">Edit team member</h1>
        <p className="mt-1 text-sm text-slate-500">Update name, email and roles.</p>
      </div>

      <form action={updateUser} className="max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="userId" value={member.id} />

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Name *</span>
          <input name="name" required defaultValue={member.name ?? ''} className={inputCls} placeholder="Jane Doe" />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Email *</span>
          <input name="email" type="email" required defaultValue={member.email ?? ''} className={inputCls} placeholder="jane@agency.com" />
        </label>

        <span className="mb-1 block text-xs font-medium text-slate-600">Roles</span>
        <div className="mb-5 space-y-2">
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="roles"
                value={r}
                defaultChecked={(member.roles as string[]).includes(r)}
                className="rounded border-slate-300"
              />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/team" className="rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
