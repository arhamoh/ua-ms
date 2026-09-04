import { Fragment } from 'react';
import { ShieldCheck, Check, Minus } from 'lucide-react';
import { ROLE_ORDER, ROLE_DESCRIPTIONS, AREAS, roleLabel, roleCanAccess } from '@/lib/permissions';

// A read-only overview of the user types and what each can access. Backed by the
// central permissions map (lib/permissions.ts) — change that file to change this.
export default function RolesOverview({ roleCounts }: { roleCounts: Record<string, number> }) {
  const groups = Array.from(new Set(AREAS.map((a) => a.group)));

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-brand" />
        <h2 className="text-sm font-semibold">Roles &amp; access</h2>
        <span className="text-xs text-slate-400">The types of user in your company and what each can reach</span>
      </div>

      {/* Role cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_ORDER.map((r) => (
          <div key={r} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">{roleLabel(r)}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {roleCounts[r] ?? 0} {(roleCounts[r] ?? 0) === 1 ? 'member' : 'members'}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{ROLE_DESCRIPTIONS[r]}</p>
          </div>
        ))}
      </div>

      {/* Access matrix */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-4 font-medium">Area</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} className="px-2 py-2 text-center font-medium">{roleLabel(r).replace('Project Manager', 'PM').replace('Super Admin', 'Super')}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((g) => (
              <Fragment key={g}>
                <tr className="bg-slate-50/60">
                  <td colSpan={ROLE_ORDER.length + 1} className="px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g}</td>
                </tr>
                {AREAS.filter((a) => a.group === g).map((a) => (
                  <tr key={a.key} className="hover:bg-slate-50/60">
                    <td className="py-2 pr-4 text-slate-700">{a.label}</td>
                    {ROLE_ORDER.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        {roleCanAccess(r, a)
                          ? <Check size={15} className="mx-auto text-emerald-600" />
                          : <Minus size={14} className="mx-auto text-slate-300" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        A green check means that role can access the area. Everyone signed in gets the “all” areas; the differences are the admin-gated rows.
      </p>
    </section>
  );
}
