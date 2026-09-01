import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

// Streams an archived statement's bytes so it opens/views inside the platform.
// Add ?dl=1 to force a download instead of inline preview.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const st = await prisma.statement.findUnique({ where: { id } });
  if (!st) return new NextResponse('Not found', { status: 404 });

  const bytes = st.data as unknown as Buffer;
  const disposition = req.nextUrl.searchParams.get('dl') ? 'attachment' : 'inline';
  const safeName = st.fileName.replace(/[\r\n"]/g, '');

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': st.mimeType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
