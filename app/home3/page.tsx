import LandingHtml from '@/components/LandingHtml';

export const dynamic = 'force-dynamic';

// Design variation C (preview) — more motion and imagery. Public and always
// rendered so it can be compared against / and /home2.
export default function Home3() {
  return <LandingHtml file="landing3.html" id="keel-root" />;
}
