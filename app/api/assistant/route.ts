import { NextResponse } from 'next/server';
import { buildAssistantContext } from '@/lib/assistant';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ reply: 'Please sign in.' }, { status: 401 });

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

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const model = process.env.OPENROUTER_MODEL || 'moonshotai/kimi-k2';
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
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 900,
        temperature: 0.3,
        usage: { include: true }, // ask OpenRouter to return token + cost accounting
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ reply: `Assistant error (${res.status}). ${t.slice(0, 160)}` });
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? 'No response.';
    const usage = data?.usage ?? {};
    const promptTokens = Number(usage.prompt_tokens ?? 0) || 0;
    const completionTokens = Number(usage.completion_tokens ?? 0) || 0;
    const costUsd = Number(usage.cost ?? 0) || 0;

    // Persist the exchange (best-effort — never block the reply on a write error).
    try {
      if (lastUser?.content) {
        await prisma.assistantMessage.create({
          data: { userId: session.id, role: 'user', content: lastUser.content.slice(0, 8000) },
        });
      }
      await prisma.assistantMessage.create({
        data: {
          userId: session.id,
          role: 'assistant',
          content: String(reply).slice(0, 12000),
          promptTokens,
          completionTokens,
          costUsd,
          model,
        },
      });
    } catch {
      /* ignore persistence errors */
    }

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: `Assistant failed: ${e?.message ?? 'unknown error'}` });
  }
}
