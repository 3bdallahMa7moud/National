/**
 * justificationDocxExport.ts
 *
 * Generates an official Word (.docx) document matching EXACTLY the layout in
 * the reference image:
 *   Page 1 – Letterhead + Summary meta-table + Employee table
 *   Page 2 – Same Letterhead + Confirmation paragraph + Supervisor signature
 *
 * Key design decision: We do NOT use docx running Header/Footer because that
 * caused the document to balloon to 100+ pages (the large header left almost
 * no room for content per page, and cantSplit forced each row onto its own
 * page). Instead we embed the letterhead block as normal body content at the
 * top of each logical "page" and insert a hard page-break between them.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  PageBreak,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { JustificationReportState } from '@/types/employeeJustification';

/* ========================================================================== */
/*  Unit Helpers                                                               */
/* ========================================================================== */
/** pt → half-points (Word's internal size unit) */
const PT = (pt: number) => Math.round(pt * 2);

/** centimetres → twips (1 cm ≈ 567 twips) */
const CM = (cm: number) => Math.round(cm * 567);

/* ========================================================================== */
/*  Border Factories                                                            */
/* ========================================================================== */
function border(color = '000000', size = 4) {
  return { style: BorderStyle.SINGLE, size, color };
}

function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: 'auto' };
}

function allBorders(color = '000000', size = 4) {
  const b = border(color, size);
  return { top: b, bottom: b, left: b, right: b };
}

function noBorders() {
  const nb = noBorder();
  return { top: nb, bottom: nb, left: nb, right: nb };
}

/* ========================================================================== */
/*  Empty Paragraph Helper                                                     */
/* ========================================================================== */
function emptyPara(spacingAfter = 80): Paragraph {
  return new Paragraph({
    children: [new TextRun('')],
    spacing: { before: 0, after: spacingAfter },
  });
}

/* ========================================================================== */
/*  Text Paragraph Helper                                                      */
/* ========================================================================== */
function textPara(
  text: string,
  opts: {
    bold?: boolean;
    size?: number; // pt
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    color?: string;
    underline?: boolean;
    spacingAfter?: number;
    spacingBefore?: number;
    rtl?: boolean;
    indent?: { left?: number; right?: number };
    lineSpacing?: number;
  } = {},
): Paragraph {
  const {
    bold = false,
    size = 10,
    align = AlignmentType.CENTER,
    color = '000000',
    underline = false,
    spacingAfter = 60,
    spacingBefore = 0,
    rtl = false,
    indent,
    lineSpacing,
  } = opts;

  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold,
        size: PT(size),
        font: 'Arial',
        color,
        underline: underline ? { type: UnderlineType.SINGLE, color: '000000' } : undefined,
        rightToLeft: rtl,
      }),
    ],
    alignment: align,
    bidirectional: rtl,
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
      ...(lineSpacing ? { line: lineSpacing } : {}),
    },
    indent,
  });
}

/* ========================================================================== */
/*  Table Cell Helpers                                                         */
/* ========================================================================== */
/** Gray-shaded header cell (matches D9D9D9 in the image) */
function hCell(
  text: string,
  widthDXA: number,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER,
  colSpan?: number,
): TableCell {
  return new TableCell({
    width: { size: widthDXA, type: WidthType.DXA },
    columnSpan: colSpan && colSpan > 1 ? colSpan : undefined,
    shading: { type: ShadingType.SOLID, fill: 'D9D9D9', color: 'D9D9D9' },
    borders: allBorders('000000', 4),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold: true, size: PT(9.5), font: 'Arial', color: '000000' }),
        ],
        alignment: align,
        spacing: { before: 0, after: 0 },
      }),
    ],
  });
}

/** Plain data cell */
function dCell(
  text: string,
  widthDXA: number,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER,
  bold = false,
  colSpan?: number,
): TableCell {
  return new TableCell({
    width: { size: widthDXA, type: WidthType.DXA },
    columnSpan: colSpan && colSpan > 1 ? colSpan : undefined,
    borders: allBorders('000000', 4),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: CM(0.06), bottom: CM(0.06), left: CM(0.1), right: CM(0.1) },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: PT(9.5), font: 'Arial', color: '000000' })],
        alignment: align,
        spacing: { before: 0, after: 0 },
      }),
    ],
  });
}

