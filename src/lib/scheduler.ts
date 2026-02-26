/**
 * Core Scheduling Engine
 * Greedy assignment with difficulty sorting + swap optimization
 */

import type { EmployeeProfile, ShiftSlot, Assignment, ScheduleResult, WhatIfScenario, WhatIfResult, WeekConfig, GenerationConfig } from './types';
import { generateShiftSlots, shiftLabel } from './shift-templates';
import { checkHardConstraints } from './constraints';
import { scoreEmployeeForShift } from './scoring';
import { buildSummary, buildRunnerUpGapReason } from './reasoning';
import { ingestAllData } from './ingest';
import { buildEmployeeProfiles } from './metrics';

/** Calculate difficulty score for a shift (higher = harder to fill) */
function shiftDifficulty(slot: ShiftSlot, employees: EmployeeProfile[], allSlots: ShiftSlot[]): number {
  // Count eligible employees (quick check — just availability + role)
  const eligible = employees.filter(e =>
    e.roles.includes(slot.requiredRole) &&
    e.availability[slot.dayOfWeek] !== null &&
    e.availability[slot.dayOfWeek] !== undefined
  ).length;

  const isWeekend = slot.dayOfWeek === 'Friday' || slot.dayOfWeek === 'Saturday' ? 1 : 0;

  return (5 - slot.primeTier) * 20 - eligible * 5 + isWeekend * 10;
}

/** Compute team average prime shifts for fairness scoring */
function teamAvgPrimeShifts(employees: EmployeeProfile[]): number {
  if (employees.length === 0) return 0;
  const total = employees.reduce((sum, e) => sum + e.recentPrimeShiftCount, 0);
  return total / employees.length;
}

