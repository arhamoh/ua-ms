import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { extractPdfText, analyzeLetterText, analyzeLetterImage, type LetterAnalysis } from '@/lib/letters';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

// Upload a letter/document → extract + AI-analyze (translate, summarize, pull
// tasks) → create the Letter and its task board. Super admins only.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!session.roles.includes('SUPER_ADMIN')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith('image/');
  const mimeType = file.type || (isPdf ? 'application/pdf' : 'application/octet-stream');

  let analysis: LetterAnalysis | null = null;
  let originalText: string | null = null;
  let errorNote: string | null = null;

  try {
    if (isPdf) {
      const text = await extractPdfText(buffer);
      originalText = text || null;
      if (text.length < 20) {
        errorNote = 'This looks like a scanned PDF with no selectable text — upload a photo/image of it for AI reading, or add tasks manually.';
      } else if (!process.env.OPENROUTER_API_KEY) {
        errorNote = 'AI is not configured (OPENROUTER_API_KEY) — add tasks manually.';
      } else {
        analysis = await analyzeLetterText(text);
        if (!analysis) errorNote = 'AI analysis failed — you can add tasks manually.';
      }
    } else if (isImage) {
      if (!process.env.OPENROUTER_API_KEY) {
        errorNote = 'AI is not configured (OPENROUTER_API_KEY) — add tasks manually.';
      } else {
        const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        analysis = await analyzeLetterImage(dataUrl);
        if (!analysis) errorNote = 'AI analysis failed — you can add tasks manually.';
      }
    } else {
      errorNote = 'Unsupported file type — upload a PDF or an image.';
    }
  } catch (e: any) {
    errorNote = `Could not analyze the document (${e?.message?.slice(0, 120) ?? 'unknown error'}).`;
  }

  const letter = await prisma.letter.create({
    data: {
      title: analysis?.title || file.name.replace(/\.[^.]+$/, ''),
      sender: analysis?.sender ?? null,
      reference: analysis?.reference ?? null,
      docDate: analysis?.docDate ? new Date(analysis.docDate) : null,
      dueDate: analysis?.dueDate ? new Date(analysis.dueDate) : null,
      language: analysis?.language ?? 'en',
      summary: analysis?.summary ?? null,
      translation: analysis?.translation ?? null,
      originalText,
      status: analysis ? 'READY' : 'FAILED',
      errorNote,
      fileName: file.name,
      mimeType,
      size: file.size,
      data: buffer,
      createdById: session.id,
      tasks: analysis?.tasks?.length
        ? {
            create: analysis.tasks.map((t, i) => ({
              title: t.title,
              detail: t.detail,
              dueDate: t.dueDate ? new Date(t.dueDate) : null,
              order: i,
            })),
          }
        : undefined,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: letter.id, taskCount: analysis?.tasks?.length ?? 0, note: errorNote });
}
