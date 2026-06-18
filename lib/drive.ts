import { drive as makeDrive } from '@googleapis/drive';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

export function driveConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SHARED_DRIVE_ID);
}

function getDrive() {
  const json = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string);
  const auth = new JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  // auth client type version skew between google-auth-library and @googleapis/drive
  return makeDrive({ version: 'v3', auth: auth as any });
}

type DriveClient = ReturnType<typeof getDrive>;

// Live connectivity check for the Settings integrations panel.
export async function testDriveConnection(): Promise<{ ok: boolean; message: string }> {
  if (!driveConfigured()) return { ok: false, message: 'Not configured.' };
  try {
    const driveId = process.env.GOOGLE_SHARED_DRIVE_ID as string;
    const res = await getDrive().drives.get({ driveId, fields: 'id,name' });
    return { ok: true, message: `Connected to “${res.data.name ?? driveId}”.` };
  } catch (err: any) {
    return { ok: false, message: err?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}

const esc = (name: string) => name.replace(/'/g, "\\'");

// Find a folder by name under a parent, creating it if missing. Shared-drive aware.
async function ensureFolder(drive: DriveClient, name: string, parentId: string, driveId: string) {
  const list = await drive.files.list({
    q: `name='${esc(name)}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    corpora: 'drive',
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id,name)',
  });
  const found = list.data.files?.[0];
  if (found?.id) return found.id;

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    supportsAllDrives: true,
    fields: 'id',
  });
  return created.data.id as string;
}

// Downloads a Drive file's bytes (via the service account) — used to proxy
// message-attachment thumbnails so images render inline.
export async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const drive = getDrive();
    const meta = await drive.files.get({ fileId, fields: 'mimeType', supportsAllDrives: true });
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    );
    return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: meta.data.mimeType ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

// Uploads into a single named folder under the Shared Drive (e.g. "Messages").
export async function uploadToDriveFolder(opts: {
  folder: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID as string;
  const drive = getDrive();
  const folderId = await ensureFolder(drive, opts.folder, driveId, driveId);
  const created = await drive.files.create({
    requestBody: { name: opts.fileName, parents: [folderId] },
    media: { mimeType: opts.mimeType, body: Readable.from(opts.buffer) },
    supportsAllDrives: true,
    fields: 'id, webViewLink',
  });
  return { fileId: created.data.id as string, webViewLink: created.data.webViewLink ?? null };
}

// Uploads into: <Shared Drive>/<Client - Project>/<Category>/<file>
export async function uploadToDrive(opts: {
  clientName: string;
  projectName: string;
  categoryLabel: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID as string;
  const drive = getDrive();

  const projectFolder = await ensureFolder(drive, `${opts.clientName} - ${opts.projectName}`, driveId, driveId);
  const catFolder = await ensureFolder(drive, opts.categoryLabel, projectFolder, driveId);

  const created = await drive.files.create({
    requestBody: { name: opts.fileName, parents: [catFolder] },
    media: { mimeType: opts.mimeType, body: Readable.from(opts.buffer) },
    supportsAllDrives: true,
    fields: 'id, webViewLink',
  });

  return { fileId: created.data.id as string, webViewLink: created.data.webViewLink ?? null };
}