/* ========================================================================== */
/*  Logo → ImageRun                                                            */
/* ========================================================================== */
async function toImageRun(
  src: string,
  width = 65,
  height = 65,
): Promise<ImageRun | null> {
  try {
    let bytes: Uint8Array;
    let type: 'png' | 'jpg' = 'png';

    if (src.startsWith('data:image/')) {
      const comma = src.indexOf(',');
      const mime = src.slice(0, comma);
      if (/jpeg|jpg/i.test(mime)) type = 'jpg';
      const b64 = atob(src.slice(comma + 1));
      bytes = new Uint8Array(b64.length);
      for (let i = 0; i < b64.length; i++) bytes[i] = b64.charCodeAt(i);
    } else {
      const res = await fetch(src);
      if (!res.ok) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
      if (/\.jpe?g$/i.test(src)) type = 'jpg';
    }

    return new ImageRun({ data: bytes.buffer, transformation: { width, height }, type });
  } catch {
    return null;
  }
}

/* ========================================================================== */
/*  Letterhead Block (placed as body content, not as docx Header)             */
/* ========================================================================== */
/**
 * Returns an array of body elements that form the letterhead:
 *   [logoTable, emptyPara]
 *
 * This is embedded directly in the document body so it does not cause the
 * docx Header to expand and push content to separate pages.
 */
async function buildLetterhead(
  state: JustificationReportState,
  isEng: boolean,
): Promise<(Paragraph | Table)[]> {
  const leftSrc = isEng
    ? state.leftLogo || '/mngha-logo.png'
    : state.rightLogo || '/ct-logo.png';
  const rightSrc = isEng
    ? state.rightLogo || '/ct-logo.png'
    : state.leftLogo || '/mngha-logo.png';

  const leftImg = await toImageRun(leftSrc, 65, 65);
  const rightImg = await toImageRun(rightSrc, 65, 65);

  // Total usable width: 10100 DXA
  // Columns: logo(1600) | center(6900) | logo(1600)
  const LOGO_W = 1600;
  const CENTER_W = 6900;

  const leftCell = new TableCell({
    width: { size: LOGO_W, type: WidthType.DXA },
    borders: noBorders(),
    verticalAlign: VerticalAlign.CENTER,
    children: leftImg
      ? [new Paragraph({ children: [leftImg], alignment: AlignmentType.START, spacing: { before: 0, after: 0 } })]
      : [emptyPara(0)],
  });

  const centerCell = new TableCell({
    width: { size: CENTER_W, type: WidthType.DXA },
    borders: noBorders(),
    verticalAlign: VerticalAlign.CENTER,
    children: [
      textPara(state.kingdomLabel, { bold: true, size: 10, spacingAfter: 40, rtl: !isEng }),
      textPara(state.ministryName, { bold: true, size: 9.5, spacingAfter: 60, rtl: !isEng }),
      textPara(state.departmentName, { bold: true, size: 13, spacingAfter: 80, rtl: !isEng }),
      textPara(state.reportTitle, { bold: true, size: 10, spacingAfter: 0, underline: true, rtl: !isEng }),
    ],
  });

  const rightCell = new TableCell({
    width: { size: LOGO_W, type: WidthType.DXA },
    borders: noBorders(),
    verticalAlign: VerticalAlign.CENTER,
    children: rightImg
      ? [new Paragraph({ children: [rightImg], alignment: AlignmentType.END, spacing: { before: 0, after: 0 } })]
      : [emptyPara(0)],
  });

  const logoTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 10100, type: WidthType.DXA },
    columnWidths: [LOGO_W, CENTER_W, LOGO_W],
    borders: {
      top: noBorder(),
      bottom: noBorder(),
      left: noBorder(),
      right: noBorder(),
      insideHorizontal: noBorder(),
      insideVertical: noBorder(),
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [leftCell, centerCell, rightCell],
      }),
    ],
    visuallyRightToLeft: !isEng,
  });

  return [logoTable, emptyPara(100)];
}

