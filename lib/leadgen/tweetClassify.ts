import { prisma } from '@/lib/prisma';

/**
 * Scores tweets for how good a sales lead they are for UA Digital, and LEARNS
 * from the user's Relevant/Not-relevant labels: those tweets are fed back to the
 * model as few-shot examples, so scoring drifts toward the user's taste over time.
 */

export type TweetVerdict = { score: number; reason: string };

const clampScore = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/** Pull the user's most recent labelled tweets to teach the model their taste. */
async function fewShotExamples(perLabel = 12): Promise<{ yes: string[]; no: string[] }> {
  const [yes, no] = await Promise.all([
    prisma.tweetLead.findMany({ where: { relevance: 'yes' }, orderBy: { updatedAt: 'desc' }, take: perLabel, select: { text: true } }),
    prisma.tweetLead.findMany({ where: { relevance: 'no' }, orderBy: { updatedAt: 'desc' }, take: perLabel, select: { text: true } }),
  ]);
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 240);
  return { yes: yes.map((t) => clean(t.text)), no: no.map((t) => clean(t.text)) };
}

function buildSystem(ex: { yes: string[]; no: string[] }): string {
  let s = `You qualify tweets as sales leads for "UA Digital", a Montreal-based digital agency offering web design & development (websites, redesigns, Shopify/Webflow), branding, SEO, and paid ads (English and French).

A GOOD lead is someone expressing genuine intent/need we could win: asking for a web designer/developer/agency, wanting a new or rebuilt website/store, needing branding/SEO/ads help, or hiring for that. A BAD lead is: other agencies/freelancers advertising their own services, job seekers, recruiters, crypto/spam, news, or unrelated chatter.

Score each tweet 0-100 for how strong a lead it is (100 = obvious ready-to-buy prospect). Give a terse (<=12 word) reason.`;

  if (ex.yes.length || ex.no.length) {
    s += `\n\nThe user has reviewed past tweets. Match their taste:`;
    if (ex.yes.length) s += `\nRELEVANT examples:\n${ex.yes.map((t) => `- ${t}`).join('\n')}`;
    if (ex.no.length) s += `\nNOT-relevant examples:\n${ex.no.map((t) => `- ${t}`).join('\n')}`;
  }

  s += `\n\nReturn ONLY a JSON object: {"results":[{"i":<index>,"score":<0-100>,"reason":"..."}]} covering every candidate index.`;
  return s;
}

/** Best-effort batch scoring. Returns a map keyed by the input id; missing ids stay unscored. */
export async function classifyTweets(items: { id: string; text: string }[]): Promise<Map<string, TweetVerdict>> {
  const out = new Map<string, TweetVerdict>();
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key || items.length === 0) return out;

  const ex = await fewShotExamples();
  const system = buildSystem(ex);
  const list = items.map((it, i) => `${i}. ${it.text.replace(/\s+/g, ' ').trim().slice(0, 280)}`).join('\n');
  const model = process.env.OPENROUTER_MODEL || 'moonshotai/kimi-k2';

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Keel' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Candidates:\n${list}` },
        ],
        max_tokens: 1200,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return out;
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const jsonStr = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonStr);
    const results: any[] = parsed?.results ?? parsed?.data ?? [];
    for (const r of results) {
      const i = Number(r?.i ?? r?.index);
      if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
      out.set(items[i].id, { score: clampScore(r.score), reason: String(r.reason ?? '').slice(0, 160) });
    }
  } catch {
    /* leave unscored on any failure */
  }
  return out;
}
