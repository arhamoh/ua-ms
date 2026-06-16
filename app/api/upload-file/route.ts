import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { driveConfigured, uploadToDrive } from '@/lib/drive';
import { FILE_CATEGORY_LABELS } from '@/lib/enums';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Project file upload via XHR so the client can show real upload progress.
// Mirrors the uploadProjectFile server action but always returns JSON (incl.
// errors) so the client can show a real reason instead of a generic failure.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
    if (!driveConfigured()) {
      return NextResponse.json({ ok: false, error: 'Google Drive is not configured.' }, { status: 400 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: `Could not read the upload (the file may be too large). ${e?.message ?? ''}`.trim().slice(0, 250) },
        { status: 413 },
      );
    }

    const projectId = String(form.get('projectId') ?? '');
    const category = String(form.get('category') ?? 'OTHER');
    const file = form.get('file');
    if (!projectId || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: 'Missing project or file.' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { client: true } });
    if (!project) return NextResponse.json({ ok: false, error: 'Project not found.' }, { status: 404 });

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
    // Surfaces in Railway logs; the message is returned to the client too.
    console.error('upload-file failed:', e);
    return NextResponse.json({ ok: false, error: e?.message?.slice(0, 300) ?? 'Upload failed.' }, { status: 500 });
  }
}
