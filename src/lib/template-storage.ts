/**
 * Template Storage — CRUD for saved generation templates + default builders
 * Stores templates in localStorage under 'kilroys-saved-templates'
 */

import type { ShiftStaffing, BarStaffing, ShiftConfig, GenerateDayConfig, GenerationConfig, SavedTemplate, DayOfWeek, ShiftPeriod, SecurityStaffing } from './types';
import { DAYS, DEFAULT_SHIFT_TEMPLATES, DEFAULT_SHIFT_CLOSED_BARS, getStaffingReqs } from './mock-config';
import { BAR_AREAS } from './venue-config';
import { SECURITY_ROAM_AREAS } from './security-venue-config';

const BARTENDER_STORAGE_KEY = 'kilroys-bartender-templates';
const SECURITY_STORAGE_KEY = 'kilroys-security-templates';
const OLD_STORAGE_KEY = 'kilroys-saved-templates';

/** ShiftPeriod → scheduler ShiftType mapping */
const PERIOD_TO_SHIFT_TYPE: Record<ShiftPeriod, 'AM' | 'PM' | 'Late'> = {
  'morning':    'AM',
  'happy-hour': 'PM',
  'night':      'Late',
};

/** Bar area IDs (excluding servers — servers are tracked globally) */
const BAR_IDS = BAR_AREAS.filter(a => a.id !== 'servers').map(a => a.id);

/** Count of bartender-eligible positions per bar (speed + standard) */
const BAR_POSITION_COUNTS: Record<string, number> = {};
for (const area of BAR_AREAS) {
  if (area.id === 'servers') continue;
  BAR_POSITION_COUNTS[area.id] = area.positions.filter(
    p => p.type === 'speed' || p.type === 'standard'
  ).length;
}
const TOTAL_BAR_POSITIONS = Object.values(BAR_POSITION_COUNTS).reduce((a, b) => a + b, 0);

/** Distribute a total count proportionally across bars, respecting closed bars.
 *  Guarantees each open bar gets at least 1 when total >= number of open bars. */
function distributeCount(total: number, closedBarIds: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  const openBars = BAR_IDS.filter(id => !closedBarIds.includes(id));
  const openPositions = openBars.reduce((sum, id) => sum + (BAR_POSITION_COUNTS[id] || 0), 0);

  // Closed bars get 0
  for (const id of closedBarIds) {
    result[id] = 0;
  }

  if (openPositions === 0 || total <= 0) {
    for (const id of openBars) result[id] = 0;
    return result;
  }

  // Guarantee minimum 1 per open bar when we have enough
  const minPerBar = total >= openBars.length ? 1 : 0;
  const guaranteed = minPerBar * openBars.length;
  const remaining = total - guaranteed;

  // Distribute the surplus proportionally, rounding down
  let distributed = 0;
  const shares: { id: string; exact: number }[] = [];
  for (const id of openBars) {
    const exact = remaining > 0 ? (remaining * (BAR_POSITION_COUNTS[id] || 0)) / openPositions : 0;
    const floored = Math.floor(exact);
    result[id] = minPerBar + floored;
    distributed += floored;
    shares.push({ id, exact: exact - floored });
  }

  // Distribute remainder by largest fractional part
  shares.sort((a, b) => b.exact - a.exact);
  let leftover = remaining - distributed;
  for (const s of shares) {
    if (leftover <= 0) break;
    result[s.id]++;
    leftover--;
  }

  return result;
}

