import 'server-only';

// Bank e-statements are commonly encrypted with owner-only restrictions and an
// EMPTY user password — they open without a prompt but pdf-lib cannot read/merge
// them (it renders blank pages). qpdf (compiled to WASM, so no native deps on
// Railway) strips that encryption so the pages can be merged into the submission.

type QpdfInstance = {
  callMain: (args: string[]) => number;
  FS: { writeFile: (p: string, d: Uint8Array) => void; readFile: (p: string) => Uint8Array };
};

let loader: Promise<{ create: (o: { locateFile: () => string }) => Promise<QpdfInstance>; wasmPath: string }> | null = null;

async function getLoader() {
  if (!loader) {
    loader = (async () => {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const mod = require('@neslinesli93/qpdf-wasm');
      const create = (mod.default || mod) as (o: { locateFile: () => string }) => Promise<QpdfInstance>;
      const wasmPath = require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm');
      return { create, wasmPath };
    })();
  }
  return loader;
}

/**
 * Strip encryption from a PDF whose user password is empty. Returns the
 * decrypted bytes, or null if it couldn't be decrypted (e.g. a real password is
 * required, or the input isn't a decryptable PDF). Never throws.
 */
export type DecryptResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: string };

const isPdf = (b: Uint8Array | null): b is Uint8Array =>
  !!b && b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

/**
 * Strip encryption from a PDF whose user password is empty, returning a detailed
 * result so callers can surface *why* it failed. Never throws.
 */
export async function decryptPdfDetailed(bytes: Uint8Array): Promise<DecryptResult> {
  let create: (o: { locateFile: () => string }) => Promise<QpdfInstance>;
  let wasmPath: string;
  try {
    ({ create, wasmPath } = await getLoader());
  } catch (e) {
    return { ok: false, reason: `load:${(e as Error)?.message?.slice(0, 80) || 'err'}` };
  }
  let inst: QpdfInstance;
  try {
    inst = await create({ locateFile: () => wasmPath });
  } catch (e) {
    return { ok: false, reason: `init:${(e as Error)?.message?.slice(0, 80) || 'err'}` };
  }
  try {
    inst.FS.writeFile('/in.pdf', bytes);
    // Don't trust the exit code: qpdf returns 3 on *warnings* (recovered xref,
    // object-stream quirks) while still writing a valid decrypted file. Judge by
    // the output instead. --warning-exit-0 nudges warnings toward 0.
    let code = -1;
    try { code = inst.callMain(['--warning-exit-0', '--decrypt', '/in.pdf', '/out.pdf']); } catch { /* emscripten may throw ExitStatus */ }
    let out: Uint8Array | null = null;
    try { out = inst.FS.readFile('/out.pdf'); } catch { out = null; }
    const outLen = out ? out.length : 'null';
    if (isPdf(out)) return { ok: true, bytes: out };
    return { ok: false, reason: `run:code=${code},out=${outLen}` };
  } catch (e) {
    return { ok: false, reason: `run:${(e as Error)?.message?.slice(0, 80) || 'err'}` };
  }
}

/** Convenience wrapper: decrypted bytes, or null on any failure. */
export async function decryptPdf(bytes: Uint8Array): Promise<Uint8Array | null> {
  const r = await decryptPdfDetailed(bytes);
  return r.ok ? r.bytes : null;
}
