import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { createTeamMember, deleteUser } from '@/app/actions';
import { ROLES } from '@/lib/enums';
import { roleLabelFor, isSuperStrict } from '@/lib/permissions';
import RowActions from '@/components/RowActions';
import AnimatedButton from '@/components/AnimatedButton';
import TableTools from '@/components/TableTools';
import RolesOverview from '@/components/RolesOverview';
import TeamTabs from '@/components/TeamTabs';
import NewMemberBanner from '@/components/NewMemberBanner';
import ResendWelcomeButton from '@/components/ResendWelcomeButton';
import { takeCredentials } from '@/lib/pending-credentials';

export const dynamic = 'force-dynamic';

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await getSession();
  const viewerRoles = session?.roles ?? [];
  const viewerIsSuper = isSuperStrict(viewerRoles);
  // One-time credentials for a member the admin just added (email is off in dev).
  const sp = await searchParams;
  const justCreated = sp?.created === '1' && session ? takeCredentials(session.id) : null;
  const members = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const roleCounts: Record<string, number> = {};
  for (const m of members) for (const r of m.roles) roleCounts[r] = (roleCounts[r] ?? 0) + 1;
  // A non-super viewer (Admin) can't create Super Admins and sees them as "Admin".
  const assignableRoles = ROLES.filter((r) => viewerIsSuper || r !== 'SUPER_ADMIN');

  const membersSection = (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
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

            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Username <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                name="username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                placeholder="Leave blank to use their email"
              />
              <span className="mt-1 block text-[11px] text-slate-400">They can sign in with this or their email.</span>
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Temporary password <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                name="tempPassword"
                type="text"
                minLength={8}
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                placeholder="Leave blank to auto-generate"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                They’ll be asked to set their own password the first time they sign in.
              </span>
            </label>

            <span className="mb-1 block text-xs font-medium text-slate-600">Roles</span>
            <div className="mb-5 space-y-2">
              {assignableRoles.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="roles" value={r} className="rounded border-slate-300" />
                  {roleLabelFor(r, viewerRoles)}
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
            <TableTools searchPlaceholder="Search members…">
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
                                {roleLabelFor(r, viewerRoles)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {m.mustChangePassword && <ResendWelcomeButton userId={m.id} />}
                          <RowActions
                            editHref={`/team/${m.id}/edit`}
                            deleteAction={deleteUser.bind(null, m.id)}
                            label="member"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </TableTools>
          )}
        </div>
    </div>
  );

  const rolesSection = viewerIsSuper ? (
    <RolesOverview roleCounts={roleCounts} viewerIsSuper={viewerIsSuper} />
  ) : null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Team</h1>
      <p className="mt-1 text-sm text-slate-500">
        Add team members and their roles. A person can hold multiple roles.
      </p>

      {justCreated && (
        <NewMemberBanner
          userId={justCreated.userId}
          name={justCreated.name}
          username={justCreated.username}
          tempPassword={justCreated.tempPassword}
          loginUrl={justCreated.loginUrl}
          emailed={justCreated.emailed}
        />
      )}

      <TeamTabs members={membersSection} roles={rolesSection} />
    </div>
  );
}