/** Convert getStaffingReqs output to per-bar ShiftStaffing */
export function getDefaultShiftStaffing(day: DayOfWeek, shiftPeriod: ShiftPeriod): ShiftStaffing {
  const shiftType = PERIOD_TO_SHIFT_TYPE[shiftPeriod];
  const reqs = getStaffingReqs(day, shiftType);
  const closedBarIds = DEFAULT_SHIFT_CLOSED_BARS[shiftPeriod] || [];

  let totalBartenders = 0;
  let totalBarbacks = 0;
  let totalServers = 0;

  for (const req of reqs) {
    switch (req.role) {
      case 'Bartender':      totalBartenders += req.count; break;
      case 'Barback':        totalBarbacks = req.count; break;
      case 'Server':         totalServers = req.count; break;
    }
  }

  // Split servers into downstairs (max 3 positions) and upstairs (max 1)
  const downServers = Math.min(totalServers, 3);
  const upServers = Math.min(Math.max(totalServers - 3, 0), 1);

  // Distribute bartenders across bars proportionally
  const bartenderDist = distributeCount(totalBartenders, closedBarIds);

  // Distribute barbacks: one per open bar that has barback positions, up to total
  const openBarsWithBB = BAR_IDS.filter(id => !closedBarIds.includes(id));
  const barbackDist: Record<string, number> = {};
  let barbacksRemaining = totalBarbacks;
  for (const id of BAR_IDS) {
    if (closedBarIds.includes(id)) {
      barbackDist[id] = 0;
    } else if (barbacksRemaining > 0) {
      barbackDist[id] = 1;
      barbacksRemaining--;
    } else {
      barbackDist[id] = 0;
    }
  }

  // Determine default on-calls and halves based on day/shift busyness
  const isWeekend = day === 'Friday' || day === 'Saturday';
  const isThursday = day === 'Thursday';
  const isBusy = isWeekend || isThursday;
  const isNight = shiftPeriod === 'night';
  const isPM = shiftPeriod === 'happy-hour';

  // Build per-bar staffing
  const bars: Record<string, BarStaffing> = {};
  for (const id of BAR_IDS) {
    const isClosed = closedBarIds.includes(id);
    const btCount = bartenderDist[id] || 0;

    // On-calls: every open bar gets OC on busy nights, larger bars get more
    let onCalls = 0;
    if (!isClosed && btCount >= 1) {
      if (isNight && isWeekend) onCalls = btCount >= 2 ? 2 : 1;
      else if (isNight && isBusy) onCalls = 1;
      else if (isPM && isWeekend) onCalls = 1;
    }

    // Halves: 1 per bar with 2+ bartenders on busy nights
    let halves = 0;
    if (!isClosed && btCount >= 2 && isNight && isWeekend) {
      halves = 1;
    }

    bars[id] = {
      bartenders: btCount,
      barbacks: barbackDist[id] || 0,
      onCalls,
      halves,
    };
  }

  return {
    bars,
    servers: { downstairs: downServers, upstairs: upServers },
    doormen: 0,
  };
}

/** Get default security staffing for a given day and shift period */
export function getDefaultSecurityStaffing(day: DayOfWeek, shiftPeriod: ShiftPeriod): SecurityStaffing {
  const isWeekend = day === 'Friday' || day === 'Saturday';
  const isThursday = day === 'Thursday';
  const isBusy = isWeekend || isThursday;

  if (shiftPeriod === 'morning') {
    return { carders: 0, exitDoors: 0, fixedPosts: 0, roam: buildRoamDefaults(0), boh: { dish: 0, expo: 0 } };
  }

  if (shiftPeriod === 'happy-hour') {
    return {
      carders: isBusy ? 2 : 0,
      exitDoors: isBusy ? 1 : 0,
      fixedPosts: 0,
      roam: buildRoamDefaults(isBusy ? 1 : 0),
      boh: isBusy ? { dish: 1, expo: 0 } : { dish: 0, expo: 0 },
    };
  }

  // Night — full security (2 dish positions, 1 expo position)
  return {
    carders: isWeekend ? 4 : isBusy ? 4 : 2,
    exitDoors: isWeekend ? 4 : isBusy ? 3 : 2,
    fixedPosts: isWeekend ? 2 : isBusy ? 2 : 1,
    roam: buildRoamDefaults(isWeekend ? 3 : isBusy ? 2 : 1),
    boh: isWeekend ? { dish: 2, expo: 1 } : isBusy ? { dish: 1, expo: 1 } : { dish: 1, expo: 0 },
  };
}

function buildRoamDefaults(countPerArea: number): Record<string, number> {
  const roam: Record<string, number> = {};
  for (const area of SECURITY_ROAM_AREAS) {
    roam[area.id] = Math.min(countPerArea, area.positions.length);
  }
  return roam;
}

/** Build a default ShiftConfig for a given day and shift period */
export function buildDefaultShiftConfig(day: DayOfWeek, shiftPeriod: ShiftPeriod): ShiftConfig {
  const template = DEFAULT_SHIFT_TEMPLATES.find(t => t.id === shiftPeriod);
  return {
    enabled: true,
    staffing: getDefaultShiftStaffing(day, shiftPeriod),
    securityStaffing: getDefaultSecurityStaffing(day, shiftPeriod),
    closedBars: [...(DEFAULT_SHIFT_CLOSED_BARS[shiftPeriod] || [])],
    startTime: template?.start || '11:00',
    endTime: template?.end || '02:00',
  };
}

