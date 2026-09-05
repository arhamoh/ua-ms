import { readFileSync } from 'fs';
import { join } from 'path';
import Script from 'next/script';

// Renders a self-contained marketing HTML file (fonts + <style> + body +
// <script>, authored in lib/<file>) inside the Next app shell. The file is
// spliced so it can be edited as plain HTML; the <script> is run via next/script
// so its interactions execute after hydration.
export default function LandingHtml({ file, id = 'keel-root' }: { file: string; id?: string }) {
  const raw = readFileSync(join(process.cwd(), 'lib', file), 'utf8');
  const css = raw.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const js = raw.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
  const fontHref = raw.match(/<link rel="stylesheet" href="(https:\/\/fonts[^"]+)"/)?.[1] ?? '';
  const startTag = '</style>';
  const hasScript = raw.includes('<script>');
  const body = raw
    .slice(raw.indexOf(startTag) + startTag.length, hasScript ? raw.indexOf('<script>') : undefined)
    .trim();

  return (
    <div id={id}>
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
      {js && <Script id={`${id}-js`} strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: js }} />}
    </div>
  );
}