/** Run the greedy scheduling algorithm */
export function runScheduler(weekStart: string, employeeOverrides?: Map<string, Partial<EmployeeProfile>>, weekConfig?: WeekConfig, generationConfig?: GenerationConfig): ScheduleResult {
  // Ingest data
  const data = ingestAllData();

  // Build employee profiles
  let employees = buildEmployeeProfiles(
    data.employees,
    data.availability,
    data.timeOff,
    data.shifts,
    data.employeeTips,
    data.laborReport
  );

  // Apply overrides (for what-if scenarios)
  if (employeeOverrides) {
    employees = employees.map(emp => {
      const override = employeeOverrides.get(emp.id);
      if (override) {
        return { ...emp, ...override };
      }
      return emp;
    });
  }

  // Reset runtime state
  employees.forEach(e => {
    e.currentWeekHours = 0;
    e.assignedShifts = [];
  });

  // Generate shift slots
  const allSlots = generateShiftSlots(weekStart, weekConfig, generationConfig);

  // Sort shifts by difficulty (hardest first)
  const sortedSlots = [...allSlots].sort((a, b) =>
    shiftDifficulty(b, employees, allSlots) - shiftDifficulty(a, employees, allSlots)
  );

  const avgPrime = teamAvgPrimeShifts(employees);
  const assignments: Assignment[] = [];
  const unfilledShifts: ShiftSlot[] = [];
  const warnings: string[] = [];

  // === STEP 1: Greedy Assignment ===
  for (const slot of sortedSlots) {
    // Filter eligible employees
    const eligible = employees.filter(emp => {
      const result = checkHardConstraints(emp, slot, allSlots);
      return result.passes;
    });

    if (eligible.length === 0) {
      unfilledShifts.push(slot);
      warnings.push(`No eligible employees for ${shiftLabel(slot)} on ${slot.date}`);
      continue;
    }

    // Score each eligible employee
    const scored = eligible.map(emp => {
      const { totalScore, factors } = scoreEmployeeForShift(emp, slot, allSlots, avgPrime);
      return { emp, totalScore, factors };
    }).sort((a, b) => b.totalScore - a.totalScore);

    const best = scored[0];
    const runnerUp = scored.length > 1 ? scored[1] : undefined;

    // Build assignment
    const runnerUpInfo = runnerUp
      ? {
          name: runnerUp.emp.name,
          score: runnerUp.totalScore,
          gapReason: buildRunnerUpGapReason(best.factors, runnerUp.factors),
        }
      : undefined;

    const summary = buildSummary(
      best.emp.name,
      `${slot.dayOfWeek} ${slot.shiftType} ${slot.requiredRole}`,
      best.factors,
      runnerUpInfo,
      best.totalScore
    );

    assignments.push({
      shiftSlot: slot,
      employee: {
        id: best.emp.id,
        name: best.emp.name,
        role: slot.requiredRole,
        performanceScore: best.emp.performanceScore,
      },
      totalScore: best.totalScore,
      factors: best.factors,
      summary,
      alternativesCount: eligible.length - 1,
      runnerUp: runnerUpInfo,
    });

    // Update runtime state
    best.emp.currentWeekHours += slot.duration;
    best.emp.assignedShifts.push(slot.id);
  }

  // === STEP 2: Swap Optimization ===
  const MAX_SWAP_PASSES = 3;
  const MIN_IMPROVEMENT = 5;

  for (let pass = 0; pass < MAX_SWAP_PASSES; pass++) {
    let improved = false;

    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a1 = assignments[i];
        const a2 = assignments[j];

        // Skip if same employee
        if (a1.employee.id === a2.employee.id) continue;

        // Find full employee objects
        const emp1 = employees.find(e => e.id === a1.employee.id)!;
        const emp2 = employees.find(e => e.id === a2.employee.id)!;

        // Temporarily remove current assignments for constraint check
        const emp1Shifts = emp1.assignedShifts.filter(id => id !== a1.shiftSlot.id);
        const emp2Shifts = emp2.assignedShifts.filter(id => id !== a2.shiftSlot.id);

        // Check if swap is valid (hard constraints)
        const temp1 = { ...emp1, assignedShifts: emp1Shifts, currentWeekHours: emp1.currentWeekHours - a1.shiftSlot.duration };
        const temp2 = { ...emp2, assignedShifts: emp2Shifts, currentWeekHours: emp2.currentWeekHours - a2.shiftSlot.duration };

        const check1for2 = checkHardConstraints(temp1, a2.shiftSlot, allSlots);
        const check2for1 = checkHardConstraints(temp2, a1.shiftSlot, allSlots);

        if (!check1for2.passes || !check2for1.passes) continue;

        // Score the swap
        const currentScore = a1.totalScore + a2.totalScore;
        const { totalScore: newScore1, factors: newFactors1 } = scoreEmployeeForShift(temp1, a2.shiftSlot, allSlots, avgPrime);
        const { totalScore: newScore2, factors: newFactors2 } = scoreEmployeeForShift(temp2, a1.shiftSlot, allSlots, avgPrime);
        const newScore = newScore1 + newScore2;

        if (newScore > currentScore + MIN_IMPROVEMENT) {
          // Perform swap
          emp1.assignedShifts = [...emp1Shifts, a2.shiftSlot.id];
          emp2.assignedShifts = [...emp2Shifts, a1.shiftSlot.id];
          emp1.currentWeekHours = temp1.currentWeekHours + a2.shiftSlot.duration;
          emp2.currentWeekHours = temp2.currentWeekHours + a1.shiftSlot.duration;

          // Update assignments
          assignments[i] = {
            shiftSlot: a2.shiftSlot,
            employee: { id: emp1.id, name: emp1.name, role: a2.shiftSlot.requiredRole, performanceScore: emp1.performanceScore },
            totalScore: newScore1,
            factors: newFactors1,
            summary: buildSummary(emp1.name, shiftLabel(a2.shiftSlot), newFactors1),
            alternativesCount: a2.alternativesCount,
            runnerUp: a2.runnerUp,
          };
          assignments[j] = {
            shiftSlot: a1.shiftSlot,
            employee: { id: emp2.id, name: emp2.name, role: a1.shiftSlot.requiredRole, performanceScore: emp2.performanceScore },
            totalScore: newScore2,
            factors: newFactors2,
            summary: buildSummary(emp2.name, shiftLabel(a1.shiftSlot), newFactors2),
            alternativesCount: a1.alternativesCount,
            runnerUp: a1.runnerUp,
          };

          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  // Sort assignments by day then shift type for output
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const shiftOrder = ['AM', 'PM', 'Late'];
  assignments.sort((a, b) => {
    const dayDiff = dayOrder.indexOf(a.shiftSlot.dayOfWeek) - dayOrder.indexOf(b.shiftSlot.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return shiftOrder.indexOf(a.shiftSlot.shiftType) - shiftOrder.indexOf(b.shiftSlot.shiftType);
  });

  // Compute stats
  const totalShifts = allSlots.length;
  const filledShifts = assignments.length;
  const primeSlots = allSlots.filter(s => s.primeTier <= 2);
  const primeAssigned = assignments.filter(a => a.shiftSlot.primeTier <= 2);

  return {
    weekStart,
    weekEnd: (() => {
      const d = new Date(weekStart + 'T12:00:00');
      d.setDate(d.getDate() + 6);
      return d.toISOString().split('T')[0];
    })(),
    assignments,
    unfilledShifts,
    warnings,
    stats: {
      totalShifts,
      filledShifts,
      fillRate: totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0,
      avgScore: assignments.length > 0
        ? Math.round(assignments.reduce((s, a) => s + a.totalScore, 0) / assignments.length * 10) / 10
        : 0,
      primeShiftsFilled: primeAssigned.length,
      totalPrimeShifts: primeSlots.length,
    },
  };
}

/** Run a what-if scenario comparison */
export function runWhatIf(weekStart: string, scenario: WhatIfScenario): WhatIfResult {
  // Run original schedule
  const original = runScheduler(weekStart);

  // Build overrides based on scenario
  const overrides = new Map<string, Partial<EmployeeProfile>>();

  if (scenario.type === 'callout' && scenario.date) {
    // Employee calls out for a specific date — add it to their time-off
    const data = ingestAllData();
    const profiles = buildEmployeeProfiles(
      data.employees, data.availability, data.timeOff, data.shifts,
      data.employeeTips, data.laborReport
    );
    const emp = profiles.find(e => e.id === scenario.employeeId);
    if (emp) {
      overrides.set(scenario.employeeId, {
        timeOff: [...emp.timeOff, { from: scenario.date, to: scenario.date }],
      });
    }
  } else if (scenario.type === 'availability_change' && scenario.day) {
    const data = ingestAllData();
    const profiles = buildEmployeeProfiles(
      data.employees, data.availability, data.timeOff, data.shifts,
      data.employeeTips, data.laborReport
    );
    const emp = profiles.find(e => e.id === scenario.employeeId);
    if (emp) {
      const newAvailability = { ...emp.availability };
      newAvailability[scenario.day] = scenario.newAvailability || null;
      overrides.set(scenario.employeeId, { availability: newAvailability });
    }
  }

  // Run modified schedule
  const modified = runScheduler(weekStart, overrides);

  // Find changes
  const changes: WhatIfResult['changes'] = [];
  for (const modAssign of modified.assignments) {
    const origAssign = original.assignments.find(a => a.shiftSlot.id === modAssign.shiftSlot.id);
    if (!origAssign || origAssign.employee.id !== modAssign.employee.id) {
      changes.push({
        shiftId: modAssign.shiftSlot.id,
        shiftLabel: `${modAssign.shiftSlot.dayOfWeek} ${modAssign.shiftSlot.shiftType} ${modAssign.shiftSlot.requiredRole}`,
        previousEmployee: origAssign?.employee.name || '(unfilled)',
        newEmployee: modAssign.employee.name,
        reason: modAssign.summary,
      });
    }
  }

  // Check for shifts that were filled but are now unfilled
  for (const unfilled of modified.unfilledShifts) {
    const origAssign = original.assignments.find(a => a.shiftSlot.id === unfilled.id);
    if (origAssign) {
      changes.push({
        shiftId: unfilled.id,
        shiftLabel: `${unfilled.dayOfWeek} ${unfilled.shiftType} ${unfilled.requiredRole}`,
        previousEmployee: origAssign.employee.name,
        newEmployee: '(unfilled)',
        reason: 'No eligible replacement found',
      });
    }
  }

  return { original, modified, changes };
}
