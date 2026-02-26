/**
 * Week Templates — predefined configurations for common week patterns
 */

import type { WeekConfig, DayConfig, DayOfWeek, ShiftPeriod, ShiftTemplate } from './types';
import { DAYS, DEFAULT_SHIFT_TEMPLATES, DEFAULT_SHIFT_CLOSED_BARS } from './mock-config';

export const WEEK_TEMPLATES = [
  { id: 'normal', label: 'Normal Week', description: 'Standard operating schedule' },
  { id: 'breakfast-club', label: 'Breakfast Club', description: 'Early open + heavy AM staffing on selected day' },
] as const;

const QUIET_DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Sunday'];
const BUSY_DAYS: DayOfWeek[] = ['Thursday', 'Friday', 'Saturday'];

function buildDefaultDayConfig(day: DayOfWeek): DayConfig {
  const isQuiet = QUIET_DAYS.includes(day);
  const isBusy = BUSY_DAYS.includes(day);

  return {
    open: true,
    disabledShifts: [],
    closedBars: {
      'morning': [...(DEFAULT_SHIFT_CLOSED_BARS['morning'] || [])],
      'happy-hour': [...(DEFAULT_SHIFT_CLOSED_BARS['happy-hour'] || [])],
      'night': [...(DEFAULT_SHIFT_CLOSED_BARS['night'] || [])],
    } as Record<ShiftPeriod, string[]>,
    staffingLevel: isBusy ? 'heavy' : isQuiet ? 'light' : 'normal',
  };
}

export function buildWeekConfig(
  templateId: string,
  shiftTemplates?: ShiftTemplate[],
  options?: { bcDay?: DayOfWeek }
): WeekConfig {
  const templates = (shiftTemplates || DEFAULT_SHIFT_TEMPLATES).map(t => ({ ...t }));
  const days = {} as Record<DayOfWeek, DayConfig>;

  for (const day of DAYS) {
    days[day] = buildDefaultDayConfig(day);
  }

  if (templateId === 'breakfast-club') {
    const bcDay = options?.bcDay || 'Saturday';
    days[bcDay] = {
      ...days[bcDay],
      staffingLevel: 'heavy',
      morningStartOverride: '09:00',
      closedBars: {
        'morning': [],    // all bars open for breakfast club
        'happy-hour': [...(DEFAULT_SHIFT_CLOSED_BARS['happy-hour'] || [])],
        'night': [],
      } as Record<ShiftPeriod, string[]>,
    };
  }

  return {
    templateId,
    days,
    pinnedPlacements: [],
    shiftTemplates: templates.map(t => ({ ...t })),
  };
}

/** Apply Breakfast Club overlay to an existing WeekConfig — only modifies the selected BC day */
export function applyBreakfastClub(
  existingConfig: WeekConfig,
  bcDay: DayOfWeek
): WeekConfig {
  return {
    ...existingConfig,
    templateId: 'breakfast-club',
    days: {
      ...existingConfig.days,
      [bcDay]: {
        ...existingConfig.days[bcDay],
        open: true,
        staffingLevel: 'heavy',
        morningStartOverride: '09:00',
        closedBars: {
          ...existingConfig.days[bcDay].closedBars,
          'morning': [],  // all bars open for morning on BC day
        },
      },
    },
  };
}
