import type { ShiftLineup, LineupAssignment, DayOfWeek, ShiftPeriod } from './types';
import { BAR_AREAS } from './venue-config';
import { SECURITY_AREAS } from './security-venue-config';

// ============================================================
// Public API
// ============================================================

export interface FormatLineupOptions {
  shiftLineup: ShiftLineup;
  selectedDay: DayOfWeek;
  selectedShift: ShiftPeriod;
  date: string;
  closedBars: Set<string>;
  lineupType: 'bartender' | 'security';
}

export function formatLineupText(options: FormatLineupOptions): string {
  if (options.lineupType === 'security') {
    return formatSecurityLineup(options);
  }
  return formatBartenderLineup(options);
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

const COL_W = 28; // bartender column width
const SEC_COL_W = 24; // security column width

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

function pad(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function center(str: string, width: number): string {
  if (str.length >= width) return str;
  const left = Math.floor((width - str.length) / 2);
  return ' '.repeat(left) + str + ' '.repeat(width - str.length - left);
}

function getAssignments(shiftLineup: ShiftLineup, areaId: string): LineupAssignment[] {
  return shiftLineup.areas.find(a => a.areaId === areaId)?.assignments || [];
}

function buildSuffix(assignment: LineupAssignment): string {
  let suffix = '';
  if (assignment.customHours) suffix += ' **';
  if (assignment.isOnCall) suffix += ' (on call)';
  return suffix;
}

function buildSecuritySuffix(assignment: LineupAssignment): string {
  let suffix = '';
  if (assignment.customHours) suffix += ' **';
  if (assignment.isOnCall) suffix += ' - OC';
  return suffix;
}

/** Format one position cell: "  LABEL  Name **" padded to width */
function formatCell(
  label: string,
  assignment: LineupAssignment | undefined,
  width: number,
  suffixFn: (a: LineupAssignment) => string = buildSuffix,
): string {
  const lbl = pad(label, 6);
  if (!assignment || !assignment.employeeId) {
    return pad(`  ${lbl}`, width);
  }
  const name = assignment.employeeName + suffixFn(assignment);
  return pad(`  ${lbl} ${name}`, width);
}

/** Format a server position: "Upstairs, Name" or "Downstairs, Name" */
function formatServerCell(
  label: string,
  assignment: LineupAssignment | undefined,
  width: number,
): string {
  // Convert "Down 1" -> "Downstairs", "Up 1" -> "Upstairs"
  const location = label.startsWith('Down') ? 'Downstairs' : 'Upstairs';
  if (!assignment || !assignment.employeeId) {
    return pad(`  ${location}`, width);
  }
  const name = assignment.employeeName;
  const suffix = assignment.customHours ? ' **' : '';
  return pad(`  ${location}, ${name}${suffix}`, width);
}

// ============================================================
// Bartender Formatter
// ============================================================

function formatBartenderLineup(opts: FormatLineupOptions): string {
  const { shiftLineup, selectedDay, selectedShift, date, closedBars } = opts;
  const lines: string[] = [];

  // Header
  const dateStr = date ? formatHeaderDate(date) : '';
  const header = `${selectedDay} ${SHIFT_ABBR[selectedShift]} (${dateStr})`;
  lines.push(`KOK Lineup${' '.repeat(Math.max(1, COL_W * 2 + 3 - 10 - header.length))}${header}`);
  lines.push('');

  for (const [leftId, rightId] of BARTENDER_PAIRS) {
    const leftClosed = closedBars.has(leftId);
    const rightClosed = closedBars.has(rightId);

    // Skip pair entirely if both closed
    if (leftClosed && rightClosed) continue;

    const leftArea = BAR_AREAS.find(a => a.id === leftId);
    const rightArea = BAR_AREAS.find(a => a.id === rightId);
    if (!leftArea || !rightArea) continue;

    const leftAssigns = getAssignments(shiftLineup, leftId);
    const rightAssigns = getAssignments(shiftLineup, rightId);

    // Area header row
    const leftHeader = leftClosed ? '' : leftArea.name;
    const rightHeader = rightClosed ? '' : rightArea.name;
    lines.push(`${center(leftHeader, COL_W)} | ${center(rightHeader, COL_W)}`);

    // Determine positions to show (skip OC positions without anyone assigned)
    const leftPositions = leftClosed ? [] : leftArea.positions;
    const rightPositions = rightClosed ? [] : rightArea.positions;
    const isServerArea = rightId === 'servers';

    const maxRows = Math.max(leftPositions.length, rightPositions.length);
    for (let i = 0; i < maxRows; i++) {
      const lp = leftPositions[i];
      const rp = rightPositions[i];

      const la = lp ? leftAssigns.find(a => a.positionId === lp.id) : undefined;
      const ra = rp ? rightAssigns.find(a => a.positionId === rp.id) : undefined;

      const leftCell = lp
        ? formatCell(lp.label, la, COL_W)
        : pad('', COL_W);

      let rightCell: string;
      if (!rp) {
        rightCell = '';
      } else if (isServerArea) {
        rightCell = formatServerCell(rp.label, ra, COL_W);
      } else {
        rightCell = formatCell(rp.label, ra, COL_W);
      }

      lines.push(`${leftCell} | ${rightCell}`);
    }

    // Separator between pairs
    lines.push(`${pad('  ---', COL_W)} | ${pad('  ---', COL_W)}`);
  }

  // Remove trailing separator
  if (lines[lines.length - 1]?.includes('---')) {
    lines.pop();
  }

  // Half-shift legend
  const legend = buildLegend(shiftLineup, closedBars);
  if (legend) {
    lines.push('');
    lines.push(legend);
  }

  return lines.join('\n');
}

// ============================================================
// Security Formatter
// ============================================================

function formatSecurityLineup(opts: FormatLineupOptions): string {
  const { shiftLineup, selectedDay, selectedShift, date } = opts;
  const lines: string[] = [];

  // Header
  const dateStr = date ? formatHeaderDate(date) : '';
  const header = `${selectedDay} ${SHIFT_ABBR[selectedShift]} (${dateStr})`;
  const totalW = SEC_COL_W * 3 + 6; // 3 columns + 2 separators
  lines.push(`KOK SECURITY LINEUP${' '.repeat(Math.max(1, totalW - 19 - header.length))}${header}`);
  lines.push('');

  for (const [id1, id2, id3] of SECURITY_TRIPLES) {
    const area1 = SECURITY_AREAS.find(a => a.id === id1);
    const area2 = SECURITY_AREAS.find(a => a.id === id2);
    const area3 = SECURITY_AREAS.find(a => a.id === id3);

    const assigns1 = getAssignments(shiftLineup, id1);
    const assigns2 = getAssignments(shiftLineup, id2);
    const assigns3 = getAssignments(shiftLineup, id3);

    // Area headers
    lines.push(
      `${center(area1?.name || '', SEC_COL_W)} | ${center(area2?.name || '', SEC_COL_W)} | ${center(area3?.name || '', SEC_COL_W)}`
    );

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

      const c1 = p1 ? formatCell(p1.label, a1, SEC_COL_W, buildSecuritySuffix) : pad('', SEC_COL_W);
      const c2 = p2 ? formatCell(p2.label, a2, SEC_COL_W, buildSecuritySuffix) : pad('', SEC_COL_W);
      const c3 = p3 ? formatCell(p3.label, a3, SEC_COL_W, buildSecuritySuffix) : pad('', SEC_COL_W);

      lines.push(`${c1} | ${c2} | ${c3}`);
    }

    // Separator between groups
    lines.push(`${pad('  ---', SEC_COL_W)} | ${pad('  ---', SEC_COL_W)} | ${pad('  ---', SEC_COL_W)}`);
  }

  // Remove trailing separator
  if (lines[lines.length - 1]?.includes('---')) {
    lines.pop();
  }

  // Legend
  const legend = buildSecurityLegend(shiftLineup);
  if (legend) {
    lines.push('');
    lines.push(legend);
  }

  return lines.join('\n');
}

// ============================================================
// Legend Builders
// ============================================================

function buildLegend(shiftLineup: ShiftLineup, closedBars: Set<string>): string {
  const times = new Set<string>();
  for (const area of shiftLineup.areas) {
    if (closedBars.has(area.areaId)) continue;
    for (const a of area.assignments) {
      if (a.customHours && a.employeeId) {
        times.add(a.customHours.start);
      }
    }
  }
  if (times.size === 0) return '';
  const parts = [...times].map(t => `** ${formatHour(t)}`);
  return parts.join('\n');
}

function buildSecurityLegend(shiftLineup: ShiftLineup): string {
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
  const parts: string[] = [];
  if (times.size > 0) {
    parts.push([...times].map(t => `**at ${formatHour(t)}`).join(', '));
  }
  if (hasOC) parts.push('OC = on call');
  return parts.join('\n');
}
