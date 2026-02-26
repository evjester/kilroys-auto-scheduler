/**
 * Metrics Engine — computes employee performance scores from Toast data
 * and builds EmployeeProfile objects combining Toast + 7shifts data
 */

import type {
  ToastEmployeeTips,
  ToastLaborReport,
  SevenShiftsEmployee,
  SevenShiftsAvailability,
  SevenShiftsTimeOff,
  SevenShiftsShift,
  EmployeeProfile,
  DayOfWeek,
  TimeWindow,
} from './types';
import { MOCK_EMPLOYEES, PERFORMANCE_WEIGHTS, getPrimeTier } from './mock-config';
import { getDayOfWeek } from './time-utils';

interface RawMetrics {
  totalSales: number;
  totalTips: number;
  totalHours: number;
  totalScheduledHours: number;
  totalActualHours: number;
  shiftCount: number;
  tipPctSum: number;
}

/** Compute per-employee raw metrics from Toast data */
function computeRawMetrics(
  tips: ToastEmployeeTips[],
  labor: ToastLaborReport[]
): Map<string, RawMetrics> {
  const metrics = new Map<string, RawMetrics>();

  for (const t of tips) {
    if (!metrics.has(t.employeeId)) {
      metrics.set(t.employeeId, {
        totalSales: 0, totalTips: 0, totalHours: 0,
        totalScheduledHours: 0, totalActualHours: 0,
        shiftCount: 0, tipPctSum: 0,
      });
    }
    const m = metrics.get(t.employeeId)!;
    m.totalSales += t.netSales;
    m.totalTips += t.netTips;
    m.totalHours += t.hoursWorked;
    m.shiftCount += 1;
    m.tipPctSum += t.tipPct;
  }

  for (const l of labor) {
    if (!metrics.has(l.employeeId)) continue;
    const m = metrics.get(l.employeeId)!;
    m.totalScheduledHours += l.scheduledHours;
    m.totalActualHours += l.totalHours;
  }

  return metrics;
}

/** Normalize a value to 0-100 scale given min/max bounds */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/** Count prime shifts from historical 7shifts data */
function countPrimeShifts(shifts: SevenShiftsShift[], employeeId: string, weeksBack: number = 4): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  let count = 0;
  for (const s of shifts) {
    if (s.employeeId !== employeeId) continue;
    if (s.shiftDate < cutoffStr) continue;

    const day = getDayOfWeek(s.shiftDate) as DayOfWeek;
    const shiftType = s.start >= '20:00' ? 'Late' : s.start >= '16:00' ? 'PM' : 'AM';
    const tier = getPrimeTier(day, shiftType as 'AM' | 'PM' | 'Late');
    if (tier <= 2) count++;
  }
  return count;
}

