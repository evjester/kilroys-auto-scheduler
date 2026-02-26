/**
 * Lineup Scheduler
 * Maps scheduled employees to physical bar positions (wells).
 * Generates separate lineups per shift period (Morning, Happy Hour, Night).
 *
 * Two distribution modes:
 *   A) Per-bar staffing (when GenerationConfig provided):
 *      Fill each bar to its configured bartender/barback/on-call count.
 *   B) Round-robin (legacy, when no GenerationConfig):
 *      1. Speed wells first (by speedRank across ALL bars)
 *      2. Standard/on_call round-robin (one per area, repeating)
 *      3. Barbacks round-robin
 *      4. Servers
 *
 * Supports WeekConfig for manager-configured weeks and pinned placements.
 */

import type { ScheduleResult, Assignment, DailyLineup, ShiftLineup, LineupAssignment, ShiftTemplate, ShiftPeriod, DayOfWeek, ShiftType, WeekConfig, PinnedPlacement, PositionType, GenerationConfig, BarStaffing } from './types';
import { BAR_AREAS, DEFAULT_OPERATING_HOURS, POSITION_ELIGIBLE_ROLES } from './venue-config';
import { DAYS, DEFAULT_SHIFT_TEMPLATES, DEFAULT_SHIFT_CLOSED_BARS } from './mock-config';
import { getWeekDates } from './time-utils';

/** Map scheduler ShiftType → lineup ShiftPeriod so each lineup only gets its own employees */
const SHIFT_TYPE_TO_PERIOD: Record<ShiftType, ShiftPeriod> = {
  AM:   'morning',
  PM:   'happy-hour',
  Late: 'night',
};

