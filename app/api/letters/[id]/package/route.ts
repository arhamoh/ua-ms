import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getCompany } from '@/lib/company';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INK = rgb(0.12, 0.14, 0.18);
const MUTED = rgb(0.42, 0.45, 0.5);
const BRAND = rgb(0.29, 0.33, 0.86);
const RULE = rgb(0.85, 0.87, 0.9);

// Map characters WinAnsi (Helvetica's encoding) can't render to safe equivalents,
// then drop anything still outside Latin-1 so drawText never throws on French text.
function winAnsi(s: string): string {
  return (s || '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/•/g, '-')
    // Keep tab/newline/CR, printable ASCII, and Latin-1 (incl. French accents);
    // drop the C1 control block (0x80-0x9F) that Helvetica\'s WinAnsi cannot render.
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, '');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of winAnsi(text).split('\n')) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) { out.push(''); continue; }
    let line = '';
    for (let w of words) {
      // Hard-break a single word longer than the line.
      while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
        let cut = w.length;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const test = line ? `${line} ${w}` : w;
      if (line && font.widthOfTextAtSize(test, size) > maxWidth) { out.push(line); line = w; }
      else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!session.roles.includes('SUPER_ADMIN')) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const [letter, company] = await Promise.all([
    prisma.letter.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          include: {
            attachments: {
              orderBy: { createdAt: 'asc' },
              include: { statement: { select: { data: true, mimeType: true, fileName: true, accountType: true, periodLabel: true } } },
            },
          },
        },
      },
    }),
    getCompany(),
  ]);
  if (!letter) return new NextResponse('Not found', { status: 404 });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  // A flowing text cursor that spills onto new pages as needed.
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const space = (h: number) => { if (y - h < MARGIN) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; } };
  const text = (
    s: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const color = opts.color ?? INK;
    const indent = opts.indent ?? 0;
    const lineH = size * 1.4;
    for (const line of wrap(s, f, size, CONTENT_W - indent)) {
      space(lineH);
      if (line) page.drawText(line, { x: MARGIN + indent, y: y - size, size, font: f, color });
      y -= lineH;
    }
    if (opts.gap) y -= opts.gap;
  };
  const rule = (gap = 8) => { space(gap + 1); page.drawLine({ start: { x: MARGIN, y: y - gap / 2 }, end: { x: PAGE_W - MARGIN, y: y - gap / 2 }, thickness: 0.5, color: RULE }); y -= gap; };

  // ── Cover ──────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: BRAND });
  text(company.name || 'Company', { size: 20, font: bold, gap: 2 });
  const idLines = [
    company.address,
    company.email,
    company.phone,
    company.gstNumber ? `GST / TPS: ${company.gstNumber}` : null,
    company.qstNumber ? `QST / TVQ: ${company.qstNumber}` : null,
    company.neqNumber ? `NEQ: ${company.neqNumber}` : null,
    company.corporationNumber ? `Corporation no.: ${company.corporationNumber}` : null,
    company.identificationNumber ? `Identification no.: ${company.identificationNumber}` : null,
  ].filter(Boolean) as string[];
  for (const l of idLines) text(l, { size: 9.5, color: MUTED });
  rule(14);

  text('RESPONSE / RÉPONSE', { size: 11, font: bold, color: BRAND, gap: 4 });
  text(letter.title, { size: 15, font: bold, gap: 2 });
  const meta = [
    letter.sender ? `Sender: ${letter.sender}` : null,
    letter.reference ? `Reference: ${letter.reference}` : null,
    letter.docDate ? `Document dated: ${new Date(letter.docDate).toISOString().slice(0, 10)}` : null,
    letter.dueDate ? `Deadline: ${new Date(letter.dueDate).toISOString().slice(0, 10)}` : null,
  ].filter(Boolean) as string[];
  for (const l of meta) text(l, { size: 10, color: MUTED });
  text(`Generated: ${new Date().toISOString().slice(0, 10)}`, { size: 9, color: MUTED, gap: 8 });
  if (letter.summary) { text('Summary', { size: 10, font: bold, gap: 2 }); text(letter.summary, { size: 10, color: MUTED, gap: 6 }); }

  // ── One block per task: French question, detail, written answer, docs list ──
  type Doc = { fileName: string; bytes: Buffer; mime: string; kind: string; accountType: string; year: number; month: number };
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const ymOf = (s: string) => {
    const t = (s || '').toLowerCase();
    const y = t.match(/(19|20)\d{2}/);
    const mi = MONTHS.findIndex((m) => t.includes(m));
    return { year: y ? Number(y[0]) : 0, month: mi >= 0 ? mi + 1 : 0 };
  };
  const docs: Doc[] = [];
  const seenStmt = new Set<string>();

  let qNum = 0;
  for (const t of letter.tasks) {
    qNum++;
    rule(16);
    const question = t.titleFr || t.title;
    text(`${qNum}. ${question}`, { size: 12, font: bold, gap: 2 });
    if (t.titleFr && t.title && t.title !== t.titleFr) text(t.title, { size: 9, font: italic, color: MUTED });
    const detail = t.detailFr || t.detail;
    if (detail) text(detail, { size: 9.5, color: MUTED, gap: 4 });

    text('Réponse', { size: 9, font: bold, color: BRAND, gap: 1 });
    text(t.response?.trim() ? t.response : '—', { size: 10.5, gap: 4 });

    if (t.attachments.length) {
      text('Pièces jointes / Documents:', { size: 9, font: bold, gap: 1 });
      for (const a of t.attachments) {
        const bytes = a.kind === 'STATEMENT' ? (a.statement?.data as unknown as Buffer | undefined) : (a.data as unknown as Buffer | undefined);
        text(`- ${a.fileName}${bytes && bytes.length ? '' : '  (file unavailable)'}`, { size: 9.5, color: MUTED, indent: 8 });
        if (!bytes || !bytes.length) continue;
        if (a.kind === 'STATEMENT') {
          const sid = a.statementId ?? '';
          if (sid && seenStmt.has(sid)) continue; // dedupe statements across tasks
          if (sid) seenStmt.add(sid);
          const { year, month } = ymOf(a.statement?.periodLabel || a.statement?.fileName || a.fileName);
          docs.push({ fileName: a.fileName, bytes, mime: a.statement?.mimeType ?? '', kind: 'STATEMENT', accountType: a.statement?.accountType ?? 'BANK', year, month });
        } else {
          docs.push({ fileName: a.fileName, bytes, mime: a.mimeType, kind: a.kind, accountType: '', year: 0, month: 0 });
        }
      }
    }
  }
  if (qNum === 0) { rule(16); text('No tasks recorded for this document.', { size: 10, color: MUTED }); }

  // ── Appendix, grouped: Bank statements (by year, newest first), then Credit
  // card statements, then ledgers & other documents. ─────────────────────────
  const notePage = (msg: string) => {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    p.drawText(winAnsi(msg), { x: MARGIN, y: PAGE_H - MARGIN - 20, size: 11, font: italic, color: MUTED });
  };
  const sectionCover = (title: string, items: string[]) => {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    p.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: BRAND });
    p.drawText(winAnsi(title), { x: MARGIN, y: PAGE_H - MARGIN - 24, size: 20, font: bold, color: INK });
    let yy = PAGE_H - MARGIN - 56;
    for (const it of items) {
      if (yy < MARGIN + 14) break;
      p.drawText(winAnsi(`-  ${it}`), { x: MARGIN, y: yy, size: 10.5, font, color: MUTED });
      yy -= 17;
    }
  };
  const appendDoc = async (d: Doc, noteLabel: string) => {
    const isPdf = /pdf/i.test(d.mime) || /\.pdf$/i.test(d.fileName);
    const isJpg = /jpe?g/i.test(d.mime) || /\.jpe?g$/i.test(d.fileName);
    const isPng = /png/i.test(d.mime) || /\.png$/i.test(d.fileName);
    try {
      if (isPdf) {
        const src = await PDFDocument.load(new Uint8Array(d.bytes), { ignoreEncryption: true });
        if (src.isEncrypted) { notePage(`${noteLabel}: "${d.fileName}" is an encrypted PDF and is attached as a separate file (it opens on its own).`); return; }
        const pages = await doc.copyPages(src, src.getPageIndices());
        pages.forEach((p) => doc.addPage(p));
      } else if (isJpg || isPng) {
        const img = isJpg ? await doc.embedJpg(new Uint8Array(d.bytes)) : await doc.embedPng(new Uint8Array(d.bytes));
        const scale = Math.min((PAGE_W - MARGIN) / img.width, (PAGE_H - MARGIN) / img.height, 1);
        const p = doc.addPage([PAGE_W, PAGE_H]);
        p.drawImage(img, { x: (PAGE_W - img.width * scale) / 2, y: (PAGE_H - img.height * scale) / 2, width: img.width * scale, height: img.height * scale });
      } else {
        notePage(`${noteLabel}: "${d.fileName}" is provided as a separate file.`);
      }
    } catch {
      notePage(`${noteLabel}: could not embed "${d.fileName}" — provided as a separate file.`);
    }
  };
  const byYearDesc = (arr: Doc[]) => {
    const years = [...new Set(arr.map((d) => d.year))].sort((a, b) => b - a);
    return years.map((yr) => ({ year: yr, items: arr.filter((d) => d.year === yr).sort((a, b) => a.month - b.month || a.fileName.localeCompare(b.fileName)) }));
  };

  const bank = docs.filter((d) => d.kind === 'STATEMENT' && d.accountType !== 'CREDIT_CARD');
  const cc = docs.filter((d) => d.kind === 'STATEMENT' && d.accountType === 'CREDIT_CARD');
  const others = docs.filter((d) => d.kind !== 'STATEMENT');

  for (const g of byYearDesc(bank)) {
    sectionCover(`Bank account statements — ${g.year || 'undated'}`, g.items.map((d) => d.fileName));
    for (const d of g.items) await appendDoc(d, `Bank statement ${g.year || ''}`.trim());
  }
  for (const g of byYearDesc(cc)) {
    sectionCover(`Credit card statements — ${g.year || 'undated'}`, g.items.map((d) => d.fileName));
    for (const d of g.items) await appendDoc(d, `Credit card statement ${g.year || ''}`.trim());
  }
  if (others.length) {
    sectionCover('Ledgers & supporting documents', others.map((d) => d.fileName));
    for (const d of others) await appendDoc(d, 'Document');
  }

  const pdfBytes = await doc.save();
  const safe = (letter.title || 'submission').replace(/[^\w.\- ]+/g, '').slice(0, 80).trim() || 'submission';
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safe} - submission.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
