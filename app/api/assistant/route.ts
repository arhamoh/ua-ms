import { NextResponse } from 'next/server';
import { buildAssistantContext } from '@/lib/assistant';

export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({
      reply: 'The analytics assistant isn’t configured yet. Add OPENROUTER_API_KEY in Railway to enable it.',
    });
  }

  let messages: ChatMessage[] = [];
  try {
    const body = await req.json();
    messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  } catch {
    return NextResponse.json({ reply: 'Invalid request.' }, { status: 400 });
  }

  const context = await buildAssistantContext();
  const system = `You are the analytics assistant for "UA Agency", a digital agency project-management platform. Answer the user's questions concisely and helpfully using ONLY the live data snapshot below (all amounts already in CAD). If something isn't in the data, say you don't have that data. Prefer short, direct answers with concrete numbers. Today's data snapshot (JSON):\n\n${context}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'UA Agency Platform',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'moonshotai/kimi-k2',
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 900,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ reply: `Assistant error (${res.status}). ${t.slice(0, 160)}` });
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? 'No response.';
    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: `Assistant failed: ${e?.message ?? 'unknown error'}` });
  }
}
