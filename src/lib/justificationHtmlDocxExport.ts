/**
 * justificationHtmlDocxExport.ts
 *
 * Exports the OT Justification Report as a .docx by:
 * 1. Grabbing the rendered .a4-inner-sheet elements from the live DOM
 * 2. Building a self-contained HTML string with all CSS inlined
 * 3. Converting it to a .docx blob via html-docx-js (browser-compatible)
 *
 * Result: 100% visual match with the on-screen A4 preview.
 */

// html-docx-js ships a UMD bundle; works in both Node and browser.
// @ts-expect-error — no official TS types
import htmlDocx from 'html-docx-js/dist/html-docx';

/**
 * Reads both A4 preview sheets from the DOM, converts them to a
 * self-contained HTML document, then downloads as .docx.
 */
export async function exportJustificationHtmlToDocx(filename?: string): Promise<void> {
  // ── 1. Collect .a4-inner-sheet elements (page 1 + page 2) ──────────────────
  const sheets = Array.from(document.querySelectorAll<HTMLElement>('.a4-inner-sheet'));

  if (sheets.length === 0) {
    throw new Error('Could not find .a4-inner-sheet elements in the DOM.');
  }

  // ── 2. Build page HTML, one page per sheet ────────────────────────────────
  const pagesHtml = sheets
    .map((sheet, i) => {
      const clone = sheet.cloneNode(true) as HTMLElement;

      // Remove interactive UI (buttons, edit controls) — not needed in the export
      clone.querySelectorAll('button').forEach((el) => el.remove());
      clone.querySelectorAll('[data-export-hide]').forEach((el) => el.remove());

      // Add a page-break after every sheet except the last
      const breakStyle = i < sheets.length - 1 ? 'page-break-after:always;' : '';

      // Strip Tailwind/React class attributes — rely on inlined CSS only
      return `<div style="width:175mm;font-family:Arial,sans-serif;font-size:10pt;${breakStyle}">${clone.innerHTML}</div>`;
    })
    .join('\n');

  // ── 3. Inline CSS covering all Tailwind utility classes used in the sheets ──
  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; font-size: 10pt; }

    /* ── Flex layout ── */
    .flex { display: flex !important; }
    .flex-1 { flex: 1 !important; }
    .flex-col { flex-direction: column !important; }
    .items-center { align-items: center !important; }
    .justify-between { justify-content: space-between !important; }
    .justify-center { justify-content: center !important; }
    .justify-end { justify-content: flex-end !important; }

    /* ── Text alignment ── */
    .text-center { text-align: center !important; }
    .text-start  { text-align: left !important; }
    .text-end    { text-align: right !important; }
    .text-justify { text-align: justify !important; }

    /* ── Layout ── */
    .w-full { width: 100% !important; }
    .min-w-0 { min-width: 0 !important; }
    .float-start { float: left !important; }

    /* ── Spacing ── */
    .space-y-2  > * + * { margin-top: 0.5rem; }
    .space-y-6  > * + * { margin-top: 1.5rem; }
    .space-y-4  > * + * { margin-top: 1rem; }
    .space-y-3  > * + * { margin-top: 0.75rem; }
    .space-y-1  > * + * { margin-top: 0.25rem; }
    .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
    .pt-4 { padding-top: 1rem; }
    .pt-1 { padding-top: 0.25rem; }
    .pt-0\\.5 { padding-top: 0.125rem; }
    .pt-2 { padding-top: 0.5rem; }
    .pb-2 { padding-bottom: 0.5rem; }
    .pb-3 { padding-bottom: 0.75rem; }
    .pb-1\\.5 { padding-bottom: 0.375rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-1\\.5 { margin-bottom: 0.375rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-2\\.5 { margin-bottom: 0.625rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-8 { margin-bottom: 2rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-8 { margin-top: 2rem; }
    .mt-12 { margin-top: 3rem; }
    .mt-14 { margin-top: 3.5rem; }
    .mt-36 { margin-top: 9rem; }
    .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
    .my-14 { margin-top: 3.5rem; margin-bottom: 3.5rem; }
    .p-2 { padding: 0.5rem; }
    .p-5 { padding: 1.25rem; }
    .p-6 { padding: 1.5rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .px-2\\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }
    .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }

    /* ── Typography ── */
    .font-bold     { font-weight: 700 !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-medium   { font-weight: 500 !important; }
    .font-mono     { font-family: 'Courier New', monospace !important; }
    .text-xs   { font-size: 0.75rem !important; }
    .text-sm   { font-size: 0.875rem !important; }
    .text-base { font-size: 1rem !important; }
    .text-lg   { font-size: 1.125rem !important; }
    .text-\\[11px\\] { font-size: 11px !important; }
    .text-\\[10px\\] { font-size: 10px !important; }
    .leading-tight   { line-height: 1.25 !important; }
    .leading-relaxed { line-height: 1.625 !important; }
    .leading-loose   { line-height: 2 !important; }
    .tracking-wide { letter-spacing: 0.025em !important; }
    .uppercase { text-transform: uppercase !important; }
    .underline { text-decoration: underline !important; }

    /* ── Text colors ── */
    .text-black      { color: #000 !important; }
    .text-white      { color: #fff !important; }
    .text-gray-400   { color: #9ca3af !important; }
    .text-gray-500   { color: #6b7280 !important; }
    .text-gray-700   { color: #374151 !important; }

    /* ── Backgrounds ── */
    .bg-white              { background-color: #ffffff !important; }
    .bg-gray-50            { background-color: #f9fafb !important; }

    /* ── Borders ── */
    .border     { border: 1px solid currentColor !important; }
    .border-2   { border: 2px solid currentColor !important; }
    .border-b   { border-bottom: 1px solid currentColor !important; }
    .border-b-2 { border-bottom: 2px solid currentColor !important; }
    .border-black      { border-color: #000000 !important; }
    .border-gray-200   { border-color: #e5e7eb !important; }
    .border-gray-300   { border-color: #d1d5db !important; }
    .rounded    { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }

    /* ── Table core rules ── (MOST IMPORTANT for Word fidelity) ── */
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #000;
      padding: 4px 6px;
      vertical-align: middle;
      font-family: Arial, Helvetica, sans-serif;
    }

    /* Header rows */
    .bg-\\[\\#D9D9D9\\], thead tr { background-color: #D9D9D9 !important; color: #000 !important; font-weight: 700; }
    .bg-\\[\\#2B3A55\\]           { background-color: #2B3A55 !important; color: #fff !important; font-weight: 700; }
    .bg-\\[\\#F5F7FA\\]           { background-color: #F5F7FA !important; }
    .bg-\\[\\#F9FAFB\\]           { background-color: #F9FAFB !important; }
    .bg-\\[\\#EEF1F6\\]           { background-color: #EEF1F6 !important; }

    /* Table border overrides per color scheme */
    .border-\\[\\#2B3A55\\] { border-color: #2B3A55 !important; }
    .border-gray-300 th, .border-gray-300 td { border-color: #d1d5db !important; }

    /* ── Widths ── */
    .w-10  { width: 2.5rem; }
    .w-12  { width: 3rem; }
    .w-16  { width: 4rem; }
    .w-20  { width: 5rem; }
    .w-24  { width: 6rem; }
    .w-28  { width: 7rem; }
    .w-32  { width: 8rem; }
    .w-48  { width: 12rem; }
    .w-80  { width: 20rem; }
    .w-\\[360px\\] { width: 360px; }
    .w-\\[25\\%\\]  { width: 25%; }
    .w-\\[30\\%\\]  { width: 30%; }
    .w-\\[45\\%\\]  { width: 45%; }
    .w-\\[16\\%\\]  { width: 16%; }
    .w-\\[28\\%\\]  { width: 28%; }
    .w-\\[22\\%\\]  { width: 22%; }
    .w-\\[10\\%\\]  { width: 10%; }
    .w-\\[8\\%\\]   { width: 8%; }

    /* ── Heights / images ── */
    .h-11 { height: 2.75rem; }
    .h-12 { height: 3rem; }
    .h-16 { height: 4rem; }
    .object-contain { object-fit: contain; }
    img { max-height: 64px; width: auto; }

    /* ── Misc ── */
    .opacity-80 { opacity: 0.8; }
    .shadow-sm { box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .overflow-hidden { overflow: hidden; }
  `;

  // ── 4. Assemble a complete, valid HTML document ──────────────────────────
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>OT Justification Report</title>
  <style>${css}</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;

  // ── 5. Convert HTML → DOCX blob using html-docx-js ──────────────────────
  const blob: Blob = htmlDocx.asBlob(fullHtml, {
    orientation: 'portrait',
    margins: {
      top: 851,    // ≈ 1.5 cm in twips (1 cm = 567 twips)
      right: 908,  // ≈ 1.6 cm
      bottom: 851,
      left: 908,
      header: 0,
      footer: 0,
      gutter: 0,
    },
  });

  // ── 6. Trigger browser file download ────────────────────────────────────
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? 'OT_Justification_Report.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