/** Build a default GenerateDayConfig for a given day */
export function buildDefaultGenerateDayConfig(day: DayOfWeek): GenerateDayConfig {
  return {
    open: true,
    shifts: {
      'morning':    buildDefaultShiftConfig(day, 'morning'),
      'happy-hour': buildDefaultShiftConfig(day, 'happy-hour'),
      'night':      buildDefaultShiftConfig(day, 'night'),
    },
  };
}

/** Build a full default GenerationConfig */
export function buildDefaultGenerationConfig(mode: 'day' | 'week', selectedDay?: DayOfWeek): GenerationConfig {
  const days = {} as Record<DayOfWeek, GenerateDayConfig>;
  for (const day of DAYS) {
    days[day] = buildDefaultGenerateDayConfig(day);
  }

  return {
    mode,
    targetDay: mode === 'day' ? selectedDay : undefined,
    days,
  };
}

// ============================================================
// localStorage CRUD
// ============================================================

/** Ensure every BarStaffing in a day config has all required fields and all bars exist (migration for old templates) */
function normalizeDayConfig(dayConfig: GenerateDayConfig): GenerateDayConfig {
  const shifts = { ...dayConfig.shifts };
  for (const period of ['morning', 'happy-hour', 'night'] as ShiftPeriod[]) {
    const shift = shifts[period];
    if (!shift) continue;

    // Normalize bar staffing
    if (shift.staffing?.bars) {
      const bars = { ...shift.staffing.bars };
      for (const area of BAR_AREAS) {
        if (area.id === 'servers') continue;
        if (!bars[area.id]) {
          bars[area.id] = { bartenders: 0, barbacks: 0, onCalls: 0, halves: 0 };
        } else {
          bars[area.id] = {
            bartenders: bars[area.id].bartenders ?? 0,
            barbacks: bars[area.id].barbacks ?? 0,
            onCalls: bars[area.id].onCalls ?? 0,
            halves: bars[area.id].halves ?? 0,
          };
        }
      }

      // Migrate old servers: number → { downstairs, upstairs }
      const rawServers = shift.staffing.servers as unknown;
      let servers: { downstairs: number; upstairs: number };
      if (typeof rawServers === 'number') {
        servers = { downstairs: Math.min(rawServers, 3), upstairs: Math.min(Math.max(rawServers - 3, 0), 1) };
      } else if (rawServers && typeof rawServers === 'object') {
        const s = rawServers as { downstairs?: number; upstairs?: number };
        servers = { downstairs: s.downstairs ?? 0, upstairs: s.upstairs ?? 0 };
      } else {
        servers = { downstairs: 0, upstairs: 0 };
      }

      shifts[period] = { ...shift, staffing: { ...shift.staffing, bars, servers } };
    }

    // Migrate old boh: number → { dish, expo }
    if (shift.securityStaffing) {
      const rawBoh = shift.securityStaffing.boh as unknown;
      let boh: { dish: number; expo: number };
      if (typeof rawBoh === 'number') {
        // Split: dish gets floor(2/3), expo gets remainder
        const dish = Math.min(rawBoh, 2);
        const expo = Math.min(Math.max(rawBoh - 2, 0), 1);
        boh = { dish, expo };
      } else if (rawBoh && typeof rawBoh === 'object') {
        const b = rawBoh as { dish?: number; expo?: number };
        boh = { dish: b.dish ?? 0, expo: b.expo ?? 0 };
      } else {
        boh = { dish: 0, expo: 0 };
      }
      shifts[period] = { ...shifts[period], securityStaffing: { ...shift.securityStaffing, boh } };
    }
  }
  return { ...dayConfig, shifts };
}

/** Migrate old type:'shift' templates to type:'day' format */
function migrateShiftTemplate(t: Record<string, unknown>): void {
  if (t.type !== 'shift') return;

  // Old format: { type: 'shift', shiftConfig: ShiftConfig, shiftPeriod: ShiftPeriod }
  // New format: { type: 'day', dayConfig: GenerateDayConfig }
  const shiftConfig = t.shiftConfig as ShiftConfig | undefined;
  const shiftPeriod = t.shiftPeriod as ShiftPeriod | undefined;

  // Build a full day config using defaults, then overlay the saved shift
  const dayConfig = buildDefaultGenerateDayConfig('Tuesday'); // base day doesn't matter
  if (shiftConfig && shiftPeriod && dayConfig.shifts[shiftPeriod]) {
    dayConfig.shifts[shiftPeriod] = shiftConfig;
  }

  t.type = 'day';
  t.dayConfig = dayConfig;
  delete t.shiftConfig;
  delete t.shiftPeriod;
}

