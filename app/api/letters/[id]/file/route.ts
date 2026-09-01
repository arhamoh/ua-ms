import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

// Streams a letter's original file inline (super admins only). ?dl=1 downloads.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!session.roles.includes('SUPER_ADMIN')) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const letter = await prisma.letter.findUnique({ where: { id } });
  if (!letter) return new NextResponse('Not found', { status: 404 });

  const bytes = letter.data as unknown as Buffer;
  const disposition = req.nextUrl.searchParams.get('dl') ? 'attachment' : 'inline';
  const safeName = letter.fileName.replace(/[\r\n"]/g, '');

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': letter.mimeType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
