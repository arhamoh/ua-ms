import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { extractPdfText, analyzeLetterText, analyzeLetterImage, type LetterAnalysis } from '@/lib/letters';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Bump this when the route changes so a live GET can confirm what's deployed.
const VERSION = 'letters-v4';
const MAX_BYTES = 15 * 1024 * 1024;

// A valid Date from a YYYY-MM-DD string, or null — never throws on bad AI dates.
const safeDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Diagnostics: visit /api/letters in the browser to see which build is live and
// whether the AI key is configured.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ version: VERSION, openrouter: !!process.env.OPENROUTER_API_KEY });
}

// Upload a letter/document → extract + AI-analyze (translate, summarize, pull
// tasks) → create the Letter and its task board. Super admins only.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'unauthorized', version: VERSION }, { status: 401 });
    if (!session.roles.includes('SUPER_ADMIN')) return NextResponse.json({ error: 'forbidden', version: VERSION }, { status: 403 });

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: 'bad_request', version: VERSION }, { status: 400 });
    }
    // Duck-type the upload — the `File` global isn't available in every Node
    // route-handler runtime, so `instanceof File` can throw "File is not defined".
    const file = form.get('file') as { arrayBuffer?: () => Promise<ArrayBuffer>; size?: number; name?: string; type?: string } | null;
    if (!file || typeof file.arrayBuffer !== 'function' || !file.size) return NextResponse.json({ error: 'no_file', version: VERSION }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large', version: VERSION }, { status: 400 });
    const fileName = typeof file.name === 'string' && file.name ? file.name : 'document';
    const fileType = typeof file.type === 'string' ? file.type : '';

    const arrayBuf = await file.arrayBuffer().catch(() => null);
    if (!arrayBuf) return NextResponse.json({ error: 'read', detail: 'Could not read the file.', version: VERSION }, { status: 400 });
    const buffer = Buffer.from(arrayBuf);
    const isPdf = fileType === 'application/pdf' || /\.pdf$/i.test(fileName);
    const isImage = fileType.startsWith('image/');
    const mimeType = fileType || (isPdf ? 'application/pdf' : 'application/octet-stream');

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
        title: analysis?.title || fileName.replace(/\.[^.]+$/, ''),
        sender: analysis?.sender ?? null,
        reference: analysis?.reference ?? null,
        docDate: safeDate(analysis?.docDate),
        dueDate: safeDate(analysis?.dueDate),
        language: analysis?.language ?? 'en',
        summary: analysis?.summary ?? null,
        translation: analysis?.translation ?? null,
        originalText,
        status: analysis ? 'READY' : 'FAILED',
        errorNote,
        fileName,
        mimeType,
        size: file.size,
        data: buffer,
        createdById: session.id,
        tasks: analysis?.tasks?.length
          ? {
              create: analysis.tasks.map((t, i) => ({
                title: t.title,
                titleFr: t.titleFr,
                detail: t.detail,
                detailFr: t.detailFr,
                dueDate: safeDate(t.dueDate),
                order: i,
              })),
            }
          : undefined,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: letter.id, taskCount: analysis?.tasks?.length ?? 0, note: errorNote, version: VERSION });
  } catch (e: any) {
    console.error('POST /api/letters failed', e);
    return NextResponse.json(
      { error: 'server', detail: e?.message?.slice(0, 400) ?? 'Unknown server error.', version: VERSION },
      { status: 500 },
    );
  }
}
