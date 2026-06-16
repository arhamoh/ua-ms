import { FileUp, ExternalLink, Trash2, MessageSquare } from 'lucide-react';
import { uploadProjectFile, addFileComment, deleteFileAsset } from '@/app/actions';
import { FILE_CATEGORY_LABELS } from '@/lib/enums';
import { getOptions } from '@/lib/options';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10';

type FileComment = { id: string; body: string; createdAt: Date; author: { name: string } | null };
type FileAsset = {
  id: string;
  name: string;
  category: string;
  webViewLink: string | null;
  createdAt: Date;
  uploadedBy: { name: string } | null;
  comments: FileComment[];
};

// Highlight @mentions in a comment body.
function renderBody(body: string) {
  return body.split(/(\s+)/).map((tok, i) =>
    tok.startsWith('@') && tok.length > 1 ? (
      <span key={i} className="font-medium text-brand">{tok}</span>
    ) : (
      <span key={i}>{tok}</span>
    ),
  );
}

export default async function ProjectFiles({
  projectId,
  files,
  driveOk,
}: {
  projectId: string;
  files: FileAsset[];
  driveOk: boolean;
}) {
  const fileCategories = await getOptions('fileCategory');
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No files yet. Upload logos, designs, documents — they’re organized in your Shared Drive as
            <span className="font-medium"> Client - Project / Type</span>.
          </div>
        ) : (
          <div className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                        {FILE_CATEGORY_LABELS[file.category] ?? file.category}
                      </span>
                      {file.webViewLink ? (
                        <a href={file.webViewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate font-medium text-brand hover:underline">
                          {file.name} <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="truncate font-medium">{file.name}</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {file.uploadedBy ? `${file.uploadedBy.name} · ` : ''}
                      {file.createdAt.toISOString().slice(0, 10)}
                    </div>
                  </div>
                  <form action={deleteFileAsset}>
                    <input type="hidden" name="fileId" value={file.id} />
                    <input type="hidden" name="projectId" value={projectId} />
                    <button className="text-slate-300 hover:text-rose-600" aria-label="Remove">
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>

                {/* Comments */}
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {file.comments.map((c) => (
                    <div key={c.id} className="text-sm">
                      <span className="font-medium text-slate-700">{c.author?.name ?? 'Someone'}: </span>
                      <span className="text-slate-600">{renderBody(c.body)}</span>
                    </div>
                  ))}
                  <form action={addFileComment} className="flex items-center gap-2 pt-1">
                    <input type="hidden" name="fileId" value={file.id} />
                    <input type="hidden" name="projectId" value={projectId} />
                    <MessageSquare size={14} className="shrink-0 text-slate-300" />
                    <input name="body" required placeholder="Comment… use @name to mention" className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    <button className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">Post</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload */}
      <div>
        {driveOk ? (
          <form action={uploadProjectFile} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <FileUp size={16} className="text-brand" /> Upload a file
            </h2>
            <input type="hidden" name="projectId" value={projectId} />
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Type</span>
                <select name="category" className={inputCls} defaultValue="OTHER">
                  {fileCategories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">File</span>
                <input type="file" name="file" required className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white" />
              </label>
              <button className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark">Upload to Drive</button>
              <p className="text-xs text-slate-400">Saved to the Shared Drive under <span className="font-medium">Client - Project / Type</span>.</p>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <p className="font-medium">Google Drive not connected</p>
            <p className="mt-1 text-amber-700">
              Add <code className="rounded bg-amber-100 px-1">GOOGLE_SERVICE_ACCOUNT_JSON</code> and{' '}
              <code className="rounded bg-amber-100 px-1">GOOGLE_SHARED_DRIVE_ID</code> in Railway to enable
              uploads. Files will auto-organize as Client - Project / Type.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
