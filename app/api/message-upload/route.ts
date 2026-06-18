import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { driveConfigured, uploadToDriveFolder } from '@/lib/drive';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Uploads a message attachment to the Shared Drive's "Messages" folder and
// returns its link + metadata for sendMessage. Always returns JSON.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
    if (!driveConfigured()) {
      return NextResponse.json({ ok: false, error: 'Attachments need Google Drive configured.' }, { status: 400 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: `Could not read the file (too large?). ${e?.message ?? ''}`.trim().slice(0, 200) }, { status: 413 });
    }
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: 'No file.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = `${Date.now()}-${file.name}`.replace(/[/\\]/g, '_');
    const { webViewLink } = await uploadToDriveFolder({
      folder: 'Messages',
      fileName: safeName,
      mimeType: file.type || 'application/octet-stream',
      buffer,
    });
    return NextResponse.json({ ok: true, url: webViewLink, name: file.name, type: file.type || 'application/octet-stream' });
  } catch (e: any) {
    console.error('message-upload failed:', e);
    return NextResponse.json({ ok: false, error: e?.message?.slice(0, 200) ?? 'Upload failed.' }, { status: 500 });
  }
}
