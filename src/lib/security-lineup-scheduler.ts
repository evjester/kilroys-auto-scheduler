/**
 * Security Lineup Scheduler
 * Maps scheduled security/carder employees to physical security positions.
 * Generates separate lineups per shift period (Morning, Happy Hour, Night).
 *
 * Simpler than bar lineup — no speed wells, halves, or on-calls.
 * Fill order: Pinned → Well preferences → Carders → Exit Doors → Fixed Posts → Roam → BOH
 */

import type { ScheduleResult, Assignment, DailyLineup, ShiftLineup, LineupAssignment, ShiftTemplate, ShiftPeriod, DayOfWeek, ShiftType, WeekConfig, PinnedPlacement, SecurityStaffing, GenerationConfig, EmployeeProfile } from './types';
import { SECURITY_AREAS, SECURITY_POSITION_ROLES } from './security-venue-config';
import { DAYS, DEFAULT_SHIFT_TEMPLATES } from './mock-config';
import { DEFAULT_OPERATING_HOURS } from './venue-config';
import { getWeekDates, timeToMinutes } from './time-utils';

const SHIFT_TYPE_TO_PERIOD: Record<ShiftType, ShiftPeriod> = {
  AM:   'morning',
  PM:   'happy-hour',
  Late: 'night',
};

/** Security night shift runs later than bar staff */
const SECURITY_NIGHT_END = '04:00';