/* ========================================================================== */
/*  Page 1 – Meta Summary Table + Employee Table                              */
/* ========================================================================== */
function buildPage1Tables(
  state: JustificationReportState,
  isEng: boolean,
): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  const monthDisplay =
    state.month.trim() + (state.year?.trim() ? ` ${state.year.trim()}` : '');

  /* ---- Meta Summary Table ---- */
  // Columns: SECTION(2525) | MONTH(4545) | # OF STAFF(3030)
  if (isEng) {
    const metaTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10100, type: WidthType.DXA },
      columnWidths: [2525, 4545, 3030],
      rows: [
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            hCell('SECTION', 2525),
            hCell('MONTH', 4545),
            hCell('# OF STAFF WHO WORKED AFTERHOURS', 3030),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            dCell(state.section || '—', 2525, AlignmentType.CENTER, false),
            dCell(monthDisplay || '—', 4545, AlignmentType.CENTER, false),
            dCell(String(state.numberOfStaff || state.rows.length), 3030, AlignmentType.CENTER, false),
          ],
        }),
      ],
    });
    content.push(metaTable);
  } else {
    // Arabic meta table (right-to-left column order reversed visually)
    const metaTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10100, type: WidthType.DXA },
      columnWidths: [1616, 2828, 1616, 2222, 1010, 808],
      visuallyRightToLeft: true,
      rows: [
        new TableRow({
          cantSplit: true,
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 1616, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, fill: '2B3A55', color: '2B3A55' },
              borders: allBorders('2B3A55', 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
              children: [new Paragraph({ children: [new TextRun({ text: 'القسم', bold: true, size: PT(9.5), font: 'Arial', color: 'FFFFFF', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
            }),
            new TableCell({
              width: { size: 2828, type: WidthType.DXA },
              borders: allBorders('2B3A55', 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
              children: [new Paragraph({ children: [new TextRun({ text: state.section || '—', bold: true, size: PT(9.5), font: 'Arial', color: '000000', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
            }),
            new TableCell({
              width: { size: 1616, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, fill: '2B3A55', color: '2B3A55' },
              borders: allBorders('2B3A55', 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
              children: [new Paragraph({ children: [new TextRun({ text: 'الشهر / السنة', bold: true, size: PT(9.5), font: 'Arial', color: 'FFFFFF', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
            }),
            new TableCell({
              width: { size: 2222, type: WidthType.DXA },
              borders: allBorders('2B3A55', 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
              children: [new Paragraph({ children: [new TextRun({ text: monthDisplay || '—', bold: true, size: PT(9.5), font: 'Arial', color: '000000', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
            }),
            new TableCell({
              width: { size: 1010, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, fill: '2B3A55', color: '2B3A55' },
              borders: allBorders('2B3A55', 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
              children: [new Paragraph({ children: [new TextRun({ text: 'الموظفين', bold: true, size: PT(9.5), font: 'Arial', color: 'FFFFFF', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
            }),
            new TableCell({
              width: { size: 808, type: WidthType.DXA },
              borders: allBorders('2B3A55', 4),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
              children: [new Paragraph({ children: [new TextRun({ text: String(state.numberOfStaff || state.rows.length), bold: true, size: PT(9.5), font: 'Arial', color: '000000', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
            }),
          ],
        }),
      ],
    });
    content.push(metaTable);
  }

  content.push(emptyPara(360));

  /* ---- Employee Table ---- */
  const headers = state.headers;

  if (isEng) {
    // Columns: #(600) | BN(1800) | NAME(5500) | # OF CLAIMED HOURS(2200)
    // Total = 10100 ✓
    const headerRow = new TableRow({
      cantSplit: true,
      tableHeader: true,
      children: [
        hCell(headers.no || '#', 600),
        hCell(headers.bn || 'BN', 1800),
        hCell(headers.name || 'NAME', 5500, AlignmentType.START),
        hCell(headers.claimedHours || '# OF CLAIMED HOURS', 2200),
      ],
    });

    const dataRows = state.rows.map((row, index) =>
      new TableRow({
        // No cantSplit on data rows – allows normal page-flow without blowing pages
        children: [
          dCell(String(index + 1), 600),
          dCell(row.bn, 1800),
          dCell(row.name, 5500, AlignmentType.START),
          dCell(String(row.claimedHours), 2200),
        ],
      }),
    );

    const employeeTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10100, type: WidthType.DXA },
      columnWidths: [600, 1800, 5500, 2200],
      rows: [headerRow, ...dataRows],
    });
    content.push(employeeTable);
  } else {
    // Arabic: #(800) | BN(1800) | Name(4500) | Shifts(1500) | Hours(1500)
    const headerRow = new TableRow({
      cantSplit: true,
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 800, type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, fill: '2B3A55', color: '2B3A55' },
          borders: allBorders('2B3A55', 4),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
          children: [new Paragraph({ children: [new TextRun({ text: headers.no || 'م', bold: true, size: PT(9.5), font: 'Arial', color: 'FFFFFF', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
        }),
        new TableCell({
          width: { size: 1800, type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, fill: '2B3A55', color: '2B3A55' },
          borders: allBorders('2B3A55', 4),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
          children: [new Paragraph({ children: [new TextRun({ text: headers.bn || 'الرقم الوظيفي', bold: true, size: PT(9.5), font: 'Arial', color: 'FFFFFF', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
        }),
        new TableCell({
          width: { size: 4500, type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, fill: '2B3A55', color: '2B3A55' },
          borders: allBorders('2B3A55', 4),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
          children: [new Paragraph({ children: [new TextRun({ text: headers.name || 'اسم الموظف', bold: true, size: PT(9.5), font: 'Arial', color: 'FFFFFF', rightToLeft: true })], alignment: AlignmentType.START, bidirectional: true, spacing: { before: 0, after: 0 } })],
        }),
        new TableCell({
          width: { size: 1500, type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, fill: '2B3A55', color: '2B3A55' },
          borders: allBorders('2B3A55', 4),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
          children: [new Paragraph({ children: [new TextRun({ text: headers.totalShifts || 'عدد المناوبات', bold: true, size: PT(9.5), font: 'Arial', color: 'FFFFFF', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
        }),
        new TableCell({
          width: { size: 1500, type: WidthType.DXA },
          shading: { type: ShadingType.SOLID, fill: '2B3A55', color: '2B3A55' },
          borders: allBorders('2B3A55', 4),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.08), bottom: CM(0.08), left: CM(0.1), right: CM(0.1) },
          children: [new Paragraph({ children: [new TextRun({ text: headers.claimedHours || 'عدد الساعات', bold: true, size: PT(9.5), font: 'Arial', color: 'FFFFFF', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
        }),
      ],
    });

    const dataRows = state.rows.map((row, index) => {
      const shading = index % 2 !== 0 ? 'F9FAFB' : undefined;
      const mkCell = (text: string, w: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER) =>
        new TableCell({
          width: { size: w, type: WidthType.DXA },
          borders: allBorders('2B3A55', 4),
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.06), bottom: CM(0.06), left: CM(0.1), right: CM(0.1) },
          shading: shading ? { type: ShadingType.SOLID, fill: shading, color: shading } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text, size: PT(9.5), font: 'Arial', color: '000000', rightToLeft: true })], alignment: align, bidirectional: true, spacing: { before: 0, after: 0 } })],
        });
      return new TableRow({
        children: [
          mkCell(String(index + 1), 800),
          mkCell(row.bn, 1800),
          mkCell(row.name, 4500, AlignmentType.START),
          mkCell(String(row.totalShifts), 1500),
          mkCell(String(row.claimedHours), 1500),
        ],
      });
    });

    const totalHours = state.rows.reduce((s, r) => s + Number(r.claimedHours || 0), 0);
    const totalRow = new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          columnSpan: 3,
          width: { size: 7100, type: WidthType.DXA },
          borders: allBorders('2B3A55', 4),
          shading: { type: ShadingType.SOLID, fill: 'EEF1F6', color: 'EEF1F6' },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.06), bottom: CM(0.06), left: CM(0.1), right: CM(0.1) },
          children: [new Paragraph({ children: [new TextRun({ text: 'الإجمالي العام / Total', bold: true, size: PT(9.5), font: 'Arial', color: '2B3A55', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
        }),
        new TableCell({
          width: { size: 1500, type: WidthType.DXA },
          borders: allBorders('2B3A55', 4),
          shading: { type: ShadingType.SOLID, fill: 'EEF1F6', color: 'EEF1F6' },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.06), bottom: CM(0.06), left: CM(0.1), right: CM(0.1) },
          children: [new Paragraph({ children: [new TextRun({ text: String(state.rows.length), bold: true, size: PT(9.5), font: 'Arial', color: '2B3A55', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
        }),
        new TableCell({
          width: { size: 1500, type: WidthType.DXA },
          borders: allBorders('2B3A55', 4),
          shading: { type: ShadingType.SOLID, fill: 'EEF1F6', color: 'EEF1F6' },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: CM(0.06), bottom: CM(0.06), left: CM(0.1), right: CM(0.1) },
          children: [new Paragraph({ children: [new TextRun({ text: String(totalHours), bold: true, size: PT(9.5), font: 'Arial', color: '2B3A55', rightToLeft: true })], alignment: AlignmentType.CENTER, bidirectional: true, spacing: { before: 0, after: 0 } })],
        }),
      ],
    });

    const employeeTable = new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10100, type: WidthType.DXA },
      columnWidths: [800, 1800, 4500, 1500, 1500],
      visuallyRightToLeft: true,
      rows: [headerRow, ...dataRows, totalRow],
    });
    content.push(employeeTable);

    content.push(emptyPara(60));
    content.push(
      textPara(`إجمالي الساعات الإضافية المطالب بها: ${totalHours} ساعة`, {
        bold: true,
        size: 10,
        align: AlignmentType.START,
        color: '2B3A55',
        rtl: true,
      }),
    );
  }

  /* ---- Notes ---- */
  if (state.notes?.trim()) {
    content.push(emptyPara(60));
    content.push(
      textPara(`${isEng ? 'Notes:' : 'ملاحظات:'} ${state.notes}`, {
        size: 9,
        align: AlignmentType.START,
        color: '444444',
        rtl: !isEng,
      }),
    );
  }

  return content;
}

/* ========================================================================== */
/*  Page 2 – Confirmation Paragraph + Signature                               */
/* ========================================================================== */
function buildPage2Content(
  state: JustificationReportState,
  isEng: boolean,
): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  content.push(emptyPara(200));

  if (isEng) {
    /* Confirmation paragraph */
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: state.confirmationParagraph,
            size: PT(11),
            font: 'Arial',
            color: '000000',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400, line: 360 },
        indent: { left: CM(1), right: CM(1) },
      }),
    );

    content.push(emptyPara(300));

    /* Signature line */
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '_____________________________________________________________',
            bold: true,
            size: PT(11),
            color: '000000',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
      }),
    );

    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: state.supervisorLabel || "SUPERVISOR'S SIGNATURE/ DATE",
            bold: true,
            size: PT(10.5),
            font: 'Arial',
            color: '000000',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
      }),
    );
  } else {
    /* Arabic confirmation box */
    content.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 10100, type: WidthType.DXA },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 10100, type: WidthType.DXA },
                borders: allBorders('2B3A55', 4),
                shading: { type: ShadingType.SOLID, fill: 'F9FAFB', color: 'F9FAFB' },
                margins: { top: CM(0.3), bottom: CM(0.3), left: CM(0.4), right: CM(0.4) },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: state.confirmationParagraph,
                        size: PT(11),
                        font: 'Arial',
                        color: '111111',
                        rightToLeft: true,
                      }),
                    ],
                    alignment: AlignmentType.BOTH,
                    bidirectional: true,
                    spacing: { before: 120, after: 120, line: 360 },
                  }),
                ],
              }),
            ],
          }),
        ],
        visuallyRightToLeft: true,
      }),
    );

    content.push(emptyPara(160));

    /* Arabic signature box */
    content.push(
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: 5200, type: WidthType.DXA },
        alignment: AlignmentType.START,
        visuallyRightToLeft: true,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 5200, type: WidthType.DXA },
                borders: {
                  top: border('2B3A55', 8),
                  bottom: border('2B3A55', 8),
                  left: border('2B3A55', 8),
                  right: border('2B3A55', 8),
                },
                margins: { top: CM(0.3), bottom: CM(0.3), left: CM(0.4), right: CM(0.4) },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: state.supervisorLabel || 'مشرف القسم', bold: true, size: PT(11), font: 'Arial', color: '2B3A55', rightToLeft: true })],
                    alignment: AlignmentType.CENTER,
                    bidirectional: true,
                    spacing: { before: 80, after: 160 },
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: 'التوقيع / Signature: ___________________', size: PT(9.5), font: 'Arial', color: '333333', rightToLeft: true })],
                    alignment: AlignmentType.START,
                    bidirectional: true,
                    spacing: { before: 80, after: 140 },
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: 'التاريخ / Date:     ___________________', size: PT(9.5), font: 'Arial', color: '333333', rightToLeft: true })],
                    alignment: AlignmentType.START,
                    bidirectional: true,
                    spacing: { before: 80, after: 100 },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  }

  return content;
}

/* ========================================================================== */
/*  Paragraph with page-break before (to force page 2)                        */
/* ========================================================================== */
function pageBreakPara(): Paragraph {
  return new Paragraph({
    children: [new PageBreak()],
    spacing: { before: 0, after: 0 },
  });
}

/* ========================================================================== */
/*  Main Document Builder                                                      */
/* ========================================================================== */
export async function createDocument(state: JustificationReportState): Promise<Document> {
  const isEng =
    state.kingdomLabel.toLowerCase().includes('kingdom') ||
    !state.kingdomLabel.includes('المملكة');

  /* Build both letterheads (they're the same but loaded independently) */
  const letterhead1 = await buildLetterhead(state, isEng);
  const letterhead2 = await buildLetterhead(state, isEng);

  /* Page 1 body */
  const page1Body = buildPage1Tables(state, isEng);

  /* Page 2 body */
  const page2Body = buildPage2Content(state, isEng);

  /* Combine: letterhead1 + page1Body + pageBreak + letterhead2 + page2Body */
  const allChildren: (Paragraph | Table)[] = [
    ...letterhead1,
    ...page1Body,
    pageBreakPara(),
    ...letterhead2,
    ...page2Body,
  ];

  return new Document({
    creator: 'National Guard Hospital Scheduling System',
    title: state.reportTitle,
    description: `OT Justification Report – ${state.month} ${state.year}`,
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: CM(21),
              height: CM(29.7),
            },
            margin: {
              top: CM(1.5),
              bottom: CM(1.5),
              left: CM(1.6),
              right: CM(1.6),
            },
            borders: {
              pageBorderTop: {
                style: BorderStyle.SINGLE,
                size: 24,
                color: '000000',
                space: 20,
              },
              pageBorderBottom: {
                style: BorderStyle.SINGLE,
                size: 24,
                color: '000000',
                space: 20,
              },
              pageBorderLeft: {
                style: BorderStyle.SINGLE,
                size: 24,
                color: '000000',
                space: 20,
              },
              pageBorderRight: {
                style: BorderStyle.SINGLE,
                size: 24,
                color: '000000',
                space: 20,
              },
            },
          },
        },
        children: allChildren,
      },
    ],
  });
}

/* ========================================================================== */
/*  Export Entry Point                                                         */
/* ========================================================================== */
export async function exportJustificationToDocx(
  state: JustificationReportState,
  filename?: string,
): Promise<void> {
  const doc = await createDocument(state);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `OT_Justification_${state.month || 'Report'}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
