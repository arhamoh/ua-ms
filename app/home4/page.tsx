import LandingHtml from '@/components/LandingHtml';

export const dynamic = 'force-dynamic';

// Design variation D (preview) — the original dark-green hero direction. Public
// and always rendered so it can be compared against /, /home2 and /home3.
export default function Home4() {
  return <LandingHtml file="landing4.html" id="keel-root" />;
}
