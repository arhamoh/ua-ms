import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { driveConfigured, uploadToDrive } from '@/lib/drive';
import { FILE_CATEGORY_LABELS } from '@/lib/enums';

// Project file upload via XHR so the client can show real upload progress.
// Mirrors the uploadProjectFile server action but returns JSON.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!driveConfigured()) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 400 });

  const form = await req.formData();
  const projectId = String(form.get('projectId') ?? '');
  const category = String(form.get('category') ?? 'OTHER');
  const file = form.get('file');
  if (!projectId || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { client: true } });
  if (!project) return NextResponse.json({ ok: false, error: 'no_project' }, { status: 404 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileId, webViewLink } = await uploadToDrive({
      clientName: project.client.name,
      projectName: project.name,
      categoryLabel: FILE_CATEGORY_LABELS[category] ?? category,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      buffer,
    });
    await prisma.fileAsset.create({
      data: {
        projectId,
        name: file.name,
        category,
        driveFileId: fileId,
        webViewLink,
        mimeType: file.type || null,
        size: file.size,
        uploadedById: session.id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message?.slice(0, 200) ?? 'upload_failed' }, { status: 500 });
  }
}
