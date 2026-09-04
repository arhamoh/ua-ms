import { drive as makeDrive } from '@googleapis/drive';
import { JWT, OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';
import { googleConnected, getAccessToken } from '@/lib/google';

// Drive works either through the unified "Connect Google" account (files in that
// account's My Drive) or, as a fallback, a service account + Shared Drive.

export function driveConfigured() {
  return googleConnected() || Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SHARED_DRIVE_ID);
}

type DriveClient = ReturnType<typeof makeDrive>;
interface Ctx {
  drive: DriveClient;
  shared: boolean; // service-account Shared Drive mode
  driveId?: string;
  rootParent: string;
}

async function ctx(): Promise<Ctx> {
  if (googleConnected()) {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: await getAccessToken() });
    return { drive: makeDrive({ version: 'v3', auth: auth as any }), shared: false, rootParent: 'root' };
  }
  const json = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string);
  const auth = new JWT({ email: json.client_email, key: json.private_key, scopes: ['https://www.googleapis.com/auth/drive'] });
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID as string;
  return { drive: makeDrive({ version: 'v3', auth: auth as any }), shared: true, driveId, rootParent: driveId };
}

const esc = (name: string) => name.replace(/'/g, "\\'");

export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
}

/** List files/folders inside a folder (default: the account's root / shared-drive root). */
export async function listDriveFiles(folderId?: string): Promise<DriveEntry[]> {
  const c = await ctx();
  const parent = folderId || c.rootParent;
  const params: any = {
    q: `'${parent}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
    orderBy: 'folder,name',
    pageSize: 200,
  };
  if (c.shared) {
    params.corpora = 'drive';
    params.driveId = c.driveId;
    params.includeItemsFromAllDrives = true;
    params.supportsAllDrives = true;
  }
  const res = await c.drive.files.list(params);
  return (res.data.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name ?? '(untitled)',
    mimeType: f.mimeType ?? '',
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    size: f.size ? Number(f.size) : null,
    modifiedTime: f.modifiedTime ?? null,
    webViewLink: f.webViewLink ?? null,
  }));
}

export async function testDriveConnection(): Promise<{ ok: boolean; message: string }> {
  if (!driveConfigured()) return { ok: false, message: 'Not configured.' };
  try {
    const c = await ctx();
    if (c.shared) {
      const res = await c.drive.drives.get({ driveId: c.driveId!, fields: 'id,name' });
      return { ok: true, message: `Connected to “${res.data.name ?? c.driveId}”.` };
    }
    await c.drive.files.list({ pageSize: 1, fields: 'files(id)' });
    return { ok: true, message: 'Google Drive ready.' };
  } catch (err: any) {
    return { ok: false, message: err?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}

async function ensureFolder(c: Ctx, name: string, parentId: string): Promise<string> {
  const listParams: any = {
    q: `name='${esc(name)}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id,name)',
  };
  if (c.shared) {
    listParams.corpora = 'drive';
    listParams.driveId = c.driveId;
    listParams.includeItemsFromAllDrives = true;
    listParams.supportsAllDrives = true;
  }
  const list = await c.drive.files.list(listParams);
  const found = list.data.files?.[0];
  if (found?.id) return found.id;

  const createParams: any = {
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  };
  if (c.shared) createParams.supportsAllDrives = true;
  const created = await c.drive.files.create(createParams);
  return created.data.id as string;
}

export async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const c = await ctx();
    const metaParams: any = { fileId, fields: 'mimeType' };
    const mediaParams: any = { fileId, alt: 'media' };
    if (c.shared) {
      metaParams.supportsAllDrives = true;
      mediaParams.supportsAllDrives = true;
    }
    const meta = await c.drive.files.get(metaParams);
    const res = await c.drive.files.get(mediaParams, { responseType: 'arraybuffer' });
    return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: meta.data.mimeType ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

