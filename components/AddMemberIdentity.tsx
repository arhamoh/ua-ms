'use client';

import { useState } from 'react';

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none';
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '');

// First/last name inputs that auto-generate a `firstname.lastname` username
// (editable). Submits firstName, lastName, username and whether it was edited.
export default function AddMemberIdentity() {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [username, setUsername] = useState('');
  const [touched, setTouched] = useState(false);

  const auto = [slug(first), slug(last)].filter(Boolean).join('.');
  const value = touched ? username : auto;

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">First name *</span>
          <input name="firstName" required value={first} onChange={(e) => setFirst(e.target.value)} className={inputCls} placeholder="Jane" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Last name</span>
          <input name="lastName" value={last} onChange={(e) => setLast(e.target.value)} className={inputCls} placeholder="Doe" />
        </label>
      </div>

      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Username <span className="font-normal text-slate-400">(auto from name)</span>
        </span>
        <input
          name="username"
          value={value}
          onChange={(e) => { setTouched(true); setUsername(e.target.value); }}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          className={inputCls}
          placeholder="firstname.lastname"
        />
        <input type="hidden" name="usernameTouched" value={touched ? '1' : '0'} />
        <span className="mt-1 block text-[11px] text-slate-400">They can sign in with this or their email. Edit it to override.</span>
      </label>
    </>
  );
}
