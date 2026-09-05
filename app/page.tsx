import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LandingHtml from '@/components/LandingHtml';

export const dynamic = 'force-dynamic';

// The public marketing landing page lives at the root URL. Signed-in users are
// sent straight to their dashboard; everyone else sees the pitch.
export default async function Home() {
  const session = await getSession();
  if (session) redirect('/dashboard');
  return <LandingHtml file="landing.html" />;
}