/** Build a single shift lineup for one shift period of one day */
function buildShiftLineup(
  dayOfWeek: DayOfWeek,
  date: string,
  shiftPeriod: ShiftPeriod,
  template: ShiftTemplate,
  dayAssignments: Assignment[],
  closedBars: Set<string>,
  pinnedPlacements?: PinnedPlacement[],
  preferredEmployeeIds?: Set<string>,
  perBarStaffing?: Record<string, BarStaffing>,
  wellPreferences?: Map<string, string>,
  allEmployeeLookup?: Map<string, { id: string; name: string; performanceScore: number; role: string }>,
  serverStaffing?: { downstairs: number; upstairs: number }
): ShiftLineup {
  const employeeMap = new Map<string, { id: string; name: string; performanceScore: number; role: string }>();
  for (const a of dayAssignments) {
    if (!employeeMap.has(a.employee.id)) {
      employeeMap.set(a.employee.id, {
        id: a.employee.id,
        name: a.employee.name,
        performanceScore: a.employee.performanceScore,
        role: a.employee.role,
      });
    }
  }

  // Also add pinned employees to the map (they may not have been scheduled by the algorithm)
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

  // Build a lookup of pinned position → employee for this shift
  const pinnedByPosition = new Map<string, PinnedPlacement>();
  if (pinnedPlacements) {
    for (const pin of pinnedPlacements) {
      pinnedByPosition.set(pin.positionId, pin);
    }
  }

  // Track assignments by position ID (filled across all areas)
  const assignmentsByPos = new Map<string, LineupAssignment>();

  const makeAssignment = (
    posId: string,
    emp: { id: string; name: string; performanceScore: number; role: string } | null,
    isOnCall: boolean,
    isPinned?: boolean,
    customHours?: { start: string; end: string }
  ): LineupAssignment => {
    if (emp) {
      return { positionId: posId, employeeId: emp.id, employeeName: emp.name, performanceScore: emp.performanceScore, role: emp.role, isOnCall, isPinned, customHours };
    }
    return { positionId: posId, employeeId: null, employeeName: '', performanceScore: 0, role: '', isOnCall };
  };

  const findCandidate = (eligibleRoles: string[]): typeof availableEmployees[0] | undefined => {
    return availableEmployees.find(e =>
      !assigned.has(e.id) &&
      eligibleRoles.some(r => e.role === r)
    );
  };

  // Determine open areas
  const openAreas = BAR_AREAS.filter(a => !closedBars.has(a.id));

  // Initialize ALL positions as empty (including closed bars)
  for (const area of BAR_AREAS) {
    for (const pos of area.positions) {
      assignmentsByPos.set(pos.id, makeAssignment(pos.id, null, pos.type === 'on_call'));
    }
  }

  // === Step 0: Pre-fill pinned placements across all open areas ===
  const pinnedPositionIds = new Set<string>();
  for (const area of openAreas) {
    for (const pos of area.positions) {
      const pin = pinnedByPosition.get(pos.id);
      if (pin) {
        const emp = employeeMap.get(pin.employeeId);
        if (emp) {
          assigned.add(emp.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, emp, pos.type === 'on_call', true));
          pinnedPositionIds.add(pos.id);
        }
      }
    }
  }

  // === Step 0.5: Pre-fill well preferences (preferred employees with specific well) ===
  // Look up employees from the shift-specific map first, then fall back to the
  // global lookup (covers employees scheduled for other shifts or days).
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
      // Only place if the well's bar is open
      const area = openAreas.find(a => a.positions.some(p => p.id === posId));
      if (!area) continue;
      // Add to employeeMap if not already present (employee from another shift)
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, emp!);
      }
      assigned.add(empId);
      assignmentsByPos.set(posId, { ...makeAssignment(posId, emp!, false), isPreferredWell: true });
      preferredWellPositionIds.add(posId);
    }
  }

  if (perBarStaffing) {
    // === Per-bar distribution mode (round-robin) ===
    // Distribute employees across bars fairly using round-robin to prevent
    // front-loaded bars consuming all employees when supply is limited.
    //
    // Halves strategy: btTarget = bartenders + halves (combined).
    // Three-phase round-robin: BT first (highest priority), then OC, then halves.
    // This ensures on-calls get filled before optional half-shift extras.

    // Prepare per-bar position queues and targets
    const barQueues: {
      areaId: string;
      btPositions: typeof BAR_AREAS[0]['positions'];
      ocPositions: typeof BAR_AREAS[0]['positions'];
      bbPositions: typeof BAR_AREAS[0]['positions'];
      btTarget: number;    // regular bartenders only
      ocTarget: number;    // on-calls
      bbTarget: number;    // barbacks
      halvesTarget: number; // half-shift bartenders (filled after BT + OC)
      btFilled: number;
      ocFilled: number;
      bbFilled: number;
      halvesFilled: number;
    }[] = [];

    for (const area of openAreas) {
      if (area.id === 'servers') continue;
      const barStaff = perBarStaffing[area.id];
      if (!barStaff) continue;

      // Count pinned + well-preference employees by position type at this bar
      const reservedIds = new Set([...pinnedPositionIds, ...preferredWellPositionIds]);
      let pinnedBartenders = 0;
      let pinnedOnCalls = 0;
      let pinnedBarbacks = 0;
      for (const pos of area.positions) {
        if (reservedIds.has(pos.id)) {
          if (pos.type === 'speed' || pos.type === 'standard') pinnedBartenders++;
          else if (pos.type === 'on_call') pinnedOnCalls++;
          else if (pos.type === 'barback') pinnedBarbacks++;
        }
      }

      // Collect unfilled positions (speed first for bartenders)
      const speedPositions = area.positions
        .filter(p => p.type === 'speed' && !reservedIds.has(p.id))
        .sort((a, b) => (a.speedRank ?? 99) - (b.speedRank ?? 99));
      const standardPositions = area.positions
        .filter(p => p.type === 'standard' && !reservedIds.has(p.id));
      const btPositions = [...speedPositions, ...standardPositions];

      const halvesCount = barStaff.halves || 0;
      const regularBt = Math.max(0, (barStaff.bartenders || 0) - pinnedBartenders);

      const ocPositions = area.positions.filter(p => p.type === 'on_call' && !reservedIds.has(p.id));
      const bbPositions = area.positions.filter(p => p.type === 'barback' && !reservedIds.has(p.id));

      barQueues.push({
        areaId: area.id,
        btPositions,
        ocPositions,
        bbPositions,
        // Cap targets at physical position counts to prevent impossible fills
        btTarget: Math.min(regularBt, btPositions.length),
        ocTarget: Math.min(Math.max(0, (barStaff.onCalls || 0) - pinnedOnCalls), ocPositions.length),
        bbTarget: Math.min(Math.max(0, (barStaff.barbacks || 0) - pinnedBarbacks), bbPositions.length),
        halvesTarget: halvesCount,
        btFilled: 0,
        ocFilled: 0,
        bbFilled: 0,
        halvesFilled: 0,
      });
    }

    // Priority order: BT wells first, then OC, then halves.
    // If supply is limited, the round-robin phases naturally fill in priority order —
    // wells get staffed first, on-calls get whatever remains.

    // === Phase 1: Round-robin fill regular bartender positions ===
    let anyFilled = true;
    while (anyFilled) {
      anyFilled = false;
      for (const bar of barQueues) {
        if (bar.btFilled >= bar.btTarget) continue;
        const pos = bar.btPositions[bar.btFilled];
        if (!pos) continue;
        const candidate = findCandidate(['Bartender']);
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, false));
          bar.btFilled++;
          anyFilled = true;
        }
      }
    }

    // === Phase 2: Round-robin fill on-call positions ===
    // OC draws from the shift-assigned pool first, then falls back to the
    // broader employee lookup so supply-limited shifts still fill OC slots.
    const findOcCandidate = (): typeof availableEmployees[0] | undefined => {
      const fromShift = findCandidate(['Bartender']);
      if (fromShift) return fromShift;
      if (allEmployeeLookup) {
        for (const [id, emp] of allEmployeeLookup) {
          if (!assigned.has(id) && emp.role === 'Bartender') return emp;
        }
      }
      return undefined;
    };

    anyFilled = true;
    while (anyFilled) {
      anyFilled = false;
      for (const bar of barQueues) {
        if (bar.ocFilled >= bar.ocTarget) continue;
        const pos = bar.ocPositions[bar.ocFilled];
        if (!pos) { bar.ocTarget = bar.ocFilled; continue; }
        const candidate = findOcCandidate();
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, true));
          bar.ocFilled++;
          anyFilled = true;
        }
      }
    }

    // === Phase 3: Round-robin fill half-shift bartenders ===
    // Halves go into remaining BT positions (after btTarget) or unused OC positions.
    // They get customHours (10:30 PM - 2:00 AM).
    // Halves are NOT part of the scheduler slot count, so we also search the full
    // employee pool (allEmployeeLookup) for bartenders who weren't assigned to this shift.
    const halfHours = { start: '22:30', end: '02:00' };

    // Find a bartender for half shifts — first from shift pool, then from all employees
    const findHalfCandidate = (): typeof availableEmployees[0] | undefined => {
      const fromShift = findCandidate(['Bartender']);
      if (fromShift) return fromShift;
      if (allEmployeeLookup) {
        for (const [id, emp] of allEmployeeLookup) {
          if (!assigned.has(id) && emp.role === 'Bartender') return emp;
        }
      }
      return undefined;
    };

    anyFilled = true;
    while (anyFilled) {
      anyFilled = false;
      for (const bar of barQueues) {
        if (bar.halvesFilled >= bar.halvesTarget) continue;
        // Find a position: next BT slot (after regular fills), or an unused OC position
        const pos = bar.btPositions[bar.btFilled + bar.halvesFilled]
          || bar.ocPositions.find(p => !assignmentsByPos.get(p.id)?.employeeId);
        if (!pos) continue;
        const candidate = findHalfCandidate();
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, { ...makeAssignment(pos.id, candidate, false), customHours: halfHours });
          bar.halvesFilled++;
          anyFilled = true;
        }
      }
    }

    // Overflow pass: place remaining halves at ANY bar with available BT/OC positions
    let totalUnplacedHalves = barQueues.reduce(
      (sum, b) => sum + Math.max(0, b.halvesTarget - b.halvesFilled), 0
    );
    if (totalUnplacedHalves > 0) {
      let overflowPlaced = true;
      while (overflowPlaced && totalUnplacedHalves > 0) {
        overflowPlaced = false;
        for (const bar of barQueues) {
          if (totalUnplacedHalves <= 0) break;
          const pos = [...bar.btPositions, ...bar.ocPositions]
            .find(p => !assignmentsByPos.get(p.id)?.employeeId);
          if (!pos) continue;
          const candidate = findHalfCandidate();
          if (!candidate) break;
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, { ...makeAssignment(pos.id, candidate, false), customHours: halfHours });
          totalUnplacedHalves--;
          overflowPlaced = true;
        }
      }
    }

    // Round-robin fill barbacks
    anyFilled = true;
    while (anyFilled) {
      anyFilled = false;
      for (const bar of barQueues) {
        if (bar.bbFilled >= bar.bbTarget) continue;
        const pos = bar.bbPositions[bar.bbFilled];
        if (!pos) continue;
        const candidate = findCandidate(['Barback']);
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, false));
          bar.bbFilled++;
          anyFilled = true;
        }
      }
    }

    // Fill server positions with downstairs/upstairs limits
    const serverArea = openAreas.find(a => a.id === 'servers');
    if (serverArea) {
      const srvLimits = serverStaffing ?? { downstairs: 2, upstairs: 1 };
      let downFilled = 0, upFilled = 0;
      // Count already-pinned/preferred servers toward limits
      for (const pos of serverArea.positions) {
        if ((pinnedPositionIds.has(pos.id) || preferredWellPositionIds.has(pos.id)) && assignmentsByPos.get(pos.id)?.employeeId) {
          if (pos.id.includes('upstairs')) upFilled++;
          else downFilled++;
        }
      }
      for (const pos of serverArea.positions) {
        if (pinnedPositionIds.has(pos.id) || preferredWellPositionIds.has(pos.id) || assignmentsByPos.get(pos.id)?.employeeId) continue;
        const isUpstairs = pos.id.includes('upstairs');
        const limit = isUpstairs ? srvLimits.upstairs : srvLimits.downstairs;
        const filled = isUpstairs ? upFilled : downFilled;
        if (filled >= limit) continue;
        const candidate = findCandidate(['Server']);
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, false));
          if (isUpstairs) upFilled++; else downFilled++;
        }
      }
    }
  } else {
    // === Legacy round-robin distribution mode ===

    // Step 1: Fill speed wells across ALL open bars (sorted by speedRank)
    const legacyReserved = new Set([...pinnedPositionIds, ...preferredWellPositionIds]);
    const allSpeedPositions: { pos: typeof BAR_AREAS[0]['positions'][0] }[] = [];
    for (const area of openAreas) {
      for (const pos of area.positions) {
        if (pos.type === 'speed' && !legacyReserved.has(pos.id)) {
          allSpeedPositions.push({ pos });
        }
      }
    }
    allSpeedPositions.sort((a, b) => (a.pos.speedRank ?? 99) - (b.pos.speedRank ?? 99));

    for (const { pos } of allSpeedPositions) {
      const candidate = findCandidate(['Bartender']);
      if (candidate) {
        assigned.add(candidate.id);
        assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, false));
      }
    }

    // Step 2: Fill standard and on_call positions round-robin across areas
    const standardQueues = new Map<string, { pos: typeof BAR_AREAS[0]['positions'][0]; type: PositionType }[]>();
    for (const area of openAreas) {
      const queue = area.positions
        .filter(p => (p.type === 'standard' || p.type === 'on_call') && !legacyReserved.has(p.id))
        .map(p => ({ pos: p, type: p.type }));
      if (queue.length > 0) {
        standardQueues.set(area.id, queue);
      }
    }

    let anyFilled = true;
    while (anyFilled) {
      anyFilled = false;
      for (const [, queue] of standardQueues) {
        if (queue.length === 0) continue;
        const { pos, type } = queue[0];
        const eligibleRoles = POSITION_ELIGIBLE_ROLES[type] || [];
        const candidate = findCandidate(eligibleRoles);
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, type === 'on_call'));
          queue.shift();
          anyFilled = true;
        } else {
          queue.shift();
        }
      }
      if (!anyFilled) {
        for (const [, queue] of standardQueues) {
          if (queue.length > 0) { anyFilled = true; break; }
        }
        if (anyFilled) {
          let filledAny = false;
          for (const [, queue] of standardQueues) {
            if (queue.length === 0) continue;
            const { pos, type } = queue[0];
            const eligibleRoles = POSITION_ELIGIBLE_ROLES[type] || [];
            const candidate = findCandidate(eligibleRoles);
            if (candidate) {
              assigned.add(candidate.id);
              assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, type === 'on_call'));
              queue.shift();
              filledAny = true;
            } else {
              queue.shift();
            }
          }
          anyFilled = filledAny;
        }
      }
    }

    // Step 3: Fill barback positions round-robin
    const barbackQueues = new Map<string, typeof BAR_AREAS[0]['positions']>();
    for (const area of openAreas) {
      const bbPositions = area.positions.filter(p => p.type === 'barback' && !legacyReserved.has(p.id));
      if (bbPositions.length > 0) {
        barbackQueues.set(area.id, [...bbPositions]);
      }
    }

    anyFilled = true;
    while (anyFilled) {
      anyFilled = false;
      for (const [, queue] of barbackQueues) {
        if (queue.length === 0) continue;
        const pos = queue[0];
        const candidate = findCandidate(['Barback']);
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, false));
          queue.shift();
          anyFilled = true;
        } else {
          queue.shift();
        }
      }
    }

    // Step 4: Fill server positions with downstairs/upstairs limits
    const legacyServerArea = openAreas.find(a => a.id === 'servers');
    if (legacyServerArea) {
      const srvLimits = serverStaffing ?? { downstairs: 2, upstairs: 1 };
      let downFilled = 0, upFilled = 0;
      for (const pos of legacyServerArea.positions) {
        if (legacyReserved.has(pos.id) && assignmentsByPos.get(pos.id)?.employeeId) {
          if (pos.id.includes('upstairs')) upFilled++;
          else downFilled++;
        }
      }
      for (const pos of legacyServerArea.positions) {
        if (legacyReserved.has(pos.id) || assignmentsByPos.get(pos.id)?.employeeId) continue;
        const isUpstairs = pos.id.includes('upstairs');
        const limit = isUpstairs ? srvLimits.upstairs : srvLimits.downstairs;
        const filled = isUpstairs ? upFilled : downFilled;
        if (filled >= limit) continue;
        const candidate = findCandidate(['Server']);
        if (candidate) {
          assigned.add(candidate.id);
          assignmentsByPos.set(pos.id, makeAssignment(pos.id, candidate, false));
          if (isUpstairs) upFilled++; else downFilled++;
        }
      }
    }
  }

  // === Build final areas structure ===
  const areas = BAR_AREAS.map(area => ({
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
    shiftHours: { start: template.start, end: template.end },
    areas,
    unassigned,
  };
}

/** Generate weekly lineups from a schedule result — 3 shift lineups per day */
export function generateWeeklyLineups(
  schedule: ScheduleResult,
  shiftTemplates?: ShiftTemplate[],
  hoursOverrides?: Partial<Record<DayOfWeek, { open: string; close: string }>>,
  closedBarsMap?: Record<string, string[]>,
  weekConfig?: WeekConfig,
  preferredEmployeeIds?: Set<string>,
  generationConfig?: GenerationConfig,
  wellPreferences?: Map<string, string>,
  fullEmployeeLookup?: Map<string, { id: string; name: string; performanceScore: number; role: string }>
): DailyLineup[] {
  const weekDates = getWeekDates(schedule.weekStart);
  const templates = weekConfig?.shiftTemplates || shiftTemplates || DEFAULT_SHIFT_TEMPLATES;

  // Build a global employee lookup so well-preference employees can be found
  // even if the scheduler didn't assign them to a slot on this day/shift.
  // Start with the full employee list (if provided), then overlay with
  // schedule assignments (which have the role the scheduler chose).
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

  return DAYS.map(day => {
    const date = weekDates[day];
    const dayAssignments = schedule.assignments.filter(a => a.shiftSlot.dayOfWeek === day);
    const hours = hoursOverrides?.[day] || DEFAULT_OPERATING_HOURS[day];
    const dayConfig = weekConfig?.days[day];

    // If day is closed in weekConfig, return empty shifts
    if (dayConfig && !dayConfig.open) {
      return {
        date,
        dayOfWeek: day,
        operatingHours: hours,
        shifts: templates.map(template => ({
          date,
          dayOfWeek: day,
          shiftPeriod: template.id as ShiftPeriod,
          shiftHours: { start: template.start, end: template.end },
          areas: BAR_AREAS.map(area => ({
            areaId: area.id,
            assignments: area.positions.map(pos => ({
              positionId: pos.id,
              employeeId: null,
              employeeName: '',
              performanceScore: 0,
              role: '',
              isOnCall: pos.type === 'on_call',
            })),
          })),
          unassigned: [],
        })),
      };
    }

    const shifts = templates.map(template => {
      const shiftPeriod = template.id as ShiftPeriod;
      const genShiftConfig = generationConfig?.days[day]?.shifts[shiftPeriod];

      // Apply per-day morning start override if present, or generationConfig times
      let effectiveTemplate = template;
      if (genShiftConfig) {
        effectiveTemplate = { ...template, start: genShiftConfig.startTime, end: genShiftConfig.endTime };
      } else if (shiftPeriod === 'morning' && dayConfig?.morningStartOverride) {
        effectiveTemplate = { ...template, start: dayConfig.morningStartOverride };
      }

      // Extract per-bar staffing from generationConfig when available
      const perBarStaffing = genShiftConfig?.staffing?.bars;

      // Determine closed bars
      let closedBarsArr: string[];
      if (genShiftConfig) {
        closedBarsArr = genShiftConfig.closedBars;
      } else if (dayConfig?.closedBars?.[shiftPeriod]) {
        closedBarsArr = dayConfig.closedBars[shiftPeriod];
      } else {
        const closedBarsKey = `${day}::${shiftPeriod}`;
        closedBarsArr = closedBarsMap?.[closedBarsKey] ?? DEFAULT_SHIFT_CLOSED_BARS[shiftPeriod] ?? [];
      }

      // When perBarStaffing is available, dynamically sync closedBars:
      // - Bar with ANY staffing > 0 → open (remove from closedBars)
      // - Bar with ALL staffing = 0 → closed (add to closedBars)
      // This ensures the lineup respects the user's actual staffing choices
      // from the GeneratePanel, regardless of the static closedBars defaults.
      if (perBarStaffing) {
        const dynamicClosed = new Set(closedBarsArr);
        for (const area of BAR_AREAS) {
          if (area.id === 'servers') continue;
          const barStaff = perBarStaffing[area.id];
          if (barStaff) {
            const totalStaff = (barStaff.bartenders || 0) + (barStaff.barbacks || 0) +
              (barStaff.onCalls || 0) + (barStaff.halves || 0);
            if (totalStaff > 0) {
              dynamicClosed.delete(area.id); // user wants staff here → open it
            } else {
              dynamicClosed.add(area.id);    // user wants 0 staff → close it
            }
          }
        }
        closedBarsArr = [...dynamicClosed];
      }
      const closedBars = new Set(closedBarsArr);

      // Filter assignments to only those scheduled for this shift period
      const shiftAssignments = dayAssignments.filter(
        a => SHIFT_TYPE_TO_PERIOD[a.shiftSlot.shiftType as ShiftType] === shiftPeriod
      );

      // Collect pinned placements for this day+shift
      const pins = weekConfig?.pinnedPlacements.filter(
        p => p.dayOfWeek === day && p.shiftPeriod === shiftPeriod
      );

      const serverStaffing = genShiftConfig?.staffing?.servers;
      return buildShiftLineup(day, date, shiftPeriod, effectiveTemplate, shiftAssignments, closedBars, pins, preferredEmployeeIds, perBarStaffing, wellPreferences, allEmployeeLookup, serverStaffing);
    });

    return {
      date,
      dayOfWeek: day,
      operatingHours: hours,
      shifts,
    };
  });
}

/** Apply manual overrides to a shift lineup */
export function applyShiftLineupOverrides(
  shiftLineup: ShiftLineup,
  changes: { positionId: string; employeeId: string | null; customHours?: { start: string; end: string }; note?: string }[]
): ShiftLineup {
  const updated = { ...shiftLineup, areas: shiftLineup.areas.map(a => ({ ...a, assignments: [...a.assignments] })), unassigned: [...shiftLineup.unassigned] };

  for (const change of changes) {
    for (const area of updated.areas) {
      const idx = area.assignments.findIndex(a => a.positionId === change.positionId);
      if (idx !== -1) {
        const existing = area.assignments[idx];

        if (change.employeeId) {
          const fromUnassigned = updated.unassigned.find(u => u.employeeId === change.employeeId);
          if (fromUnassigned) {
            area.assignments[idx] = {
              ...existing,
              employeeId: fromUnassigned.employeeId,
              employeeName: fromUnassigned.employeeName,
              performanceScore: fromUnassigned.performanceScore,
              role: fromUnassigned.role,
              customHours: change.customHours,
              note: change.note ?? existing.note,
            };
            updated.unassigned = updated.unassigned.filter(u => u.employeeId !== change.employeeId);
          } else {
            for (const srcArea of updated.areas) {
              const srcIdx = srcArea.assignments.findIndex(a => a.employeeId === change.employeeId);
              if (srcIdx !== -1) {
                const srcAssignment = srcArea.assignments[srcIdx];
                area.assignments[idx] = {
                  ...existing,
                  employeeId: srcAssignment.employeeId,
                  employeeName: srcAssignment.employeeName,
                  performanceScore: srcAssignment.performanceScore,
                  role: srcAssignment.role,
                  customHours: change.customHours,
                  note: change.note,
                };
                srcArea.assignments[srcIdx] = {
                  ...srcAssignment,
                  employeeId: null,
                  employeeName: '',
                  performanceScore: 0,
                  role: '',
                  customHours: undefined,
                  isOnCall: srcAssignment.isOnCall,
                  note: undefined,
                };
                break;
              }
            }
          }
        } else {
          if (existing.employeeId) {
            updated.unassigned.push({
              employeeId: existing.employeeId,
              employeeName: existing.employeeName,
              performanceScore: existing.performanceScore,
              role: existing.role,
            });
          }
          area.assignments[idx] = {
            ...existing,
            employeeId: null,
            employeeName: '',
            performanceScore: 0,
            role: '',
            customHours: undefined,
            note: undefined,
          };
        }

        if (change.note !== undefined) {
          area.assignments[idx] = { ...area.assignments[idx], note: change.note };
        }
      }
    }
  }

  return updated;
}
