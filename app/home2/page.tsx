import LandingHtml from '@/components/LandingHtml';

export const dynamic = 'force-dynamic';

// Design variation B (preview). Public and always rendered so it can be compared
// against / and /home3.
export default function Home2() {
  return <LandingHtml file="landing2.html" id="keel-root" />;
}