function storageKeyForType(lineupType: 'bartender' | 'security'): string {
  return lineupType === 'security' ? SECURITY_STORAGE_KEY : BARTENDER_STORAGE_KEY;
}

/** One-time migration: move old unified storage to separate bartender/security keys */
function migrateOldStorage(): void {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(OLD_STORAGE_KEY);
  if (!raw) return;

  try {
    const templates: Record<string, unknown>[] = JSON.parse(raw);
    const bartender: Record<string, unknown>[] = [];
    const security: Record<string, unknown>[] = [];

    for (const t of templates) {
      if ((t.id as string)?.startsWith('builtin-')) continue;
      if (t.type === 'shift') migrateShiftTemplate(t);

      if (t.lineupType === 'security') {
        security.push(t);
      } else {
        // Default old templates to bartender
        t.lineupType = 'bartender';
        bartender.push(t);
      }
    }

    // Only write if keys don't already exist
    if (!localStorage.getItem(BARTENDER_STORAGE_KEY) && bartender.length > 0) {
      localStorage.setItem(BARTENDER_STORAGE_KEY, JSON.stringify(bartender));
    }
    if (!localStorage.getItem(SECURITY_STORAGE_KEY) && security.length > 0) {
      localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(security));
    }

    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {
    // If migration fails, leave old key in place
  }
}

/** Parse and normalize templates from raw JSON string */
function parseTemplates(raw: string, lineupType: 'bartender' | 'security'): SavedTemplate[] {
  const templates: Record<string, unknown>[] = JSON.parse(raw);
  const filtered = templates.filter(t => !(t.id as string)?.startsWith('builtin-'));

  let needsPersist = false;
  for (const t of filtered) {
    if (t.type === 'shift') {
      migrateShiftTemplate(t);
      needsPersist = true;
    }
    if (!t.lineupType) {
      t.lineupType = lineupType;
      needsPersist = true;
    }
  }

  const result = filtered as unknown as SavedTemplate[];

  for (const t of result) {
    if (t.days) {
      for (const day of DAYS) {
        if (t.days[day]) t.days[day] = normalizeDayConfig(t.days[day]);
      }
    }
    if (t.dayConfig) {
      t.dayConfig = normalizeDayConfig(t.dayConfig);
    }
  }

  if (needsPersist) {
    localStorage.setItem(storageKeyForType(lineupType), JSON.stringify(result));
  }

  return result;
}

/** Load saved templates for a specific lineup type */
export function loadSavedTemplates(lineupType: 'bartender' | 'security' = 'bartender'): SavedTemplate[] {
  if (typeof window === 'undefined') return [];

  // Run one-time migration from old unified key
  migrateOldStorage();

  try {
    const raw = localStorage.getItem(storageKeyForType(lineupType));
    if (!raw) return [];
    return parseTemplates(raw, lineupType);
  } catch {
    return [];
  }
}

/** Save a template (add or update by id) */
export function saveTemplate(template: SavedTemplate): void {
  if (typeof window === 'undefined') return;

  const lineupType = template.lineupType || 'bartender';
  const templates = loadSavedTemplates(lineupType);
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates.push(template);
  }
  localStorage.setItem(storageKeyForType(lineupType), JSON.stringify(templates));
}

/** Delete a template by id */
export function deleteTemplate(id: string, lineupType: 'bartender' | 'security' = 'bartender'): void {
  if (typeof window === 'undefined') return;

  const templates = loadSavedTemplates(lineupType).filter(t => t.id !== id);
  localStorage.setItem(storageKeyForType(lineupType), JSON.stringify(templates));
}

/** Apply a saved template to a GenerationConfig */
export function applyTemplateToConfig(
  template: SavedTemplate,
  config: GenerationConfig
): GenerationConfig {
  if (template.type === 'week' && template.days) {
    return {
      ...config,
      days: JSON.parse(JSON.stringify(template.days)),
    };
  }

  // Per-day template: apply the day config to every open day (preserving open/closed state)
  if (template.dayConfig) {
    const newDays = JSON.parse(JSON.stringify(config.days)) as Record<DayOfWeek, GenerateDayConfig>;
    for (const day of DAYS) {
      if (newDays[day].open) {
        const wasOpen = newDays[day].open;
        newDays[day] = JSON.parse(JSON.stringify(template.dayConfig));
        newDays[day].open = wasOpen;
      }
    }
    return { ...config, days: newDays };
  }

  return config;
}