/** Build full EmployeeProfile objects from all data sources */
export function buildEmployeeProfiles(
  employees: SevenShiftsEmployee[],
  availability: SevenShiftsAvailability[],
  timeOff: SevenShiftsTimeOff[],
  shifts: SevenShiftsShift[],
  tips: ToastEmployeeTips[],
  labor: ToastLaborReport[]
): EmployeeProfile[] {
  const rawMetrics = computeRawMetrics(tips, labor);

  // Get ranges for normalization
  const allSalesPerHr: number[] = [];
  const allTipsPerHr: number[] = [];
  const allTipPct: number[] = [];
  const allReliability: number[] = [];

  for (const [, m] of rawMetrics) {
    if (m.shiftCount > 0) {
      allSalesPerHr.push(m.totalSales / m.totalHours);
      allTipsPerHr.push(m.totalTips / m.totalHours);
      allTipPct.push(m.tipPctSum / m.shiftCount);
    }
    if (m.totalScheduledHours > 0) {
      allReliability.push(Math.min(m.totalActualHours / m.totalScheduledHours, 1.0));
    }
  }

  const ranges = {
    salesPerHr: { min: Math.min(...allSalesPerHr, 0), max: Math.max(...allSalesPerHr, 1) },
    tipsPerHr: { min: Math.min(...allTipsPerHr, 0), max: Math.max(...allTipsPerHr, 1) },
    tipPct: { min: Math.min(...allTipPct, 0), max: Math.max(...allTipPct, 1) },
    reliability: { min: Math.min(...allReliability, 0), max: Math.max(...allReliability, 1) },
  };

  // Build availability map per employee
  const availMap = new Map<string, Partial<Record<DayOfWeek, TimeWindow | null>>>();
  for (const a of availability) {
    if (!availMap.has(a.employeeId)) availMap.set(a.employeeId, {});
    const map = availMap.get(a.employeeId)!;
    if (a.availability === 'All Day Unavailable' || a.availability === 'Unavailable') {
      map[a.day] = null;
    } else if (a.availability === 'All Day Available') {
      map[a.day] = { from: '00:00', to: '23:59' };
    } else {
      map[a.day] = { from: a.availableFrom, to: a.availableTo };
    }
  }

  // Build time-off list per employee (only approved)
  const timeOffMap = new Map<string, { from: string; to: string }[]>();
  for (const t of timeOff) {
    if (t.status !== 'Approved') continue;
    if (!timeOffMap.has(t.employeeId)) timeOffMap.set(t.employeeId, []);
    timeOffMap.get(t.employeeId)!.push({ from: t.fromDate, to: t.toDate });
  }

  return employees.map(emp => {
    const mockDef = MOCK_EMPLOYEES.find(m => m.id === emp.employeeId);
    const metrics = rawMetrics.get(emp.employeeId);

    const avgSalesPerHour = metrics && metrics.totalHours > 0 ? metrics.totalSales / metrics.totalHours : 0;
    const avgTipsPerHour = metrics && metrics.totalHours > 0 ? metrics.totalTips / metrics.totalHours : 0;
    const avgTipPct = metrics && metrics.shiftCount > 0 ? metrics.tipPctSum / metrics.shiftCount : 0;
    const reliabilityRatio = metrics && metrics.totalScheduledHours > 0
      ? Math.min(metrics.totalActualHours / metrics.totalScheduledHours, 1.0)
      : 0.85;

    // Normalize to 0-100
    const normSales = normalize(avgSalesPerHour, ranges.salesPerHr.min, ranges.salesPerHr.max);
    const normTips = normalize(avgTipsPerHour, ranges.tipsPerHr.min, ranges.tipsPerHr.max);
    const normTipPct = normalize(avgTipPct, ranges.tipPct.min, ranges.tipPct.max);
    const normReliability = normalize(reliabilityRatio, ranges.reliability.min, ranges.reliability.max);

    // Composite performance score
    // For non-tipped roles without sales data, use a tier-based default
    const hasTipData = metrics && metrics.shiftCount > 0;
    let performanceScore: number;
    if (hasTipData) {
      performanceScore = Math.round(
        normSales * PERFORMANCE_WEIGHTS.salesPerHour +
        normTips * PERFORMANCE_WEIGHTS.tipsPerHour +
        normTipPct * PERFORMANCE_WEIGHTS.tipPct +
        normReliability * PERFORMANCE_WEIGHTS.reliability
      );
    } else {
      // Default scores for non-tipped roles based on tier
      const tierDefaults: Record<string, number> = {
        top: 88, high: 75, mid: 62, low: 45, new: 35,
      };
      performanceScore = tierDefaults[mockDef?.performanceTier || 'mid'] || 60;
    }

    const roles = emp.roles.split(';').map(r => r.trim());

    return {
      id: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      firstName: emp.firstName,
      lastName: emp.lastName,
      roles,
      primaryRole: mockDef?.primaryRole || roles[0],
      department: emp.departments,
      wage: emp.wage,

      performanceScore,
      avgSalesPerHour: Math.round(avgSalesPerHour * 100) / 100,
      avgTipsPerHour: Math.round(avgTipsPerHour * 100) / 100,
      avgTipPct: Math.round(avgTipPct * 100) / 100,
      reliabilityScore: Math.round(normReliability),

      maxWeeklyHours: mockDef?.maxHours || 40,
      targetWeeklyHours: mockDef?.targetHours || 30,
      availability: availMap.get(emp.employeeId) || {},
      timeOff: timeOffMap.get(emp.employeeId) || [],

      preferences: {
        preferredDays: mockDef?.preferredDays || [],
        preferredShiftType: mockDef?.preferredShift || 'Any',
      },

      recentPrimeShiftCount: countPrimeShifts(shifts, emp.employeeId),
      currentWeekHours: 0,
      assignedShifts: [],
    } as EmployeeProfile;
  });
}
