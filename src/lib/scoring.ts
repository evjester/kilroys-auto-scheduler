/**
 * 6-Factor Weighted Scoring System
 * Scores each eligible (employee, shift) pair for assignment ranking
 */

import type { EmployeeProfile, ShiftSlot, ReasonFactor } from './types';
import { SCORING_WEIGHTS, MIN_REST_HOURS } from './mock-config';
import { hoursBetweenShifts } from './time-utils';

/** Score how well the employee's performance matches the shift's needs */
function scorePerformance(emp: EmployeeProfile, shift: ShiftSlot): ReasonFactor {
  // Higher performers score higher, especially for prime shifts
  let value = emp.performanceScore;
  // Boost for prime shifts — top performers get extra credit
  if (shift.primeTier <= 2) {
    value = Math.min(100, value * 1.1);
  }

  const explanation = value >= 80
    ? `Top performer (${emp.performanceScore}/100)`
    : value >= 60
    ? `Solid performer (${emp.performanceScore}/100)`
    : value >= 40
    ? `Developing performer (${emp.performanceScore}/100)`
    : `New/building metrics (${emp.performanceScore}/100)`;

  return {
    name: 'Performance',
    value: Math.round(value),
    weight: SCORING_WEIGHTS.performance,
    weighted: Math.round(value * SCORING_WEIGHTS.performance * 10) / 10,
    explanation,
  };
}

/** Score role proficiency — primary role match vs secondary */
function scoreProficiency(emp: EmployeeProfile, shift: ShiftSlot): ReasonFactor {
  const isPrimary = emp.primaryRole === shift.requiredRole;
  const value = isPrimary ? 100 : 60;

  return {
    name: 'Proficiency',
    value,
    weight: SCORING_WEIGHTS.proficiency,
    weighted: Math.round(value * SCORING_WEIGHTS.proficiency * 10) / 10,
    explanation: isPrimary
      ? `Primary role match (${shift.requiredRole})`
      : `Secondary role (primary: ${emp.primaryRole})`,
  };
}

/** Score preference match — does the employee want this shift? */
function scorePreference(emp: EmployeeProfile, shift: ShiftSlot): ReasonFactor {
  let value = 50; // neutral baseline
  const reasons: string[] = [];

  // Day preference
  if (emp.preferences.preferredDays.includes(shift.dayOfWeek)) {
    value += 25;
    reasons.push(`prefers ${shift.dayOfWeek}`);
  }

  // Shift type preference
  if (emp.preferences.preferredShiftType === shift.shiftType) {
    value += 25;
    reasons.push(`prefers ${shift.shiftType} shifts`);
  } else if (emp.preferences.preferredShiftType === 'Any') {
    value += 10;
    reasons.push('flexible on shift type');
  }

  value = Math.min(100, value);
  const explanation = reasons.length > 0
    ? reasons.join(', ')
    : 'No strong preference match';

  return {
    name: 'Preference',
    value,
    weight: SCORING_WEIGHTS.preference,
    weighted: Math.round(value * SCORING_WEIGHTS.preference * 10) / 10,
    explanation: explanation.charAt(0).toUpperCase() + explanation.slice(1),
  };
}

/** Score fairness — employees with fewer recent prime shifts get a boost */
function scoreFairness(
  emp: EmployeeProfile,
  shift: ShiftSlot,
  teamAvgPrimeShifts: number
): ReasonFactor {
  if (shift.primeTier > 2) {
    // For non-prime shifts, fairness score is neutral
    return {
      name: 'Fairness',
      value: 50,
      weight: SCORING_WEIGHTS.fairness,
      weighted: Math.round(50 * SCORING_WEIGHTS.fairness * 10) / 10,
      explanation: 'Standard shift — fairness neutral',
    };
  }

  // Prime shift deficit: positive means employee is "owed" prime shifts
  const deficit = teamAvgPrimeShifts - emp.recentPrimeShiftCount;
  // Map deficit to 0-100: -5 deficit = 0, +5 deficit = 100
  const value = Math.max(0, Math.min(100, 50 + deficit * 10));

  let explanation: string;
  if (deficit > 1) {
    explanation = `Due for prime shifts (${emp.recentPrimeShiftCount} recent vs ${teamAvgPrimeShifts.toFixed(1)} avg)`;
  } else if (deficit < -1) {
    explanation = `Had many recent prime shifts (${emp.recentPrimeShiftCount} vs ${teamAvgPrimeShifts.toFixed(1)} avg)`;
  } else {
    explanation = `Fair distribution (${emp.recentPrimeShiftCount} recent, team avg ${teamAvgPrimeShifts.toFixed(1)})`;
  }

  return {
    name: 'Fairness',
    value: Math.round(value),
    weight: SCORING_WEIGHTS.fairness,
    weighted: Math.round(value * SCORING_WEIGHTS.fairness * 10) / 10,
    explanation,
  };
}

