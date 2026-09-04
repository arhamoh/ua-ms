import { drive as makeDrive } from '@googleapis/drive';
import { JWT, OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';
import { googleConnected, getAccessToken } from '@/lib/google';

// Drive works through the unified "Connect Google" account. All of Keel's files
// live under a dedicated root — a "Keel" folder or a Shared Drive
// (GOOGLE_DRIVE_ROOT_ID) — so they never mix with the account's personal files.
// A service account + Shared Drive is kept as a legacy fallback.

export function driveConfigured() {
  return googleConnected() || Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_SHARED_DRIVE_ID);
}

/** The configured Keel Drive root id (a folder or Shared Drive), or 'root'. */
export function driveRootId(): string {
  return process.env.GOOGLE_DRIVE_ROOT_ID || 'root';
}
export function hasDedicatedRoot(): boolean {
  return Boolean(process.env.GOOGLE_DRIVE_ROOT_ID);
}

type DriveClient = ReturnType<typeof makeDrive>;
interface Ctx {
  drive: DriveClient;
  shared: boolean; // legacy service-account Shared Drive mode
  driveId?: string;
  rootParent: string;
}

async function ctx(): Promise<Ctx> {
  if (googleConnected()) {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: await getAccessToken() });
    return { drive: makeDrive({ version: 'v3', auth: auth as any }), shared: false, rootParent: driveRootId() };
  }
  const json = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string);
  const auth = new JWT({ email: json.client_email, key: json.private_key, scopes: ['https://www.googleapis.com/auth/drive'] });
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID as string;
  return { drive: makeDrive({ version: 'v3', auth: auth as any }), shared: true, driveId, rootParent: driveId };
}

// Always allow all-drives so a Shared-Drive root works; add shared-drive scoping
// only in the legacy service-account mode.
function P(c: Ctx, params: any, isList = false): any {
  params.supportsAllDrives = true;
  if (isList) {
    params.includeItemsFromAllDrives = true;
    if (c.shared) { params.corpora = 'drive'; params.driveId = c.driveId; }
  }
  return params;
}

