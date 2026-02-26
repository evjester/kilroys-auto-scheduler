import { NextRequest, NextResponse } from 'next/server';
import { runScheduler } from '@/lib/scheduler';
import { generateWeeklyLineups, applyShiftLineupOverrides } from '@/lib/lineup-scheduler';
import { generateSecurityWeeklyLineups } from '@/lib/security-lineup-scheduler';
import { getCurrentWeekStart } from '@/lib/time-utils';
import { DEFAULT_SHIFT_TEMPLATES } from '@/lib/mock-config';
import { buildDefaultGenerationConfig } from '@/lib/template-storage';
import { ingestAllData } from '@/lib/ingest';
import { buildEmployeeProfiles } from '@/lib/metrics';
import type { DayOfWeek, ShiftPeriod, ShiftTemplate, WeekConfig, GenerationConfig } from '@/lib/types';

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get('weekStart') || getCurrentWeekStart();

  try {
    // Load employee profiles for security scheduler (it sources candidates directly)
    const data = ingestAllData();
    const profiles = buildEmployeeProfiles(
      data.employees, data.availability, data.timeOff, data.shifts,
      data.employeeTips, data.laborReport
    );

    // Use default generation config for per-bar distribution on initial load
    const defaultConfig = buildDefaultGenerationConfig('week');
    const schedule = runScheduler(weekStart, undefined, undefined, defaultConfig);
    const lineups = generateWeeklyLineups(schedule, undefined, undefined, undefined, undefined, undefined, defaultConfig);
    const securityLineups = generateSecurityWeeklyLineups(schedule, undefined, undefined, undefined, undefined, defaultConfig, undefined, undefined, profiles);

    return NextResponse.json({ weekStart, lineups, securityLineups });
  } catch (error) {
    console.error('Lineup generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate lineup', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      weekStart, weekConfig, generationConfig, day, shiftPeriod, changes, hours, shiftTemplates,
      lineupType,
      preferredEmployeeIds: preferredArr, wellPreferences: wellPrefArr,
      securityPreferredEmployeeIds: secPreferredArr, securityWellPreferences: secWellPrefArr,
    } = body as {
      weekStart: string;
      weekConfig?: WeekConfig;
      generationConfig?: GenerationConfig;
      day?: DayOfWeek;
      shiftPeriod?: ShiftPeriod;
      changes?: { positionId: string; employeeId: string | null; customHours?: { start: string; end: string }; note?: string }[];
      hours?: { open: string; close: string };
      shiftTemplates?: ShiftTemplate[];
      lineupType?: 'bartender' | 'security';
      preferredEmployeeIds?: string[];
      wellPreferences?: { employeeId: string; positionId: string }[];
      securityPreferredEmployeeIds?: string[];
      securityWellPreferences?: { employeeId: string; positionId: string }[];
    };

    const preferredSet = preferredArr ? new Set(preferredArr) : undefined;
    const wellPrefMap = wellPrefArr?.length
      ? new Map(wellPrefArr.map(w => [w.employeeId, w.positionId]))
      : undefined;

    const secPreferredSet = secPreferredArr ? new Set(secPreferredArr) : undefined;
    const secWellPrefMap = secWellPrefArr?.length
      ? new Map(secWellPrefArr.map(w => [w.employeeId, w.positionId]))
      : undefined;

    // Always load employee profiles — needed for security scheduler (which sources
    // candidates directly from profiles) and for well preference placement.
    const data = ingestAllData();
    const profiles = buildEmployeeProfiles(
      data.employees, data.availability, data.timeOff, data.shifts,
      data.employeeTips, data.laborReport
    );
    const fullEmployeeLookup = new Map(
      profiles.map(p => [p.id, { id: p.id, name: p.name, performanceScore: p.performanceScore, role: p.primaryRole }])
    );

    const actualWeekStart = weekStart || getCurrentWeekStart();

    // Full week generation with weekConfig
    if (weekConfig) {
      const schedule = runScheduler(actualWeekStart, undefined, weekConfig);
      const lineups = generateWeeklyLineups(schedule, weekConfig.shiftTemplates, undefined, undefined, weekConfig, preferredSet, undefined, wellPrefMap, fullEmployeeLookup);
      const securityLineups = generateSecurityWeeklyLineups(schedule, weekConfig.shiftTemplates, undefined, weekConfig, secPreferredSet, undefined, secWellPrefMap, fullEmployeeLookup, profiles);
      return NextResponse.json({ weekStart: actualWeekStart, lineups, securityLineups });
    }

    // Generation with explicit staffing config (from GeneratePanel)
    if (generationConfig) {
      const schedule = runScheduler(actualWeekStart, undefined, undefined, generationConfig);
      const lineups = (!lineupType || lineupType === 'bartender')
        ? generateWeeklyLineups(schedule, undefined, undefined, undefined, undefined, preferredSet, generationConfig, wellPrefMap, fullEmployeeLookup)
        : undefined;
      const securityLineups = (!lineupType || lineupType === 'security')
        ? generateSecurityWeeklyLineups(schedule, undefined, undefined, undefined, secPreferredSet, generationConfig, secWellPrefMap, fullEmployeeLookup, profiles)
        : undefined;
      return NextResponse.json({ weekStart: actualWeekStart, lineups, securityLineups });
    }

    // Legacy single-day override path
    const templates = shiftTemplates || DEFAULT_SHIFT_TEMPLATES;
    const schedule = runScheduler(actualWeekStart);

    const hoursOverrides = hours && day ? { [day]: hours } as Partial<Record<DayOfWeek, { open: string; close: string }>> : undefined;
    const lineups = generateWeeklyLineups(schedule, templates, hoursOverrides, undefined, undefined, preferredSet);
    const securityLineups = generateSecurityWeeklyLineups(schedule, templates, hoursOverrides, undefined, undefined, undefined, undefined, undefined, profiles);

    if (day) {
      let dayLineup = lineups.find(l => l.dayOfWeek === day);
      if (!dayLineup) {
        return NextResponse.json({ error: `No lineup for ${day}` }, { status: 400 });
      }

      if (changes && changes.length > 0 && shiftPeriod) {
        const shiftIdx = dayLineup.shifts.findIndex(s => s.shiftPeriod === shiftPeriod);
        if (shiftIdx !== -1) {
          const updatedShift = applyShiftLineupOverrides(dayLineup.shifts[shiftIdx], changes);
          dayLineup = {
            ...dayLineup,
            shifts: dayLineup.shifts.map((s, i) => i === shiftIdx ? updatedShift : s),
          };
        }
      }

      if (hours) {
        dayLineup = { ...dayLineup, operatingHours: hours };
      }

      const updatedLineups = lineups.map(l => l.dayOfWeek === day ? dayLineup! : l);
      return NextResponse.json({ weekStart: actualWeekStart, lineups: updatedLineups, securityLineups });
    }

    return NextResponse.json({ weekStart: actualWeekStart, lineups, securityLineups });
  } catch (error) {
    console.error('Lineup update error:', error);
    return NextResponse.json(
      { error: 'Failed to update lineup', details: String(error) },
      { status: 500 }
    );
  }
}
