import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { driveConfigured, downloadDriveFile } from '@/lib/drive';

export const runtime = 'nodejs';

// Streams a message attachment from Drive — but only to a member of the
// conversation it belongs to. Lets images render inline as thumbnails.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !driveConfigured()) return new NextResponse('Bad request', { status: 400 });

  // The attachment must belong to a message in a conversation this user is in.
  const msg = await prisma.message.findFirst({ where: { attachmentUrl: { contains: id } }, select: { conversationId: true } });
  if (!msg) return new NextResponse('Not found', { status: 404 });
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: msg.conversationId, userId: session.id } },
    select: { id: true },
  });
  if (!member) return new NextResponse('Forbidden', { status: 403 });

  const file = await downloadDriveFile(id);
  if (!file) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: { 'Content-Type': file.mimeType, 'Cache-Control': 'private, max-age=3600' },
  });
}
