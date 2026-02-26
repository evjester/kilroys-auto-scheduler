/**
 * Hard Constraint Checking
 * Returns true if an employee passes all hard constraints for a shift slot
 */

import type { EmployeeProfile, ShiftSlot, DayOfWeek } from './types';
import { fitsInWindow, timesOverlap, hoursBetweenShifts } from './time-utils';
import { MIN_REST_HOURS } from './mock-config';

export interface ConstraintResult {
  passes: boolean;
  reason?: string;
}

/** Check if employee is available on the shift's day/time */
function checkAvailability(emp: EmployeeProfile, shift: ShiftSlot): ConstraintResult {
  const dayAvail = emp.availability[shift.dayOfWeek];
  if (dayAvail === null || dayAvail === undefined) {
    return { passes: false, reason: `Not available on ${shift.dayOfWeek}` };
  }
  if (!fitsInWindow(shift.startTime, shift.endTime, dayAvail.from, dayAvail.to)) {
    return { passes: false, reason: `Shift ${shift.startTime}-${shift.endTime} outside availability ${dayAvail.from}-${dayAvail.to}` };
  }
  return { passes: true };
}

/** Check if employee is qualified for the required role */
function checkRoleQualification(emp: EmployeeProfile, shift: ShiftSlot): ConstraintResult {
  if (!emp.roles.includes(shift.requiredRole)) {
    return { passes: false, reason: `Not qualified for ${shift.requiredRole}` };
  }
  return { passes: true };
}

/** Check if assigning this shift would exceed max weekly hours */
function checkMaxHours(emp: EmployeeProfile, shift: ShiftSlot): ConstraintResult {
  if (emp.currentWeekHours + shift.duration > emp.maxWeeklyHours) {
    return { passes: false, reason: `Would exceed max hours (${emp.currentWeekHours + shift.duration}/${emp.maxWeeklyHours})` };
  }
  return { passes: true };
}

/** Check for overlapping shift assignments */
function checkNoOverlap(emp: EmployeeProfile, shift: ShiftSlot, allSlots: ShiftSlot[]): ConstraintResult {
  for (const assignedId of emp.assignedShifts) {
    const assigned = allSlots.find(s => s.id === assignedId);
    if (!assigned) continue;
    if (assigned.date !== shift.date) continue;

    if (timesOverlap(assigned.startTime, assigned.endTime, shift.startTime, shift.endTime)) {
      return { passes: false, reason: `Overlaps with existing shift ${assigned.id}` };
    }
  }
  return { passes: true };
}

/** Check minimum rest period between shifts */
function checkRestPeriod(emp: EmployeeProfile, shift: ShiftSlot, allSlots: ShiftSlot[]): ConstraintResult {
  for (const assignedId of emp.assignedShifts) {
    const assigned = allSlots.find(s => s.id === assignedId);
    if (!assigned) continue;

    const gap = hoursBetweenShifts(assigned.date, assigned.endTime, shift.date, shift.startTime);
    const reverseGap = hoursBetweenShifts(shift.date, shift.endTime, assigned.date, assigned.startTime);
    const minGap = Math.min(Math.abs(gap), Math.abs(reverseGap));

    if (minGap > 0 && minGap < MIN_REST_HOURS) {
      return { passes: false, reason: `Only ${minGap.toFixed(1)}hr rest (need ${MIN_REST_HOURS}hr min)` };
    }
  }
  return { passes: true };
}

/** Check approved time-off */
function checkTimeOff(emp: EmployeeProfile, shift: ShiftSlot): ConstraintResult {
  for (const to of emp.timeOff) {
    if (shift.date >= to.from && shift.date <= to.to) {
      return { passes: false, reason: `On approved time-off (${to.from} to ${to.to})` };
    }
  }
  return { passes: true };
}

/** Run all hard constraints. Returns { passes, failedReasons[] } */
export function checkHardConstraints(
  emp: EmployeeProfile,
  shift: ShiftSlot,
  allSlots: ShiftSlot[]
): { passes: boolean; failedReasons: string[] } {
  const checks = [
    checkAvailability(emp, shift),
    checkRoleQualification(emp, shift),
    checkMaxHours(emp, shift),
    checkNoOverlap(emp, shift, allSlots),
    checkRestPeriod(emp, shift, allSlots),
    checkTimeOff(emp, shift),
  ];

  const failed = checks.filter(c => !c.passes);
  return {
    passes: failed.length === 0,
    failedReasons: failed.map(c => c.reason!),
  };
}
