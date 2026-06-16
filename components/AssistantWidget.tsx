'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, X, Maximize2 } from 'lucide-react';
import AssistantChat from './AssistantChat';

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-brand text-white shadow-lg transition hover:opacity-90 print:hidden"
        aria-label="Analytics assistant"
      >
        {open ? (
          <X size={20} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/icon.svg" alt="" className="h-full w-full object-cover" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed bottom-20 right-5 z-40 flex h-[60vh] max-h-[560px] w-[90vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl print:hidden"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Sparkles size={16} className="text-brand" />
              <span className="text-sm font-semibold">Analytics Assistant</span>
              <Link
                href="/assistant"
                className="ml-auto text-slate-400 hover:text-brand"
                aria-label="Open full page"
                onClick={() => setOpen(false)}
              >
                <Maximize2 size={15} />
              </Link>
            </div>
            <AssistantChat className="min-h-0 flex-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
