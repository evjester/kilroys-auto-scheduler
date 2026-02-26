/**
 * Shift Template Generator — creates all shift slots to fill for a given week
 */

import type { ShiftSlot, DayOfWeek, ShiftType, ShiftPeriod, WeekConfig, GenerationConfig } from './types';
import { DAYS, DAY_SHIFT_TYPES, SHIFT_DEFINITIONS, getStaffingReqs, getPrimeTier, ROLE_CONFIG } from './mock-config';
import { getWeekDates, shiftDuration } from './time-utils';

/** Map ShiftPeriod → ShiftType for filtering disabled shifts */
const PERIOD_TO_SHIFT_TYPE: Record<ShiftPeriod, ShiftType> = {
  'morning':    'AM',
  'happy-hour': 'PM',
  'night':      'Late',
};

/** Staffing multipliers per level */
const STAFFING_MULTIPLIER: Record<string, number> = {
  light:  0.6,
  normal: 1.0,
  heavy:  1.5,
};

/** Generate all shift slots for a given week (Mon-Sun) */
export function generateShiftSlots(weekStart: string, weekConfig?: WeekConfig, generationConfig?: GenerationConfig): ShiftSlot[] {
  const dates = getWeekDates(weekStart);
  const slots: ShiftSlot[] = [];
  let slotIdx = 0;

  // If generationConfig is provided, use explicit staffing counts
  if (generationConfig) {
    return generateFromConfig(generationConfig, dates);
  }

  for (const day of DAYS) {
    // Skip closed days
    if (weekConfig?.days[day] && !weekConfig.days[day].open) continue;

    const dayConfig = weekConfig?.days[day];
    const disabledShiftTypes = new Set(
      (dayConfig?.disabledShifts || []).map(p => PERIOD_TO_SHIFT_TYPE[p])
    );

    const shiftTypes = DAY_SHIFT_TYPES[day].filter(st => !disabledShiftTypes.has(st));
    const date = dates[day];
    const multiplier = STAFFING_MULTIPLIER[dayConfig?.staffingLevel || 'normal'] || 1.0;

    for (const shiftType of shiftTypes) {
      const reqs = getStaffingReqs(day, shiftType);
      const shiftDef = SHIFT_DEFINITIONS[shiftType];
      const primeTier = getPrimeTier(day, shiftType);

      for (const req of reqs) {
        const adjustedCount = multiplier === 1.0
          ? req.count
          : multiplier < 1
            ? Math.max(1, Math.floor(req.count * multiplier))
            : Math.ceil(req.count * multiplier);

        for (let i = 0; i < adjustedCount; i++) {
          slotIdx++;
          slots.push({
            id: `SLOT-${date}-${shiftType}-${req.role}-${i + 1}`,
            dayOfWeek: day,
            date,
            startTime: shiftDef.start,
            endTime: shiftDef.end,
            duration: shiftDuration(shiftDef.start, shiftDef.end),
            requiredRole: req.role,
            department: ROLE_CONFIG[req.role]?.department || 'Bar',
            primeTier,
            shiftType,
          });
        }
      }
    }
  }

  return slots;
}

/** Generate shift slots from explicit GenerationConfig staffing counts */
function generateFromConfig(config: GenerationConfig, dates: Record<string, string>): ShiftSlot[] {
  const slots: ShiftSlot[] = [];
  const periods: ShiftPeriod[] = ['morning', 'happy-hour', 'night'];

  for (const day of DAYS) {
    const dayConfig = config.days[day];
    if (!dayConfig || !dayConfig.open) continue;

    // In day mode, only generate slots for the target day
    if (config.mode === 'day' && config.targetDay && config.targetDay !== day) continue;

    const date = dates[day];

    for (const period of periods) {
      const shiftConfig = dayConfig.shifts[period];
      if (!shiftConfig || !shiftConfig.enabled) continue;

      const shiftType = PERIOD_TO_SHIFT_TYPE[period];
      const primeTier = getPrimeTier(day, shiftType);
      const fullDuration = shiftDuration(shiftConfig.startTime, shiftConfig.endTime);

      // Sum per-bar counts to get total role counts.
      // Halves are NOT included — they only work a partial shift (10:30 PM - 2 AM)
      // and are sourced from the broader employee pool by the lineup scheduler.
      let totalBartenders = 0;
      let totalBarbacks = 0;
      for (const barStaff of Object.values(shiftConfig.staffing.bars)) {
        totalBartenders += (barStaff.bartenders || 0) + (barStaff.onCalls || 0);
        totalBarbacks += (barStaff.barbacks || 0);
      }

      // Build role-based slots
      const roleSlots: { role: string; count: number; duration: number }[] = [
        { role: 'Bartender', count: totalBartenders, duration: fullDuration },
        { role: 'Barback',   count: totalBarbacks,   duration: fullDuration },
        { role: 'Server',    count: (shiftConfig.staffing.servers.downstairs || 0) + (shiftConfig.staffing.servers.upstairs || 0), duration: fullDuration },
      ].filter(r => r.count > 0);

      for (const { role, count, duration } of roleSlots) {
        for (let i = 0; i < count; i++) {
          slots.push({
            id: `SLOT-${date}-${shiftType}-${role}-${i + 1}`,
            dayOfWeek: day,
            date,
            startTime: shiftConfig.startTime,
            endTime: shiftConfig.endTime,
            duration,
            requiredRole: role,
            department: ROLE_CONFIG[role]?.department || 'Bar',
            primeTier,
            shiftType,
          });
        }
      }
    }
  }

  return slots;
}

/** Get a human-readable label for a shift slot */
export function shiftLabel(slot: ShiftSlot): string {
  return `${slot.dayOfWeek} ${slot.shiftType} ${slot.requiredRole}`;
}