const esc = (name: string) => name.replace(/'/g, "\\'");

export async function testDriveConnection(): Promise<{ ok: boolean; message: string }> {
  if (!driveConfigured()) return { ok: false, message: 'Not configured.' };
  try {
    const c = await ctx();
    if (c.shared) {
      const res = await c.drive.drives.get({ driveId: c.driveId!, fields: 'id,name' });
      return { ok: true, message: `Connected to “${res.data.name ?? c.driveId}”.` };
    }
    await c.drive.files.list(P(c, { pageSize: 1, fields: 'files(id)' }, true));
    return { ok: true, message: 'Google Drive ready.' };
  } catch (err: any) {
    return { ok: false, message: err?.message?.slice(0, 200) ?? 'Connection failed.' };
  }
}

async function ensureFolder(c: Ctx, name: string, parentId: string): Promise<string> {
  const list = await c.drive.files.list(
    P(c, {
      q: `name='${esc(name)}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: 'files(id,name)',
    }, true),
  );
  const found = list.data.files?.[0];
  if (found?.id) return found.id;
  const created = await c.drive.files.create(
    P(c, { requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' }),
  );
  return created.data.id as string;
}

export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
}

export async function listDriveFiles(folderId?: string): Promise<DriveEntry[]> {
  const c = await ctx();
  const parent = folderId || c.rootParent;
  const res = await c.drive.files.list(
    P(c, {
      q: `'${parent}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
      orderBy: 'folder,name',
      pageSize: 200,
    }, true),
  );
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

async function getParents(c: Ctx, fileId: string): Promise<string[]> {
  const r = await c.drive.files.get(P(c, { fileId, fields: 'parents' }));
  return (r.data.parents as string[] | undefined) ?? [];
}

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
  const created = await c.drive.files.create(
    P(c, { requestBody: { name: fileName, parents: [folderId] }, media: { mimeType, body: Readable.from(buffer) }, fields: 'id, webViewLink' }),
  );
  return { fileId: created.data.id as string, webViewLink: created.data.webViewLink ?? null };
}

export async function renameDriveEntry(fileId: string, name: string): Promise<void> {
  const c = await ctx();
  await c.drive.files.update(P(c, { fileId, requestBody: { name }, fields: 'id' }));
}

export async function trashDriveEntry(fileId: string): Promise<void> {
  const c = await ctx();
  await c.drive.files.update(P(c, { fileId, requestBody: { trashed: true }, fields: 'id' }));
}

export async function shareFile(fileId: string, email: string, role: 'reader' | 'writer' = 'reader'): Promise<void> {
  const c = await ctx();
  await c.drive.permissions.create(
    P(c, { fileId, requestBody: { role, type: 'user', emailAddress: email }, sendNotificationEmail: false, fields: 'id' }),
  );
}

export async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const c = await ctx();
    const meta = await c.drive.files.get(P(c, { fileId, fields: 'mimeType' }));
    const res = await c.drive.files.get(P(c, { fileId, alt: 'media' }), { responseType: 'arraybuffer' });
    return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: meta.data.mimeType ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

export async function uploadToDriveFolder(opts: { folder: string; fileName: string; mimeType: string; buffer: Buffer }): Promise<{ fileId: string; webViewLink: string | null }> {
  const c = await ctx();
  const folderId = await ensureFolder(c, opts.folder, c.rootParent);
  return uploadFileToFolder(folderId, opts.fileName, opts.mimeType, opts.buffer);
}

export async function uploadToDrive(opts: { clientName: string; projectName: string; categoryLabel: string; fileName: string; mimeType: string; buffer: Buffer }): Promise<{ fileId: string; webViewLink: string | null }> {
  const c = await ctx();
  const clientFolder = await ensureFolder(c, opts.clientName, c.rootParent);
  const projectFolder = await ensureFolder(c, opts.projectName, clientFolder);
  const catFolder = await ensureFolder(c, opts.categoryLabel, projectFolder);
  return uploadFileToFolder(catFolder, opts.fileName, opts.mimeType, opts.buffer);
}

// Standard sub-folders each project type gets. Numbered so they sort naturally.
export const FOLDER_TEMPLATES: Record<string, string[]> = {
  DESIGN: ['00 Admin — Contracts & Invoices', '01 Brief & Requirements', '02 Research & Moodboards', '03 Brand Assets', '04 Drafts & WIP', '05 Final Designs', '06 Source Files'],
  DEVELOPMENT: ['00 Admin — Contracts & Invoices', '01 Requirements & Specs', '02 Design Handoff', '03 Source & Repos', '04 Documentation', '05 QA & Testing', '06 Credentials & Access', '07 Deliverables'],
  SOFTWARE: ['00 Admin — Contracts & Invoices', '01 Requirements & Specs', '02 Architecture & Design', '03 Source & Repos', '04 Documentation', '05 QA & Testing', '06 Credentials & Access', '07 Deliverables'],
};
const DEFAULT_FOLDERS = ['00 Admin — Contracts & Invoices', 'Deliverables', 'Assets'];
export const foldersFor = (type: string) => FOLDER_TEMPLATES[type] ?? DEFAULT_FOLDERS;

export const folderLink = (id: string) => `https://drive.google.com/drive/folders/${id}`;

export async function provisionProjectFolders(opts: { clientName: string; projectName: string; projectType: string }): Promise<{ clientFolderId: string; projectFolderId: string }> {
  const c = await ctx();
  const clientFolderId = await ensureFolder(c, opts.clientName, c.rootParent);
  const projectFolderId = await ensureFolder(c, opts.projectName, clientFolderId);
  for (const sub of foldersFor(opts.projectType)) await ensureFolder(c, sub, projectFolderId);
  return { clientFolderId, projectFolderId };
}

export async function ensureClientFolder(clientName: string): Promise<string> {
  const c = await ctx();
  return ensureFolder(c, clientName, c.rootParent);
}

// ── Dedicated root management ────────────────────────────────────────────────

/** The connected account's My Drive root ('root'). */
async function createFolderAt(parentId: string, name: string): Promise<string> {
  const c = await ctx();
  const created = await c.drive.files.create(P(c, { requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' }));
  return created.data.id as string;
}

/** Name of a folder/Shared Drive by id (for showing the current root). */
export async function driveEntryName(fileId: string): Promise<string | null> {
  try {
    const c = await ctx();
    const r = await c.drive.files.get(P(c, { fileId, fields: 'name' }));
    return r.data.name ?? null;
  } catch {
    return null;
  }
}

/** Create a top-level "Keel" folder in My Drive to use as the dedicated root. */
export async function createKeelRootFolder(name = 'Keel'): Promise<string> {
  return createFolderAt('root', name);
}

/** Move a folder to live under `newParent`, removing it from `oldParent`. */
export async function moveEntry(fileId: string, newParent: string, oldParent: string): Promise<void> {
  const c = await ctx();
  await c.drive.files.update(P(c, { fileId, addParents: newParent, removeParents: oldParent, fields: 'id' }));
}
