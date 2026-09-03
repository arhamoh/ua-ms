import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVapidPublicKey } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The public VAPID key the browser needs to create a push subscription.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const key = await getVapidPublicKey();
  if (!key) return NextResponse.json({ error: 'push not available' }, { status: 503 });
  return NextResponse.json({ key });
}