/** Build a single security shift lineup for one shift period of one day */
function buildSecurityShiftLineup(
  dayOfWeek: DayOfWeek,
  date: string,
  shiftPeriod: ShiftPeriod,
  template: ShiftTemplate,
  availableSecurityStaff: { id: string; name: string; performanceScore: number; role: string }[],
  securityStaffing?: SecurityStaffing,
  pinnedPlacements?: PinnedPlacement[],
  preferredEmployeeIds?: Set<string>,
  wellPreferences?: Map<string, string>,
  allEmployeeLookup?: Map<string, { id: string; name: string; performanceScore: number; role: string }>
): ShiftLineup {
  const employeeMap = new Map<string, { id: string; name: string; performanceScore: number; role: string }>();

  // Populate from available security/carder employees for this day
  for (const emp of availableSecurityStaff) {
    if (!employeeMap.has(emp.id)) {
      employeeMap.set(emp.id, emp);
    }
  }

  // Also add pinned employees
  if (pinnedPlacements) {
    for (const pin of pinnedPlacements) {
      if (!employeeMap.has(pin.employeeId)) {
        employeeMap.set(pin.employeeId, {
          id: pin.employeeId,
          name: pin.employeeName,
          performanceScore: pin.performanceScore,
          role: pin.role,
        });
      }
    }
  }

  const availableEmployees = [...employeeMap.values()].sort((a, b) => {
    const aPreferred = preferredEmployeeIds?.has(a.id) ? 1 : 0;
    const bPreferred = preferredEmployeeIds?.has(b.id) ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;
    return b.performanceScore - a.performanceScore;
  });

  const assigned = new Set<string>();

  const pinnedByPosition = new Map<string, PinnedPlacement>();
  if (pinnedPlacements) {
    for (const pin of pinnedPlacements) {
      pinnedByPosition.set(pin.positionId, pin);
    }
  }

  const assignmentsByPos = new Map<string, LineupAssignment>();

  const makeAssignment = (
    posId: string,
    emp: { id: string; name: string; performanceScore: number; role: string } | null,
  ): LineupAssignment => {
    if (emp) {
      return { positionId: posId, employeeId: emp.id, employeeName: emp.name, performanceScore: emp.performanceScore, role: emp.role, isOnCall: false };
    }
    return { positionId: posId, employeeId: null, employeeName: '', performanceScore: 0, role: '', isOnCall: false };
  };

  const findCandidate = (eligibleRoles: string[]): typeof availableEmployees[0] | undefined => {
    return availableEmployees.find(e =>
      !assigned.has(e.id) &&
      eligibleRoles.some(r => e.role === r)
    );
  };

  // Initialize all positions as empty
  for (const area of SECURITY_AREAS) {
    for (const pos of area.positions) {
      assignmentsByPos.set(pos.id, makeAssignment(pos.id, null));
    }
  }

  // Determine how many positions to fill per area from staffing config
  const positionLimits = new Map<string, number>();
  if (securityStaffing) {
    // Carders
    const carderArea = SECURITY_AREAS.find(a => a.id === 'carders');
    if (carderArea) positionLimits.set('carders', Math.min(securityStaffing.carders, carderArea.positions.length));

    // Exit doors
    const exitArea = SECURITY_AREAS.find(a => a.id === 'exit-doors');
    if (exitArea) positionLimits.set('exit-doors', Math.min(securityStaffing.exitDoors, exitArea.positions.length));

    // Fixed posts
    const fixedArea = SECURITY_AREAS.find(a => a.id === 'fixed-posts');
    if (fixedArea) positionLimits.set('fixed-posts', Math.min(securityStaffing.fixedPosts, fixedArea.positions.length));

    // Roam areas
    for (const area of SECURITY_AREAS) {
      if (area.id.startsWith('roam-')) {
        const count = securityStaffing.roam[area.id] ?? 0;
        positionLimits.set(area.id, Math.min(count, area.positions.length));
      }
    }

    // BOH (dish + expo sub-limits)
    const bohArea = SECURITY_AREAS.find(a => a.id === 'back-of-house');
    if (bohArea) {
      const totalBoh = (securityStaffing.boh.dish || 0) + (securityStaffing.boh.expo || 0);
      positionLimits.set('back-of-house', Math.min(totalBoh, bohArea.positions.length));
    }
  } else {
    // No staffing config — fill all positions
    for (const area of SECURITY_AREAS) {
      positionLimits.set(area.id, area.positions.length);
    }
  }

  // === Step 0: Pre-fill pinned placements ===
  const pinnedPositionIds = new Set<string>();
  for (const area of SECURITY_AREAS) {
    for (const pos of area.positions) {
      const pin = pinnedByPosition.get(pos.id);
      if (pin) {
        const emp = employeeMap.get(pin.employeeId);
        if (emp) {
          assigned.add(emp.id);
          assignmentsByPos.set(pos.id, { ...makeAssignment(pos.id, emp), isPinned: true });
          pinnedPositionIds.add(pos.id);
        }
      }
    }
  }

  // === Step 0.5: Pre-fill well preferences ===
  const preferredWellPositionIds = new Set<string>();
  if (wellPreferences?.size) {
    const prefEntries = [...wellPreferences.entries()]
      .map(([empId, posId]) => {
        const emp = employeeMap.get(empId) || allEmployeeLookup?.get(empId);
        return { empId, posId, emp };
      })
      .filter(e => e.emp && !assigned.has(e.empId))
      .sort((a, b) => b.emp!.performanceScore - a.emp!.performanceScore);

    for (const { empId, posId, emp } of prefEntries) {
      if (assigned.has(empId) || pinnedPositionIds.has(posId)) continue;
      const area = SECURITY_AREAS.find(a => a.positions.some(p => p.id === posId));
      if (!area) continue;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, emp!);
      }
      assigned.add(empId);
      assignmentsByPos.set(posId, { ...makeAssignment(posId, emp!), isPreferredWell: true });
      preferredWellPositionIds.add(posId);
    }
  }

  const reservedIds = new Set([...pinnedPositionIds, ...preferredWellPositionIds]);

  // === Fill positions area by area ===
  // Fill order: carders → exit doors → fixed posts → roam areas → BOH
  const fillOrder = [
    'carders',
    'exit-doors',
    'fixed-posts',
    ...SECURITY_AREAS.filter(a => a.id.startsWith('roam-')).map(a => a.id),
    'back-of-house',
  ];

  for (const areaId of fillOrder) {
    const area = SECURITY_AREAS.find(a => a.id === areaId);
    if (!area) continue;

    // BOH uses sub-limits for dish/expo positions
    if (areaId === 'back-of-house' && securityStaffing) {
      const dishLimit = securityStaffing.boh.dish || 0;
      const expoLimit = securityStaffing.boh.expo || 0;
      let dishFilled = 0, expoFilled = 0;

      // Count already-placed pins/preferences toward sub-limits
      for (const pos of area.positions) {
        if (reservedIds.has(pos.id)) {
          if (pos.label === 'Dish') dishFilled++;
          else expoFilled++;
        }
      }

      for (const pos of area.positions) {
        if (reservedIds.has(pos.id)) continue;
        const isDish = pos.label === 'Dish';
        const subLimit = isDish ? dishLimit : expoLimit;
        const subFilled = isDish ? dishFilled : expoFilled;
        if (subFilled >= subLimit) continue;

        const eligibleRoles = SECURITY_POSITION_ROLES[pos.type] || [];
        const candidate = findCandidate(eligibleRoles);
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate));
          if (isDish) dishFilled++; else expoFilled++;
        }
      }
      continue;
    }

    const limit = positionLimits.get(areaId) ?? 0;
    let filled = 0;

    // Count already-placed pins/preferences toward limit
    for (const pos of area.positions) {
      if (reservedIds.has(pos.id)) filled++;
    }

    for (const pos of area.positions) {
      if (filled >= limit) break;
      if (reservedIds.has(pos.id)) continue;

      const eligibleRoles = SECURITY_POSITION_ROLES[pos.type] || [];
      const candidate = findCandidate(eligibleRoles);
      if (candidate) {
        assigned.add(candidate.id);
        assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate));
        filled++;
      }
    }
  }

  // === Build final areas structure ===
  const areas = SECURITY_AREAS.map(area => ({
    areaId: area.id,
    assignments: area.positions.map(pos => assignmentsByPos.get(pos.id)!),
  }));

  const unassigned = availableEmployees
    .filter(e => !assigned.has(e.id))
    .map(e => ({
      employeeId: e.id,
      employeeName: e.name,
      performanceScore: e.performanceScore,
      role: e.role,
    }));

  return {
    date,
    dayOfWeek,
    shiftPeriod,
    shiftHours: { start: template.start, end: shiftPeriod === 'night' ? SECURITY_NIGHT_END : template.end },
    areas,
    unassigned,
  };
}

