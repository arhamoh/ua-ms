import { prisma } from '@/lib/prisma';
import { createTeamMember, deleteUser } from '@/app/actions';
import { ROLES, ROLE_LABELS } from '@/lib/enums';
import RowActions from '@/components/RowActions';
import AnimatedButton from '@/components/AnimatedButton';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const members = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Team</h1>
      <p className="mt-1 text-sm text-slate-500">
        Add team members and their roles. A person can hold multiple roles.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Add member */}
        <div className="lg:col-span-1">
          <form
            action={createTeamMember}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-sm font-semibold">Add team member</h2>

            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Name *</span>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                placeholder="Jane Doe"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Email *</span>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                placeholder="jane@agency.com"
              />
            </label>

            <span className="mb-1 block text-xs font-medium text-slate-600">Roles</span>
            <div className="mb-5 space-y-2">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="roles" value={r} className="rounded border-slate-300" />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>

            <AnimatedButton
              type="submit"
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Add member
            </AnimatedButton>
          </form>
        </div>

        {/* Member list */}
        <div className="lg:col-span-2">
          {members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No team members yet. Add your first one using the form.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Roles</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-slate-600">{m.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.roles.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            m.roles.map((r) => (
                              <span
                                key={r}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                              >
                                {ROLE_LABELS[r] ?? r}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          editHref={`/team/${m.id}/edit`}
                          deleteAction={deleteUser.bind(null, m.id)}
                          label="member"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
