'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, X, ExternalLink, Download } from 'lucide-react';

type Props = { id: string; fileName: string; mimeType: string };

export default function StatementPreview({ id, fileName, mimeType }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock body scroll while the modal is open and close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  const src = `/api/statements/${id}`;
  const isPdf = /pdf/i.test(mimeType) || /\.pdf$/i.test(fileName);
  const isImg = /image\//i.test(mimeType) || /\.(png|jpe?g|gif|webp)$/i.test(fileName);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Preview"
        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand"
      >
        <Eye size={15} />
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0 truncate text-sm font-medium text-slate-700">{fileName}</div>
              <div className="flex shrink-0 items-center gap-1">
                <a href={src} target="_blank" rel="noopener noreferrer" title="Open in new tab" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand">
                  <ExternalLink size={15} />
                </a>
                <a href={`${src}?dl=1`} title="Download" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand">
                  <Download size={15} />
                </a>
                <button type="button" onClick={() => setOpen(false)} title="Close" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-rose-600">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100">
              {isImg ? (
                <div className="flex h-full items-center justify-center overflow-auto p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={fileName} className="max-h-full max-w-full object-contain" />
                </div>
              ) : isPdf ? (
                <iframe src={src} title={fileName} className="h-full w-full border-0" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-slate-500">
                  <p>This file type can’t be previewed inline.</p>
                  <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
                    <ExternalLink size={15} /> Open in new tab
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