/** Score rest period — higher when well-rested, lower near clopen territory */
function scoreRest(emp: EmployeeProfile, shift: ShiftSlot, allSlots: ShiftSlot[]): ReasonFactor {
  if (emp.assignedShifts.length === 0) {
    return {
      name: 'Rest',
      value: 100,
      weight: SCORING_WEIGHTS.rest,
      weighted: Math.round(100 * SCORING_WEIGHTS.rest * 10) / 10,
      explanation: 'No prior shifts this week — fully rested',
    };
  }

  // Find minimum rest gap from any assigned shift
  let minGap = Infinity;
  for (const assignedId of emp.assignedShifts) {
    const assigned = allSlots.find(s => s.id === assignedId);
    if (!assigned) continue;

    const gap1 = hoursBetweenShifts(assigned.date, assigned.endTime, shift.date, shift.startTime);
    const gap2 = hoursBetweenShifts(shift.date, shift.endTime, assigned.date, assigned.startTime);
    const gap = Math.min(Math.abs(gap1), Math.abs(gap2));
    if (gap > 0 && gap < minGap) minGap = gap;
  }

  if (minGap === Infinity) minGap = 48; // no overlap found

  // Map: MIN_REST_HOURS = 0 score, 24+ hours = 100 score
  const value = Math.max(0, Math.min(100, ((minGap - MIN_REST_HOURS) / (24 - MIN_REST_HOURS)) * 100));

  const explanation = minGap >= 24
    ? `Well rested (${minGap.toFixed(0)}hr gap)`
    : minGap >= 14
    ? `Adequate rest (${minGap.toFixed(0)}hr gap)`
    : `Tight turnaround (${minGap.toFixed(0)}hr gap)`;

  return {
    name: 'Rest',
    value: Math.round(value),
    weight: SCORING_WEIGHTS.rest,
    weighted: Math.round(value * SCORING_WEIGHTS.rest * 10) / 10,
    explanation,
  };
}

/** Score hours need — employees further from target hours score higher */
function scoreHoursNeed(emp: EmployeeProfile, shift: ShiftSlot): ReasonFactor {
  const remaining = emp.targetWeeklyHours - emp.currentWeekHours;
  const pctRemaining = remaining / emp.targetWeeklyHours;

  // Map: 0% remaining = 0 (already at target), 100% remaining = 100 (needs hours)
  const value = Math.max(0, Math.min(100, pctRemaining * 100));

  const explanation = pctRemaining > 0.7
    ? `Needs hours (${emp.currentWeekHours.toFixed(0)}/${emp.targetWeeklyHours}hr target)`
    : pctRemaining > 0.3
    ? `Building toward target (${emp.currentWeekHours.toFixed(0)}/${emp.targetWeeklyHours}hr)`
    : `Near target hours (${emp.currentWeekHours.toFixed(0)}/${emp.targetWeeklyHours}hr)`;

  return {
    name: 'Hours Need',
    value: Math.round(value),
    weight: SCORING_WEIGHTS.hoursNeed,
    weighted: Math.round(value * SCORING_WEIGHTS.hoursNeed * 10) / 10,
    explanation,
  };
}

/** Compute full score for an (employee, shift) pair */
export function scoreEmployeeForShift(
  emp: EmployeeProfile,
  shift: ShiftSlot,
  allSlots: ShiftSlot[],
  teamAvgPrimeShifts: number
): { totalScore: number; factors: ReasonFactor[] } {
  const factors = [
    scorePerformance(emp, shift),
    scoreProficiency(emp, shift),
    scorePreference(emp, shift),
    scoreFairness(emp, shift, teamAvgPrimeShifts),
    scoreRest(emp, shift, allSlots),
    scoreHoursNeed(emp, shift),
  ];

  const totalScore = Math.round(factors.reduce((sum, f) => sum + f.weighted, 0) * 10) / 10;

  return { totalScore, factors };
}
