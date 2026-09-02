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
export async function decryptPdf(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const { create, wasmPath } = await getLoader();
    // A fresh instance per call: qpdf's WASM main() exits the runtime.
    const inst = await create({ locateFile: () => wasmPath });
    inst.FS.writeFile('/in.pdf', bytes);
    const code = inst.callMain(['--decrypt', '/in.pdf', '/out.pdf']);
    if (code !== 0) return null;
    const out = inst.FS.readFile('/out.pdf');
    return out && out.length ? out : null;
  } catch {
    return null;
  }
}