export async function uploadToDriveFolder(opts: {
  folder: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const c = await ctx();
  const folderId = await ensureFolder(c, opts.folder, c.rootParent);
  const createParams: any = {
    requestBody: { name: opts.fileName, parents: [folderId] },
    media: { mimeType: opts.mimeType, body: Readable.from(opts.buffer) },
    fields: 'id, webViewLink',
  };
  if (c.shared) createParams.supportsAllDrives = true;
  const created = await c.drive.files.create(createParams);
  return { fileId: created.data.id as string, webViewLink: created.data.webViewLink ?? null };
}

export async function uploadToDrive(opts: {
  clientName: string;
  projectName: string;
  categoryLabel: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ fileId: string; webViewLink: string | null }> {
  const c = await ctx();
  // <root>/<Client>/<Project>/<Category>/<file>
  const clientFolder = await ensureFolder(c, opts.clientName, c.rootParent);
  const projectFolder = await ensureFolder(c, opts.projectName, clientFolder);
  const catFolder = await ensureFolder(c, opts.categoryLabel, projectFolder);
  const createParams: any = {
    requestBody: { name: opts.fileName, parents: [catFolder] },
    media: { mimeType: opts.mimeType, body: Readable.from(opts.buffer) },
    fields: 'id, webViewLink',
  };
  if (c.shared) createParams.supportsAllDrives = true;
  const created = await c.drive.files.create(createParams);
  return { fileId: created.data.id as string, webViewLink: created.data.webViewLink ?? null };
}

// Standard sub-folders each project type gets. Numbered so they sort naturally.
export const FOLDER_TEMPLATES: Record<string, string[]> = {
  DESIGN: [
    '00 Admin — Contracts & Invoices',
    '01 Brief & Requirements',
    '02 Research & Moodboards',
    '03 Brand Assets',
    '04 Drafts & WIP',
    '05 Final Designs',
    '06 Source Files',
  ],
  DEVELOPMENT: [
    '00 Admin — Contracts & Invoices',
    '01 Requirements & Specs',
    '02 Design Handoff',
    '03 Source & Repos',
    '04 Documentation',
    '05 QA & Testing',
    '06 Credentials & Access',
    '07 Deliverables',
  ],
  SOFTWARE: [
    '00 Admin — Contracts & Invoices',
    '01 Requirements & Specs',
    '02 Architecture & Design',
    '03 Source & Repos',
    '04 Documentation',
    '05 QA & Testing',
    '06 Credentials & Access',
    '07 Deliverables',
  ],
};
const DEFAULT_FOLDERS = ['00 Admin — Contracts & Invoices', 'Deliverables', 'Assets'];
export const foldersFor = (type: string) => FOLDER_TEMPLATES[type] ?? DEFAULT_FOLDERS;

export const folderLink = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/** Ensure <root>/<Client>/<Project>/<standard sub-folders> exist. Idempotent. */
export async function provisionProjectFolders(opts: {
  clientName: string;
  projectName: string;
  projectType: string;
}): Promise<{ clientFolderId: string; projectFolderId: string }> {
  const c = await ctx();
  const clientFolderId = await ensureFolder(c, opts.clientName, c.rootParent);
  const projectFolderId = await ensureFolder(c, opts.projectName, clientFolderId);
  for (const sub of foldersFor(opts.projectType)) {
    await ensureFolder(c, sub, projectFolderId);
  }
  return { clientFolderId, projectFolderId };
}

/** Ensure just the client's top-level folder exists. */
export async function ensureClientFolder(clientName: string): Promise<string> {
  const c = await ctx();
  return ensureFolder(c, clientName, c.rootParent);
}

async function getParents(c: Ctx, fileId: string): Promise<string[]> {
  const p: any = { fileId, fields: 'parents' };
  if (c.shared) p.supportsAllDrives = true;
  const r = await c.drive.files.get(p);
  return (r.data.parents as string[] | undefined) ?? [];
}

/** Whether a file/folder lives inside any of the allowed folder ids (walks up
 *  the parent chain). Used to enforce project-scoped Drive access. */
export async function isWithinFolders(fileId: string, allowed: Set<string>): Promise<boolean> {
  if (allowed.has(fileId)) return true;
  const c = await ctx();
  let current: string | undefined = fileId;
  let depth = 0;
  while (current && depth < 12) {
    if (allowed.has(current)) return true;
    const parents = await getParents(c, current);
    if (!parents.length) return false;
    current = parents[0];
    depth++;
  }
  return false;
}

export async function uploadFileToFolder(folderId: string, fileName: string, mimeType: string, buffer: Buffer): Promise<{ fileId: string; webViewLink: string | null }> {
  const c = await ctx();
  const params: any = {
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, webViewLink',
  };
  if (c.shared) params.supportsAllDrives = true;
  const created = await c.drive.files.create(params);
  return { fileId: created.data.id as string, webViewLink: created.data.webViewLink ?? null };
}

export async function renameDriveEntry(fileId: string, name: string): Promise<void> {
  const c = await ctx();
  const params: any = { fileId, requestBody: { name }, fields: 'id' };
  if (c.shared) params.supportsAllDrives = true;
  await c.drive.files.update(params);
}

/** Move a file/folder to Drive trash (recoverable). */
export async function trashDriveEntry(fileId: string): Promise<void> {
  const c = await ctx();
  const params: any = { fileId, requestBody: { trashed: true }, fields: 'id' };
  if (c.shared) params.supportsAllDrives = true;
  await c.drive.files.update(params);
}

/** Grant a person read access to a file so they can open it directly. */
export async function shareFile(fileId: string, email: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
  const c = await ctx();
  const params: any = {
    fileId,
    requestBody: { role, type: 'user', emailAddress: email },
    sendNotificationEmail: false, // Keel sends its own notification
    fields: 'id',
  };
  if (c.shared) params.supportsAllDrives = true;
  await c.drive.permissions.create(params);
}
