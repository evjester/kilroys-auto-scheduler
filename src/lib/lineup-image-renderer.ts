import type { ShiftLineup, LineupAssignment, DayOfWeek, ShiftPeriod } from './types';
import { BAR_AREAS } from './venue-config';
import { SECURITY_AREAS } from './security-venue-config';

// ============================================================
// Public API
// ============================================================

export interface RenderLineupOptions {
  shiftLineup: ShiftLineup;
  selectedDay: DayOfWeek;
  selectedShift: ShiftPeriod;
  date: string;
  closedBars: Set<string>;
  lineupType: 'bartender' | 'security';
}

/** Render lineup to a canvas and return as a downloadable Blob */
export async function renderLineupImage(options: RenderLineupOptions): Promise<Blob> {
  if (options.lineupType === 'security') {
    return renderSecurityImage(options);
  }
  return renderBartenderImage(options);
}

// ============================================================
// Constants
// ============================================================

const SHIFT_ABBR: Record<ShiftPeriod, string> = {
  'morning': 'AM',
  'happy-hour': 'HH',
  'night': 'CL',
};

const BARTENDER_PAIRS: [string, string][] = [
  ['old-bar', 'new-bar'],
  ['duffys-bar', 'patio-bar'],
  ['upstairs-bar', 'servers'],
];

const SECURITY_TRIPLES: [string, string, string][] = [
  ['carders', 'exit-doors', 'fixed-posts'],
  ['roam-new-bar', 'roam-old-bar', 'roam-patio-bar'],
  ['roam-duffys-bar', 'roam-upstairs-bar', 'back-of-house'],
];

const FONT = 'Arial, Helvetica, sans-serif';
const HEADER_FONT_SIZE = 32;
const AREA_HEADER_FONT_SIZE = 26;
const CELL_FONT_SIZE = 22;
const LEGEND_FONT_SIZE = 20;
const ROW_HEIGHT = 44;
const HEADER_ROW_HEIGHT = 48;
const PADDING_X = 20;
const TABLE_MARGIN_TOP = 60;
const TABLE_MARGIN_LEFT = 40;
const TABLE_MARGIN_RIGHT = 40;
const TABLE_MARGIN_BOTTOM = 40;
const BORDER_WIDTH = 2;
const THICK_BORDER = 3;

// ============================================================
// Helpers
// ============================================================

function formatHeaderDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${parseInt(month)}.${parseInt(day)}.${year.slice(2)}`;
}

function formatHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

function getAssignments(shiftLineup: ShiftLineup, areaId: string): LineupAssignment[] {
  return shiftLineup.areas.find(a => a.areaId === areaId)?.assignments || [];
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create image blob'));
    }, 'image/png');
  });
}

// ============================================================
// Bartender Image Renderer
// ============================================================

interface RowData {
  type: 'header' | 'row' | 'separator';
  leftHeader?: string;
  rightHeader?: string;
  leftLabel?: string;
  leftName?: string;
  leftIsBarback?: boolean;
  leftHasStar?: boolean;
  leftOnCall?: boolean;
  rightLabel?: string;
  rightName?: string;
  rightIsBarback?: boolean;
  rightHasStar?: boolean;
  rightOnCall?: boolean;
  rightIsServer?: boolean;
}

function buildBartenderRows(opts: RenderLineupOptions): RowData[] {
  const { shiftLineup, closedBars } = opts;
  const rows: RowData[] = [];

  for (const [leftId, rightId] of BARTENDER_PAIRS) {
    const leftClosed = closedBars.has(leftId);
    const rightClosed = closedBars.has(rightId);
    if (leftClosed && rightClosed) continue;

    const leftArea = BAR_AREAS.find(a => a.id === leftId);
    const rightArea = BAR_AREAS.find(a => a.id === rightId);
    if (!leftArea || !rightArea) continue;

    const leftAssigns = getAssignments(shiftLineup, leftId);
    const rightAssigns = getAssignments(shiftLineup, rightId);

    // Area header
    rows.push({
      type: 'header',
      leftHeader: leftClosed ? '' : leftArea.name,
      rightHeader: rightClosed ? '' : rightArea.name,
    });

    const leftPositions = leftClosed ? [] : leftArea.positions;
    const rightPositions = rightClosed ? [] : rightArea.positions;
    const isServerArea = rightId === 'servers';
    const maxRows = Math.max(leftPositions.length, rightPositions.length);

    for (let i = 0; i < maxRows; i++) {
      const lp = leftPositions[i];
      const rp = rightPositions[i];
      const la = lp ? leftAssigns.find(a => a.positionId === lp.id) : undefined;
      const ra = rp ? rightAssigns.find(a => a.positionId === rp.id) : undefined;

      const row: RowData = { type: 'row' };

      if (lp) {
        row.leftLabel = lp.label;
        row.leftName = la?.employeeId ? la.employeeName : '';
        row.leftIsBarback = lp.type === 'barback';
        row.leftHasStar = !!(la?.customHours && la?.employeeId);
        row.leftOnCall = !!(la?.isOnCall && la?.employeeId);
      }

      if (rp) {
        row.rightIsServer = isServerArea;
        if (isServerArea) {
          const location = rp.label.startsWith('Down') ? 'Downstairs' : 'Upstairs';
          row.rightLabel = location;
          row.rightName = ra?.employeeId ? ra.employeeName : '';
        } else {
          row.rightLabel = rp.label;
          row.rightName = ra?.employeeId ? ra.employeeName : '';
          row.rightIsBarback = rp.type === 'barback';
        }
        row.rightHasStar = !!(ra?.customHours && ra?.employeeId);
        row.rightOnCall = !!(ra?.isOnCall && ra?.employeeId);
      }

      rows.push(row);
    }

    // Separator between pairs
    rows.push({ type: 'separator' });
  }

  // Remove trailing separator
  if (rows.length > 0 && rows[rows.length - 1].type === 'separator') {
    rows.pop();
  }

  return rows;
}

function renderBartenderImage(opts: RenderLineupOptions): Promise<Blob> {
  const { selectedDay, selectedShift, date, shiftLineup, closedBars } = opts;
  const rows = buildBartenderRows(opts);

  const COL_W = 380;
  const LABEL_COL_W = 100;
  const DIVIDER_W = THICK_BORDER;
  const tableW = COL_W * 2 + DIVIDER_W;
  const canvasW = TABLE_MARGIN_LEFT + tableW + TABLE_MARGIN_RIGHT;

  // Calculate legend
  const legendLines = buildLegendLines(shiftLineup, closedBars);

  const tableRows = rows.length;
  const tableH = tableRows * ROW_HEIGHT;
  const legendH = legendLines.length > 0 ? 20 + legendLines.length * 30 : 0;
  const canvasH = TABLE_MARGIN_TOP + tableH + TABLE_MARGIN_BOTTOM + legendH + 10;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Header text
  const dateStr = date ? formatHeaderDate(date) : '';
  const headerRight = `${selectedDay} ${SHIFT_ABBR[selectedShift]} (${dateStr})`;

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${HEADER_FONT_SIZE}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('KOK Lineup', TABLE_MARGIN_LEFT, TABLE_MARGIN_TOP / 2);
  ctx.textAlign = 'right';
  ctx.fillText(headerRight, TABLE_MARGIN_LEFT + tableW, TABLE_MARGIN_TOP / 2);

  // Draw table
  const tX = TABLE_MARGIN_LEFT;
  const tY = TABLE_MARGIN_TOP;
  let y = tY;

  // Outer table border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = THICK_BORDER;
  ctx.strokeRect(tX, tY, tableW, tableH);

  for (const row of rows) {
    if (row.type === 'header') {
      // Header row background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tX + 1, y + 1, tableW - 2, ROW_HEIGHT - 1);

      // Draw header text centered in each column
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${AREA_HEADER_FONT_SIZE}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (row.leftHeader) {
        ctx.fillText(row.leftHeader, tX + COL_W / 2, y + ROW_HEIGHT / 2);
      }
      if (row.rightHeader) {
        ctx.fillText(row.rightHeader, tX + COL_W + DIVIDER_W + COL_W / 2, y + ROW_HEIGHT / 2);
      }

      // Bottom border for header
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = THICK_BORDER;
      ctx.beginPath();
      ctx.moveTo(tX, y + ROW_HEIGHT);
      ctx.lineTo(tX + tableW, y + ROW_HEIGHT);
      ctx.stroke();

      // Center divider
      ctx.lineWidth = BORDER_WIDTH;
      ctx.beginPath();
      ctx.moveTo(tX + COL_W, y);
      ctx.lineTo(tX + COL_W, y + ROW_HEIGHT);
      ctx.stroke();

      y += ROW_HEIGHT;
    } else if (row.type === 'separator') {
      // Thick horizontal line between area groups
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = THICK_BORDER;
      ctx.beginPath();
      ctx.moveTo(tX, y);
      ctx.lineTo(tX + tableW, y);
      ctx.stroke();
    } else {
      // Data row
      // Row bottom border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = BORDER_WIDTH;
      ctx.beginPath();
      ctx.moveTo(tX, y + ROW_HEIGHT);
      ctx.lineTo(tX + tableW, y + ROW_HEIGHT);
      ctx.stroke();

      // Center divider
      ctx.beginPath();
      ctx.moveTo(tX + COL_W, y);
      ctx.lineTo(tX + COL_W, y + ROW_HEIGHT);
      ctx.stroke();

      // Left cell: label | name
      if (row.leftLabel !== undefined) {
        drawCell(ctx, tX, y, LABEL_COL_W, COL_W, row.leftLabel, row.leftName || '', {
          isBarback: row.leftIsBarback,
          hasStar: row.leftHasStar,
          onCall: row.leftOnCall,
        });
        // Label/name divider in left column
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = BORDER_WIDTH;
        ctx.beginPath();
        ctx.moveTo(tX + LABEL_COL_W, y);
        ctx.lineTo(tX + LABEL_COL_W, y + ROW_HEIGHT);
        ctx.stroke();
      }

      // Right cell
      if (row.rightLabel !== undefined) {
        const rX = tX + COL_W + DIVIDER_W;
        if (row.rightIsServer) {
          // Server: no label column, just "Location, Name"
          drawServerCell(ctx, rX, y, COL_W, row.rightLabel, row.rightName || '', {
            hasStar: row.rightHasStar,
          });
        } else {
          drawCell(ctx, rX, y, LABEL_COL_W, COL_W, row.rightLabel, row.rightName || '', {
            isBarback: row.rightIsBarback,
            hasStar: row.rightHasStar,
            onCall: row.rightOnCall,
          });
          // Label/name divider in right column
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = BORDER_WIDTH;
          ctx.beginPath();
          ctx.moveTo(rX + LABEL_COL_W, y);
          ctx.lineTo(rX + LABEL_COL_W, y + ROW_HEIGHT);
          ctx.stroke();
        }
      }

      y += ROW_HEIGHT;
    }
  }

  // Legend
  if (legendLines.length > 0) {
    ctx.font = `bold ${LEGEND_FONT_SIZE}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cc0000';
    let ly = y + 30;
    for (const line of legendLines) {
      ctx.fillText(line, tX + tableW, ly);
      ly += 26;
    }
  }

  return canvasToBlob(canvas);
}

