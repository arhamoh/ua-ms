'use server';

import { redirect } from 'next/navigation';
import { changePassword } from '@/app/actions';

export type ChangePwState = { error?: string };

/** First-login password reset. Validates the confirmation, then delegates to
 *  changePassword (which clears the must-change flag and refreshes the session). */
export async function submitNewPassword(
  _prev: ChangePwState,
  formData: FormData,
): Promise<ChangePwState> {
  const password = (formData.get('password') ?? '').toString();
  const confirm = (formData.get('confirm') ?? '').toString();

  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { error: 'The two passwords don’t match.' };

  const res = await changePassword(password);
  if (!res.ok) return { error: res.message };

  redirect('/');
}