/** Generate weekly security lineups from a schedule result */
export function generateSecurityWeeklyLineups(
  schedule: ScheduleResult,
  shiftTemplates?: ShiftTemplate[],
  hoursOverrides?: Partial<Record<DayOfWeek, { open: string; close: string }>>,
  weekConfig?: WeekConfig,
  preferredEmployeeIds?: Set<string>,
  generationConfig?: GenerationConfig,
  wellPreferences?: Map<string, string>,
  fullEmployeeLookup?: Map<string, { id: string; name: string; performanceScore: number; role: string }>,
  allProfiles?: EmployeeProfile[]
): DailyLineup[] {
  const weekDates = getWeekDates(schedule.weekStart);
  const templates = weekConfig?.shiftTemplates || shiftTemplates || DEFAULT_SHIFT_TEMPLATES;

  const allEmployeeLookup = new Map<string, { id: string; name: string; performanceScore: number; role: string }>();
  if (fullEmployeeLookup) {
    for (const [id, emp] of fullEmployeeLookup) {
      allEmployeeLookup.set(id, emp);
    }
  }
  for (const a of schedule.assignments) {
    if (!allEmployeeLookup.has(a.employee.id)) {
      allEmployeeLookup.set(a.employee.id, {
        id: a.employee.id,
        name: a.employee.name,
        performanceScore: a.employee.performanceScore,
        role: a.employee.role,
      });
    }
  }

  // Filter security/carder profiles per day for direct candidate sourcing
  const securityRoles = new Set(['Security', 'Carder']);
  const securityProfiles = allProfiles?.filter(p => securityRoles.has(p.primaryRole)) || [];

  return DAYS.map(day => {
    const date = weekDates[day];
    const hours = hoursOverrides?.[day] || DEFAULT_OPERATING_HOURS[day];

    const dayConfig = weekConfig?.days[day];

    // If day is closed, return empty shifts
    if (dayConfig && !dayConfig.open) {
      return {
        date,
        dayOfWeek: day,
        operatingHours: hours,
        shifts: templates.map(template => ({
          date,
          dayOfWeek: day,
          shiftPeriod: template.id as ShiftPeriod,
          shiftHours: { start: template.start, end: template.id === 'night' ? SECURITY_NIGHT_END : template.end },
          areas: SECURITY_AREAS.map(area => ({
            areaId: area.id,
            assignments: area.positions.map(pos => ({
              positionId: pos.id,
              employeeId: null,
              employeeName: '',
              performanceScore: 0,
              role: '',
              isOnCall: false,
            })),
          })),
          unassigned: [],
        })),
      };
    }

    const shifts = templates.map(template => {
      const shiftPeriod = template.id as ShiftPeriod;
      const genShiftConfig = generationConfig?.days[day]?.shifts[shiftPeriod];

      let effectiveTemplate = template;
      if (genShiftConfig) {
        effectiveTemplate = { ...template, start: genShiftConfig.startTime, end: genShiftConfig.endTime };
      }

      // Build available security staff filtered by day AND shift time window
      const shiftStartMin = timeToMinutes(effectiveTemplate.start);
      const shiftAvailableStaff = securityProfiles
        .filter(p => {
          const avail = p.availability[day];
          if (avail === null || avail === undefined) return false;
          // Check that the shift start falls within the employee's availability window
          let availFrom = timeToMinutes(avail.from);
          let availTo = timeToMinutes(avail.to);
          if (availTo <= availFrom) availTo += 1440; // handle overnight
          let adjustedStart = shiftStartMin;
          if (adjustedStart < availFrom && adjustedStart + 1440 >= availFrom) {
            adjustedStart += 1440; // handle overnight shift start
          }
          return adjustedStart >= availFrom && adjustedStart < availTo;
        })
        .map(p => ({ id: p.id, name: p.name, performanceScore: p.performanceScore, role: p.primaryRole }));

      const pins = weekConfig?.pinnedPlacements.filter(
        p => p.dayOfWeek === day && p.shiftPeriod === shiftPeriod
      );

      const secStaffing = genShiftConfig?.securityStaffing;

      return buildSecurityShiftLineup(
        day, date, shiftPeriod, effectiveTemplate,
        shiftAvailableStaff, secStaffing, pins, preferredEmployeeIds,
        wellPreferences, allEmployeeLookup
      );
    });

    return {
      date,
      dayOfWeek: day,
      operatingHours: hours,
      shifts,
    };
  });
}