interface CellOpts {
  isBarback?: boolean;
  hasStar?: boolean;
  onCall?: boolean;
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  labelW: number, totalW: number,
  label: string, name: string,
  opts: CellOpts,
) {
  const cy = y + ROW_HEIGHT / 2;

  // Label (bold, centered in label column)
  const isBlue = opts.isBarback;
  ctx.fillStyle = isBlue ? '#0066cc' : '#000000';
  ctx.font = `bold ${CELL_FONT_SIZE}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + labelW / 2, cy);

  // Name
  if (name) {
    const nameX = x + labelW + PADDING_X;
    ctx.textAlign = 'left';

    // Build display text
    let displayName = name;
    if (opts.onCall) displayName += ' (on call)';

    ctx.fillStyle = isBlue ? '#0066cc' : '#000000';
    ctx.font = `${CELL_FONT_SIZE}px ${FONT}`;
    ctx.fillText(displayName, nameX, cy);

    // Star suffix in red
    if (opts.hasStar) {
      const nameWidth = ctx.measureText(displayName).width;
      ctx.fillStyle = '#cc0000';
      ctx.font = `bold ${CELL_FONT_SIZE}px ${FONT}`;
      ctx.fillText(' **', nameX + nameWidth, cy);
    }
  }
}

function drawServerCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  totalW: number,
  location: string, name: string,
  opts: { hasStar?: boolean },
) {
  const cy = y + ROW_HEIGHT / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';
  ctx.font = `${CELL_FONT_SIZE}px ${FONT}`;

  let text = name ? `${location}, ${name}` : location;
  if (opts.hasStar && name) text += ' **';

  if (opts.hasStar && name) {
    // Draw base text then star in red
    const baseText = `${location}, ${name}`;
    ctx.fillText(baseText, x + totalW / 2, cy);
    const baseW = ctx.measureText(baseText).width;
    ctx.fillStyle = '#cc0000';
    ctx.font = `bold ${CELL_FONT_SIZE}px ${FONT}`;
    const startX = x + totalW / 2 + baseW / 2;
    ctx.textAlign = 'left';
    ctx.fillText(' **', startX, cy);
  } else {
    ctx.fillText(text, x + totalW / 2, cy);
  }
}

// ============================================================
// Security Image Renderer
// ============================================================

interface SecRowData {
  type: 'header' | 'row' | 'separator';
  headers?: [string, string, string];
  cells?: [SecCell | null, SecCell | null, SecCell | null];
}

interface SecCell {
  label: string;
  name: string;
  hasStar: boolean;
  onCall: boolean;
}

function buildSecurityRows(opts: RenderLineupOptions): SecRowData[] {
  const { shiftLineup } = opts;
  const rows: SecRowData[] = [];

  for (const [id1, id2, id3] of SECURITY_TRIPLES) {
    const area1 = SECURITY_AREAS.find(a => a.id === id1);
    const area2 = SECURITY_AREAS.find(a => a.id === id2);
    const area3 = SECURITY_AREAS.find(a => a.id === id3);

    const assigns1 = getAssignments(shiftLineup, id1);
    const assigns2 = getAssignments(shiftLineup, id2);
    const assigns3 = getAssignments(shiftLineup, id3);

    rows.push({
      type: 'header',
      headers: [area1?.name || '', area2?.name || '', area3?.name || ''],
    });

    const pos1 = area1?.positions || [];
    const pos2 = area2?.positions || [];
    const pos3 = area3?.positions || [];
    const maxRows = Math.max(pos1.length, pos2.length, pos3.length);

    for (let i = 0; i < maxRows; i++) {
      const p1 = pos1[i];
      const p2 = pos2[i];
      const p3 = pos3[i];
      const a1 = p1 ? assigns1.find(a => a.positionId === p1.id) : undefined;
      const a2 = p2 ? assigns2.find(a => a.positionId === p2.id) : undefined;
      const a3 = p3 ? assigns3.find(a => a.positionId === p3.id) : undefined;

      const makeCell = (p: typeof p1, a: typeof a1): SecCell | null => {
        if (!p) return null;
        return {
          label: p.label,
          name: a?.employeeId ? a.employeeName : '',
          hasStar: !!(a?.customHours && a?.employeeId),
          onCall: !!(a?.isOnCall && a?.employeeId),
        };
      };

      rows.push({
        type: 'row',
        cells: [makeCell(p1, a1), makeCell(p2, a2), makeCell(p3, a3)],
      });
    }

    rows.push({ type: 'separator' });
  }

  if (rows.length > 0 && rows[rows.length - 1].type === 'separator') {
    rows.pop();
  }

  return rows;
}

function renderSecurityImage(opts: RenderLineupOptions): Promise<Blob> {
  const { selectedDay, selectedShift, date, shiftLineup } = opts;
  const rows = buildSecurityRows(opts);

  const COL_W = 380;
  const LABEL_COL_W = 100;
  const DIVIDER_W = THICK_BORDER;
  const tableW = COL_W * 3 + DIVIDER_W * 2;
  const canvasW = TABLE_MARGIN_LEFT + tableW + TABLE_MARGIN_RIGHT;

  const legendLines = buildSecurityLegendLines(shiftLineup);
  const tableRows = rows.length;
  const tableH = tableRows * ROW_HEIGHT;
  const legendH = legendLines.length > 0 ? 20 + legendLines.length * 30 : 0;
  const canvasH = TABLE_MARGIN_TOP + tableH + TABLE_MARGIN_BOTTOM + legendH + 10;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Header text
  const dateStr = date ? formatHeaderDate(date) : '';
  const headerRight = `${selectedDay} ${SHIFT_ABBR[selectedShift]} (${dateStr})`;

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${HEADER_FONT_SIZE}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('KOK SECURITY LINEUP', TABLE_MARGIN_LEFT, TABLE_MARGIN_TOP / 2);
  ctx.textAlign = 'right';
  ctx.fillText(headerRight, TABLE_MARGIN_LEFT + tableW, TABLE_MARGIN_TOP / 2);

  const tX = TABLE_MARGIN_LEFT;
  const tY = TABLE_MARGIN_TOP;
  let y = tY;

  // Outer border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = THICK_BORDER;
  ctx.strokeRect(tX, tY, tableW, tableH);

  for (const row of rows) {
    if (row.type === 'header') {
      const hdrs = row.headers!;
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${AREA_HEADER_FONT_SIZE}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let c = 0; c < 3; c++) {
        const colX = tX + c * (COL_W + DIVIDER_W);
        ctx.fillText(hdrs[c], colX + COL_W / 2, y + ROW_HEIGHT / 2);
      }

      // Bottom border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = THICK_BORDER;
      ctx.beginPath();
      ctx.moveTo(tX, y + ROW_HEIGHT);
      ctx.lineTo(tX + tableW, y + ROW_HEIGHT);
      ctx.stroke();

      // Column dividers
      ctx.lineWidth = BORDER_WIDTH;
      for (let c = 1; c < 3; c++) {
        const divX = tX + c * COL_W + (c - 1) * DIVIDER_W + DIVIDER_W / 2;
        ctx.beginPath();
        ctx.moveTo(divX, y);
        ctx.lineTo(divX, y + ROW_HEIGHT);
        ctx.stroke();
      }

      y += ROW_HEIGHT;
    } else if (row.type === 'separator') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = THICK_BORDER;
      ctx.beginPath();
      ctx.moveTo(tX, y);
      ctx.lineTo(tX + tableW, y);
      ctx.stroke();
    } else {
      const cells = row.cells!;

      // Row bottom border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = BORDER_WIDTH;
      ctx.beginPath();
      ctx.moveTo(tX, y + ROW_HEIGHT);
      ctx.lineTo(tX + tableW, y + ROW_HEIGHT);
      ctx.stroke();

      // Column dividers
      for (let c = 1; c < 3; c++) {
        const divX = tX + c * COL_W + (c - 1) * DIVIDER_W + DIVIDER_W / 2;
        ctx.beginPath();
        ctx.moveTo(divX, y);
        ctx.lineTo(divX, y + ROW_HEIGHT);
        ctx.stroke();
      }

      // Draw each cell
      for (let c = 0; c < 3; c++) {
        const cell = cells[c];
        if (!cell) continue;
        const colX = tX + c * (COL_W + DIVIDER_W);

        drawSecurityCell(ctx, colX, y, LABEL_COL_W, COL_W, cell);

        // Label/name divider
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = BORDER_WIDTH;
        ctx.beginPath();
        ctx.moveTo(colX + LABEL_COL_W, y);
        ctx.lineTo(colX + LABEL_COL_W, y + ROW_HEIGHT);
        ctx.stroke();
      }

      y += ROW_HEIGHT;
    }
  }

  // Legend
  if (legendLines.length > 0) {
    ctx.font = `bold ${LEGEND_FONT_SIZE}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cc0000';
    let ly = y + 30;
    for (const line of legendLines) {
      ctx.fillText(line, tX + tableW, ly);
      ly += 26;
    }
  }

  return canvasToBlob(canvas);
}

function drawSecurityCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  labelW: number, totalW: number,
  cell: SecCell,
) {
  const cy = y + ROW_HEIGHT / 2;

  // Label
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${CELL_FONT_SIZE}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cell.label, x + labelW / 2, cy);

  // Name
  if (cell.name) {
    const nameX = x + labelW + PADDING_X;
    ctx.textAlign = 'left';

    if (cell.onCall) {
      // Name in red with "- OC"
      ctx.fillStyle = '#cc0000';
      ctx.font = `${CELL_FONT_SIZE}px ${FONT}`;
      ctx.fillText(`${cell.name} - OC`, nameX, cy);
    } else {
      ctx.fillStyle = '#000000';
      ctx.font = `${CELL_FONT_SIZE}px ${FONT}`;
      ctx.fillText(cell.name, nameX, cy);
    }

    // Star suffix
    if (cell.hasStar) {
      const displayName = cell.onCall ? `${cell.name} - OC` : cell.name;
      const nameWidth = ctx.measureText(displayName).width;
      ctx.fillStyle = '#cc0000';
      ctx.font = `bold ${CELL_FONT_SIZE}px ${FONT}`;
      ctx.fillText(' **', nameX + nameWidth, cy);
    }
  }
}

// ============================================================
// Legend Builders
// ============================================================

function buildLegendLines(shiftLineup: ShiftLineup, closedBars: Set<string>): string[] {
  const times = new Set<string>();
  for (const area of shiftLineup.areas) {
    if (closedBars.has(area.areaId)) continue;
    for (const a of area.assignments) {
      if (a.customHours && a.employeeId) {
        times.add(a.customHours.start);
      }
    }
  }
  if (times.size === 0) return [];
  return [...times].map(t => `** ${formatHour(t)}`);
}

function buildSecurityLegendLines(shiftLineup: ShiftLineup): string[] {
  const times = new Set<string>();
  let hasOC = false;
  for (const area of shiftLineup.areas) {
    for (const a of area.assignments) {
      if (a.customHours && a.employeeId) {
        times.add(a.customHours.start);
      }
      if (a.isOnCall && a.employeeId) hasOC = true;
    }
  }
  const lines: string[] = [];
  if (times.size > 0) {
    lines.push([...times].map(t => `**at ${formatHour(t)}`).join(', '));
  }
  if (hasOC) lines.push('OC = on call');
  return lines;
}
