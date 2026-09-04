'use client';

import { useState, type ReactNode } from 'react';
import { Users, ShieldCheck } from 'lucide-react';

// Tabs for the Team page: "Members" is the main view (list + add form); "Role
// access" is a Super-Admin-only overview passed in as `roles` (null hides the
// tab entirely, so everyone else just sees Members with no tab bar).
export default function TeamTabs({ members, roles }: { members: ReactNode; roles: ReactNode | null }) {
  const [tab, setTab] = useState<'members' | 'roles'>('members');

  if (!roles) return <div className="mt-6">{members}</div>;

  return (
    <div className="mt-6">
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'members'} onClick={() => setTab('members')}>
          <Users size={15} /> Members
        </TabButton>
        <TabButton active={tab === 'roles'} onClick={() => setTab('roles')}>
          <ShieldCheck size={15} /> Role access
        </TabButton>
      </div>
      <div className="mt-6">
        <div hidden={tab !== 'members'}>{members}</div>
        <div hidden={tab !== 'roles'}>{roles}</div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-brand text-brand'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}
