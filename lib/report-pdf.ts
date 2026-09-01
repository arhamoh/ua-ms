import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { BuiltReport, Cell } from './finance-reports';
import type { Company } from './company';

const PAGE_W = 612;
const PAGE_H = 792;
const M = 40;
const CONTENT_W = PAGE_W - M * 2;
const INK = rgb(0.12, 0.14, 0.18);
const MUTED = rgb(0.42, 0.45, 0.5);
const BRAND = rgb(0.29, 0.33, 0.86);
const RULE = rgb(0.86, 0.88, 0.91);
const HEAD_BG = rgb(0.95, 0.96, 0.98);

// Map characters Helvetica's WinAnsi encoding can't render, then drop the rest
// so drawText never throws on French text.
function winAnsi(s: string): string {
  return (s || '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[•]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, '');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of winAnsi(text).split('\n')) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) { out.push(''); continue; }
    let line = '';
    for (let w of words) {
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

function truncate(s: string, font: PDFFont, size: number, maxWidth: number): string {
  const t = winAnsi(s);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  let cut = t.length;
  while (cut > 1 && font.widthOfTextAtSize(`${t.slice(0, cut)}...`, size) > maxWidth) cut--;
  return `${t.slice(0, cut)}...`;
}

const fmt = (v: Cell, money?: boolean): string =>
  money ? Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v ?? '');

export async function renderReportPdf(
  report: BuiltReport,
  meta: { company: Company; periodLabel: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const cols = report.columns;
  // Base widths per column; the Description column flexes to fill the rest.
  const widths: number[] = cols.map((c) => (c.money ? 76 : c.label === 'Date' ? 58 : c.label === 'Type' ? 52 : 92));
  let flex = cols.findIndex((c) => c.label === 'Description');
  if (flex < 0) flex = cols.findIndex((c) => !c.money);
  if (flex < 0) flex = 0;
  const fixedSum = widths.reduce((s, w, i) => (i === flex ? s : s + w), 0);
  widths[flex] = Math.max(110, CONTENT_W - fixedSum);
  const totalW = widths.reduce((a, b) => a + b, 0);
  if (totalW > CONTENT_W) { const k = CONTENT_W / totalW; for (let i = 0; i < widths.length; i++) widths[i] *= k; }
  const colX = (i: number) => M + widths.slice(0, i).reduce((a, b) => a + b, 0);

  const size = 8.5;
  const lineH = size * 1.35;
  const padX = 4;

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const drawHeaderRow = () => {
    page.drawRectangle({ x: M, y: y - 15, width: CONTENT_W, height: 15, color: HEAD_BG });
    cols.forEach((c, i) => {
      const t = truncate(c.label, bold, 7.5, widths[i] - padX * 2);
      const x = c.money ? colX(i) + widths[i] - padX - bold.widthOfTextAtSize(t, 7.5) : colX(i) + padX;
      page.drawText(t, { x, y: y - 11, size: 7.5, font: bold, color: MUTED });
    });
    y -= 15;
  };

  // ── Title block ──
  page.drawRectangle({ x: 0, y: PAGE_H - 5, width: PAGE_W, height: 5, color: BRAND });
  page.drawText(winAnsi(meta.company.name || 'Company'), { x: M, y: y - 14, size: 14, font: bold, color: INK });
  y -= 20;
  const ids = [
    meta.company.gstNumber ? `GST/TPS: ${meta.company.gstNumber}` : null,
    meta.company.qstNumber ? `QST/TVQ: ${meta.company.qstNumber}` : null,
    meta.company.identificationNumber ? `ID: ${meta.company.identificationNumber}` : null,
  ].filter(Boolean).join('   ');
  if (ids) { page.drawText(winAnsi(ids), { x: M, y: y - 9, size: 8, font, color: MUTED }); y -= 13; }
  page.drawText(winAnsi(report.title), { x: M, y: y - 12, size: 12, font: bold, color: INK });
  y -= 18;
  page.drawText(winAnsi(`Period: ${meta.periodLabel}   ·   Generated ${new Date().toISOString().slice(0, 10)}   ·   All amounts CAD`), { x: M, y: y - 9, size: 8.5, font, color: MUTED });
  y -= 18;

  drawHeaderRow();

  const drawRow = (cells: Cell[], strong = false) => {
    const f = strong ? bold : font;
    const linesPerCell = cells.map((cell, i) => {
      const isDesc = i === flex && !cols[i].money;
      const text = fmt(cell, cols[i].money);
      return isDesc ? wrap(text, f, size, widths[i] - padX * 2) : [truncate(text, f, size, widths[i] - padX * 2)];
    });
    const nLines = Math.max(1, ...linesPerCell.map((l) => l.length));
    const rowH = nLines * lineH + 4;
    if (y - rowH < M) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; drawHeaderRow(); }
    if (strong) page.drawRectangle({ x: M, y: y - rowH, width: CONTENT_W, height: rowH, color: HEAD_BG });
    linesPerCell.forEach((lines, i) => {
      lines.forEach((ln, li) => {
        const money = cols[i].money;
        const tw = f.widthOfTextAtSize(ln, size);
        const x = money ? colX(i) + widths[i] - padX - tw : colX(i) + padX;
        page.drawText(ln, { x, y: y - size - 2 - li * lineH, size, font: f, color: INK });
      });
    });
    y -= rowH;
    page.drawLine({ start: { x: M, y }, end: { x: M + CONTENT_W, y }, thickness: 0.3, color: RULE });
  };

  if (report.rows.length === 0) {
    y -= 6;
    page.drawText('No transactions in this period.', { x: M + padX, y: y - size, size, font, color: MUTED });
    y -= lineH;
  } else {
    for (const row of report.rows) drawRow(row);
  }
  if (report.totals) drawRow(report.totals, true);

  if (report.notes?.length) {
    y -= 10;
    for (const n of report.notes) {
      if (y - lineH < M) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; }
      page.drawText(truncate(n, font, 9, CONTENT_W), { x: M, y: y - 9, size: 9, font, color: INK });
      y -= 14;
    }
  }

  return doc.save();
}
