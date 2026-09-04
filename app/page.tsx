import { readFileSync } from 'fs';
import { join } from 'path';
import Script from 'next/script';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// The public marketing landing page lives at the root URL. Signed-in users are
// sent straight to their dashboard; everyone else sees the pitch. The page markup
// is authored as a self-contained HTML file in lib/landing.html (fonts + <style> +
// body + <script>) and spliced in here so it can be edited as plain HTML.
export default async function Home() {
  const session = await getSession();
  if (session) redirect('/dashboard');

  const raw = readFileSync(join(process.cwd(), 'lib/landing.html'), 'utf8');
  const css = raw.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const js = raw.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
  const fontHref = raw.match(/<link rel="stylesheet" href="(https:\/\/fonts[^"]+)"/)?.[1] ?? '';
  const startTag = '</style>';
  const body = raw
    .slice(raw.indexOf(startTag) + startTag.length, raw.indexOf('<script>'))
    .trim();

  return (
    <div id="keel-root">
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
      <Script id="keel-landing" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: js }} />
    </div>
  );
}
