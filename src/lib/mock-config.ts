import { DayOfWeek, PrimeTier, ShiftType, TimeWindow } from './types';

// ============================================================
// Bar Configuration — Kilroy's on Kirkwood, Bloomington, IN
// ============================================================

export const BAR_NAME = "Kilroy's on Kirkwood";
export const LOCATION = 'Bloomington, IN';

// Operating hours
export const OPEN_TIME = '11:00';
export const CLOSE_TIME = '02:00'; // next day

// Shift definitions
export const SHIFT_DEFINITIONS: Record<ShiftType, { start: string; end: string; duration: number }> = {
  AM:   { start: '11:00', end: '17:00', duration: 6 },
  PM:   { start: '16:00', end: '01:00', duration: 9 },
  Late: { start: '20:00', end: '02:00', duration: 6 },
};

// Roles and their departments
export const ROLE_CONFIG: Record<string, { department: string; minWage: number; maxWage: number; tipped: boolean }> = {
  'Bartender':      { department: 'Bar',      minWage: 12.00, maxWage: 22.00, tipped: true },
  'Barback':        { department: 'Bar',      minWage: 10.00, maxWage: 14.00, tipped: true },
  'Server':         { department: 'Floor',    minWage: 5.00,  maxWage: 8.00,  tipped: true },
  'Security':       { department: 'Security', minWage: 12.00, maxWage: 18.00, tipped: false },
  'Carder':         { department: 'Security', minWage: 10.00, maxWage: 14.00, tipped: false },
};

// Staffing requirements per shift type per day
// Format: { role: count } per (dayOfWeek, shiftType)
export interface StaffingReq {
  role: string;
  count: number;
}

export const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Which shift types run on which days
// All days get all 3 shifts — use the shift disable toggle in the UI to turn off shifts you don't need
export const DAY_SHIFT_TYPES: Record<DayOfWeek, ShiftType[]> = {
  Monday:    ['AM', 'PM', 'Late'],
  Tuesday:   ['AM', 'PM', 'Late'],
  Wednesday: ['AM', 'PM', 'Late'],
  Thursday:  ['AM', 'PM', 'Late'],
  Friday:    ['AM', 'PM', 'Late'],
  Saturday:  ['AM', 'PM', 'Late'],
  Sunday:    ['AM', 'PM', 'Late'],
};

// Staffing requirements per shift type
// Tuned for ~50 employees to produce ~30-35 unique employees per busy day
export function getStaffingReqs(day: DayOfWeek, shiftType: ShiftType): StaffingReq[] {
  const isWeekend = day === 'Friday' || day === 'Saturday';
  const isThursday = day === 'Thursday';
  const isBusy = isWeekend || isThursday;
  const isQuiet = day === 'Monday' || day === 'Tuesday' || day === 'Sunday';

  if (shiftType === 'AM') {
    return [
      { role: 'Bartender', count: isBusy ? 5 : 3 },
      { role: 'Barback', count: isBusy ? 2 : 1 },
      { role: 'Server', count: isBusy ? 2 : 1 },
    ];
  }

  if (shiftType === 'PM') {
    return [
      { role: 'Bartender', count: isWeekend ? 10 : isBusy ? 8 : isQuiet ? 4 : 5 },
      { role: 'Barback', count: isWeekend ? 3 : isQuiet ? 1 : 2 },
      { role: 'Server', count: isWeekend ? 3 : isBusy ? 2 : 1 },
    ];
  }

  // Late — full staff on busy nights, skeleton crew on quiet nights
  return [
    { role: 'Bartender', count: isWeekend ? 12 : isBusy ? 9 : isQuiet ? 4 : 5 },
    { role: 'Barback', count: isWeekend ? 3 : isQuiet ? 1 : 2 },
    { role: 'Server', count: isWeekend ? 3 : isBusy ? 2 : 1 },
  ];
}

// Prime shift tier classification
export function getPrimeTier(day: DayOfWeek, shiftType: ShiftType): PrimeTier {
  if ((day === 'Friday' || day === 'Saturday') && (shiftType === 'PM' || shiftType === 'Late')) return 1;
  if (day === 'Thursday' && (shiftType === 'PM' || shiftType === 'Late')) return 2;
  if (day === 'Sunday' && shiftType === 'PM') return 2;
  if (day === 'Wednesday' && shiftType === 'PM') return 3;
  if (day === 'Saturday' && shiftType === 'AM') return 3;
  return 4;
}

// Default shift hours per role (manager-editable)
// Shift templates (manager-editable named time blocks)
export const DEFAULT_SHIFT_TEMPLATES: import('./types').ShiftTemplate[] = [
  { id: 'morning',    label: 'Morning',    start: '11:00', end: '16:00' },
  { id: 'happy-hour', label: 'Happy Hour', start: '16:00', end: '21:00' },
  { id: 'night',      label: 'Night',      start: '21:00', end: '02:00' },
];

// Default closed bars per shift period (manager-overridable per day+shift)
export const DEFAULT_SHIFT_CLOSED_BARS: Record<string, string[]> = {
  'morning':    ['upstairs-bar'],
  'happy-hour': ['upstairs-bar'],
  'night':      [],  // all bars open at night
};

// Scoring weights
export const SCORING_WEIGHTS = {
  performance: 0.25,
  proficiency: 0.20,
  preference:  0.15,
  fairness:    0.20,
  rest:        0.10,
  hoursNeed:   0.10,
};

// Constraints
export const MAX_WEEKLY_HOURS_DEFAULT = 40;
export const MIN_REST_HOURS = 8;
export const MAX_CONSECUTIVE_DAYS = 6;
export const FAIRNESS_WINDOW_WEEKS = 4;

// Performance score weights (for computing from Toast data)
export const PERFORMANCE_WEIGHTS = {
  salesPerHour: 0.40,
  tipsPerHour:  0.30,
  tipPct:       0.15,
  reliability:  0.15,
};

// Role colors for UI
export const ROLE_COLORS: Record<string, string> = {
  'Bartender':      'bg-blue-500/20 text-blue-400',
  'Barback':        'bg-cyan-500/20 text-cyan-400',
  'Server':         'bg-green-500/20 text-green-400',
  'Security':       'bg-red-500/20 text-red-400',
  'Carder':         'bg-orange-500/20 text-orange-400',
  'Bar Manager':    'bg-purple-500/20 text-purple-400',
};

// Prime tier colors for UI
export const PRIME_TIER_COLORS: Record<PrimeTier, { bg: string; border: string; dot: string; label: string }> = {
  1: { bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500', label: 'Prime' },
  2: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500', label: 'High' },
  3: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500', label: 'Mid' },
  4: { bg: 'bg-white/5', border: 'border-white/10', dot: 'bg-gray-400', label: 'Std' },
};

// Employee definitions for mock data generation
export interface MockEmployeeDef {
  id: string;
  firstName: string;
  lastName: string;
  roles: string[];
  primaryRole: string;
  wage: number;
  targetHours: number;
  maxHours: number;
  performanceTier: 'top' | 'high' | 'mid' | 'low' | 'new';
  availability: Partial<Record<DayOfWeek, TimeWindow | null>>;
  preferredDays: DayOfWeek[];
  preferredShift: 'AM' | 'PM' | 'Late' | 'Any';
}

export const MOCK_EMPLOYEES: MockEmployeeDef[] = [
  // ============================================================
  // BARTENDERS (20) — fill speed wells, standard wells, on-call
  // ============================================================
  {
    id: 'EMP-001', firstName: 'Sofia', lastName: 'Martinez',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 16.00,
    targetHours: 35, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: null,
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '17:00' },
    },
    preferredDays: ['Friday', 'Saturday', 'Thursday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-002', firstName: 'Marcus', lastName: 'Rivera',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 15.00,
    targetHours: 32, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: null,
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-003', firstName: 'Jasmine', lastName: 'Chen',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 15.00,
    targetHours: 28, maxHours: 35, performanceTier: 'high',
    availability: {
      Monday: null,
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'Late',
  },
  {
    id: 'EMP-004', firstName: 'Jake', lastName: 'Patterson',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 12.00,
    targetHours: 25, maxHours: 35, performanceTier: 'new',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
    preferredShift: 'Any',
  },
  {
    id: 'EMP-015', firstName: 'Becca', lastName: 'Thompson',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 16.00,
    targetHours: 35, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-016', firstName: 'Drew', lastName: 'Collins',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 15.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: null,
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-017', firstName: 'Megan', lastName: 'Russo',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 14.00,
    targetHours: 28, maxHours: 35, performanceTier: 'high',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'Late',
  },
  {
    id: 'EMP-018', firstName: 'Cole', lastName: 'Jenkins',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 15.00,
    targetHours: 32, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'Late',
  },
  {
    id: 'EMP-019', firstName: 'Hailey', lastName: 'Nguyen',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 14.00,
    targetHours: 30, maxHours: 38, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '22:00' },
      Tuesday: { from: '11:00', to: '22:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: null,
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-020', firstName: 'Logan', lastName: 'Scott',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 13.00,
    targetHours: 25, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
    preferredShift: 'AM',
  },
  {
    id: 'EMP-021', firstName: 'Zoe', lastName: 'Henderson',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 14.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: null,
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-022', firstName: 'Nate', lastName: 'Fitzgerald',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 13.00,
    targetHours: 28, maxHours: 36, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-023', firstName: 'Kayla', lastName: 'Murphy',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 15.00,
    targetHours: 32, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: null,
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'Any',
  },
  {
    id: 'EMP-024', firstName: 'Trey', lastName: 'Adams',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 12.00,
    targetHours: 20, maxHours: 30, performanceTier: 'new',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
    preferredShift: 'AM',
  },
  {
    id: 'EMP-025', firstName: 'Maddie', lastName: 'Turner',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 14.00,
    targetHours: 30, maxHours: 38, performanceTier: 'mid',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: null,
      Sunday: null,
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'Late',
  },
  {
    id: 'EMP-026', firstName: 'Dylan', lastName: 'Morales',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 13.00,
    targetHours: 28, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-027', firstName: 'Lexi', lastName: 'Harper',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 12.00,
    targetHours: 22, maxHours: 30, performanceTier: 'new',
    availability: {
      Monday: { from: '11:00', to: '17:00' },
      Tuesday: { from: '11:00', to: '17:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Wednesday', 'Thursday'],
    preferredShift: 'AM',
  },
  {
    id: 'EMP-028', firstName: 'Caleb', lastName: 'Stewart',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 15.00,
    targetHours: 35, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: null,
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },

  // ============================================================
  // SENIOR BARTENDERS (5) — fill speed wells + standard wells
  // ============================================================
  {
    id: 'EMP-005', firstName: 'Tyler', lastName: 'Brooks',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 18.00,
    targetHours: 35, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-029', firstName: 'Jordan', lastName: 'Blake',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 20.00,
    targetHours: 38, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-030', firstName: 'Samantha', lastName: 'Reed',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 18.00,
    targetHours: 32, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: null,
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'Late',
  },
  {
    id: 'EMP-031', firstName: 'Matt', lastName: 'Donovan',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 17.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: null,
      Saturday: null,
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-032', firstName: 'Olivia', lastName: 'Price',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 19.00,
    targetHours: 35, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'Late',
  },

  // ============================================================
  // BARBACKS (8) — 5 barback positions across bars
  // ============================================================
  {
    id: 'EMP-006', firstName: 'Ryan', lastName: 'Okafor',
    roles: ['Barback'], primaryRole: 'Barback', wage: 12.00,
    targetHours: 30, maxHours: 40, performanceTier: 'mid',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-007', firstName: 'Ethan', lastName: 'Kim',
    roles: ['Barback'], primaryRole: 'Barback', wage: 11.00,
    targetHours: 25, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: null,
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '18:00', to: '02:00' },
      Saturday: { from: '18:00', to: '02:00' },
      Sunday: { from: '11:00', to: '20:00' },
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'Late',
  },
  {
    id: 'EMP-033', firstName: 'Devon', lastName: 'Marshall',
    roles: ['Barback'], primaryRole: 'Barback', wage: 12.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-034', firstName: 'Jalen', lastName: 'Cooper',
    roles: ['Barback'], primaryRole: 'Barback', wage: 11.00,
    targetHours: 25, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: null,
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
    preferredShift: 'Any',
  },
  {
    id: 'EMP-035', firstName: 'Isaac', lastName: 'Bell',
    roles: ['Barback'], primaryRole: 'Barback', wage: 10.50,
    targetHours: 20, maxHours: 30, performanceTier: 'new',
    availability: {
      Monday: { from: '11:00', to: '17:00' },
      Tuesday: { from: '11:00', to: '17:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Wednesday', 'Thursday'],
    preferredShift: 'AM',
  },
  {
    id: 'EMP-036', firstName: 'Mason', lastName: 'Perry',
    roles: ['Barback'], primaryRole: 'Barback', wage: 12.00,
    targetHours: 28, maxHours: 38, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'Late',
  },
  {
    id: 'EMP-037', firstName: 'Lucas', lastName: 'Ward',
    roles: ['Barback'], primaryRole: 'Barback', wage: 11.00,
    targetHours: 22, maxHours: 30, performanceTier: 'low',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: null,
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: null,
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Monday', 'Wednesday', 'Thursday'],
    preferredShift: 'Any',
  },
  {
    id: 'EMP-038', firstName: 'Brandon', lastName: 'Long',
    roles: ['Barback'], primaryRole: 'Barback', wage: 13.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: null,
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },

  // ============================================================
  // SERVERS (8) — 2 server positions (upstairs + downstairs)
  // ============================================================
  {
    id: 'EMP-008', firstName: 'Aisha', lastName: 'Williams',
    roles: ['Server'], primaryRole: 'Server', wage: 5.50,
    targetHours: 32, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '01:00' },
      Tuesday: { from: '11:00', to: '01:00' },
      Wednesday: { from: '11:00', to: '01:00' },
      Thursday: { from: '11:00', to: '01:00' },
      Friday: { from: '11:00', to: '01:00' },
      Saturday: null,
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-009', firstName: 'Tony', lastName: 'Garcia',
    roles: ['Server'], primaryRole: 'Server', wage: 5.50,
    targetHours: 28, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '23:00' },
      Tuesday: null,
      Wednesday: { from: '11:00', to: '01:00' },
      Thursday: { from: '11:00', to: '01:00' },
      Friday: { from: '11:00', to: '01:00' },
      Saturday: { from: '11:00', to: '01:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'Any',
  },
  {
    id: 'EMP-010', firstName: 'Katie', lastName: 'Brown',
    roles: ['Server'], primaryRole: 'Server', wage: 5.50,
    targetHours: 20, maxHours: 30, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '17:00' },
      Tuesday: { from: '11:00', to: '17:00' },
      Wednesday: { from: '11:00', to: '17:00' },
      Thursday: { from: '11:00', to: '17:00' },
      Friday: { from: '11:00', to: '17:00' },
      Saturday: { from: '11:00', to: '17:00' },
      Sunday: null,
    },
    preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
    preferredShift: 'AM',
  },
  {
    id: 'EMP-039', firstName: 'Paige', lastName: 'Ramirez',
    roles: ['Server'], primaryRole: 'Server', wage: 6.00,
    targetHours: 30, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: { from: '11:00', to: '01:00' },
      Tuesday: { from: '11:00', to: '01:00' },
      Wednesday: { from: '11:00', to: '01:00' },
      Thursday: { from: '11:00', to: '01:00' },
      Friday: { from: '11:00', to: '01:00' },
      Saturday: { from: '11:00', to: '01:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-040', firstName: 'Noah', lastName: 'Foster',
    roles: ['Server'], primaryRole: 'Server', wage: 5.50,
    targetHours: 25, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '11:00', to: '01:00' },
      Wednesday: { from: '11:00', to: '01:00' },
      Thursday: { from: '11:00', to: '01:00' },
      Friday: { from: '16:00', to: '01:00' },
      Saturday: { from: '16:00', to: '01:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-041', firstName: 'Emma', lastName: 'Sullivan',
    roles: ['Server'], primaryRole: 'Server', wage: 5.50,
    targetHours: 22, maxHours: 30, performanceTier: 'high',
    availability: {
      Monday: { from: '11:00', to: '22:00' },
      Tuesday: { from: '11:00', to: '22:00' },
      Wednesday: { from: '11:00', to: '22:00' },
      Thursday: null,
      Friday: { from: '11:00', to: '01:00' },
      Saturday: { from: '11:00', to: '01:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Monday', 'Wednesday', 'Friday'],
    preferredShift: 'AM',
  },
  {
    id: 'EMP-042', firstName: 'Grace', lastName: 'Kelley',
    roles: ['Server'], primaryRole: 'Server', wage: 5.50,
    targetHours: 20, maxHours: 28, performanceTier: 'new',
    availability: {
      Monday: { from: '11:00', to: '17:00' },
      Tuesday: { from: '11:00', to: '17:00' },
      Wednesday: null,
      Thursday: { from: '11:00', to: '01:00' },
      Friday: { from: '11:00', to: '01:00' },
      Saturday: null,
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Monday', 'Tuesday', 'Thursday'],
    preferredShift: 'AM',
  },
  {
    id: 'EMP-043', firstName: 'Liam', lastName: 'Hayes',
    roles: ['Server'], primaryRole: 'Server', wage: 5.50,
    targetHours: 28, maxHours: 36, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '01:00' },
      Tuesday: null,
      Wednesday: { from: '16:00', to: '01:00' },
      Thursday: { from: '16:00', to: '01:00' },
      Friday: { from: '16:00', to: '01:00' },
      Saturday: { from: '11:00', to: '01:00' },
      Sunday: null,
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },

  // ============================================================
  // SECURITY (17) — exit doors, fixed posts, roam, BOH
  // ============================================================
  {
    id: 'EMP-013', firstName: 'Darius', lastName: 'Washington',
    roles: ['Security'], primaryRole: 'Security', wage: 16.00,
    targetHours: 32, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-014', firstName: 'Chris', lastName: 'Patel',
    roles: ['Security'], primaryRole: 'Security', wage: 14.00,
    targetHours: 25, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-044', firstName: 'Marcus', lastName: 'Green',
    roles: ['Security'], primaryRole: 'Security', wage: 15.00,
    targetHours: 28, maxHours: 38, performanceTier: 'mid',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-045', firstName: 'Andre', lastName: 'Jackson',
    roles: ['Security'], primaryRole: 'Security', wage: 17.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-046', firstName: 'Terrence', lastName: 'Boyd',
    roles: ['Security'], primaryRole: 'Security', wage: 13.00,
    targetHours: 25, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-055', firstName: 'Malik', lastName: 'Robinson',
    roles: ['Security'], primaryRole: 'Security', wage: 15.00,
    targetHours: 32, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-056', firstName: 'Devon', lastName: 'Carter',
    roles: ['Security'], primaryRole: 'Security', wage: 14.00,
    targetHours: 28, maxHours: 38, performanceTier: 'mid',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Wednesday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-057', firstName: 'Jamal', lastName: 'Harris',
    roles: ['Security'], primaryRole: 'Security', wage: 16.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-058', firstName: 'Tyrone', lastName: 'Mitchell',
    roles: ['Security'], primaryRole: 'Security', wage: 13.00,
    targetHours: 25, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-059', firstName: 'Isaiah', lastName: 'Lewis',
    roles: ['Security'], primaryRole: 'Security', wage: 15.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-060', firstName: 'Carlos', lastName: 'Reyes',
    roles: ['Security'], primaryRole: 'Security', wage: 14.00,
    targetHours: 28, maxHours: 38, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-061', firstName: 'Rashad', lastName: 'King',
    roles: ['Security'], primaryRole: 'Security', wage: 16.00,
    targetHours: 32, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-062', firstName: 'Damien', lastName: 'Brooks',
    roles: ['Security'], primaryRole: 'Security', wage: 13.00,
    targetHours: 28, maxHours: 38, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-063', firstName: 'Kevin', lastName: 'Thompson',
    roles: ['Security'], primaryRole: 'Security', wage: 15.00,
    targetHours: 30, maxHours: 40, performanceTier: 'high',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Monday', 'Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-064', firstName: 'Marcus', lastName: 'Allen',
    roles: ['Security'], primaryRole: 'Security', wage: 14.00,
    targetHours: 28, maxHours: 38, performanceTier: 'mid',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-065', firstName: 'DeAndre', lastName: 'Williams',
    roles: ['Security'], primaryRole: 'Security', wage: 16.00,
    targetHours: 35, maxHours: 40, performanceTier: 'top',
    availability: {
      Monday: { from: '16:00', to: '02:00' },
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-066', firstName: 'Trevon', lastName: 'Scott',
    roles: ['Security'], primaryRole: 'Security', wage: 13.00,
    targetHours: 25, maxHours: 35, performanceTier: 'new',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },

  // ============================================================
  // CARDERS (8) — check IDs at entrances
  // ============================================================
  {
    id: 'EMP-051', firstName: 'Brianna', lastName: 'Taylor',
    roles: ['Carder'], primaryRole: 'Carder', wage: 12.00,
    targetHours: 22, maxHours: 30, performanceTier: 'high',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-052', firstName: 'Jaylen', lastName: 'Davis',
    roles: ['Carder'], primaryRole: 'Carder', wage: 11.00,
    targetHours: 20, maxHours: 28, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-053', firstName: 'Savannah', lastName: 'Moore',
    roles: ['Carder'], primaryRole: 'Carder', wage: 12.00,
    targetHours: 22, maxHours: 30, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-054', firstName: 'Tyler', lastName: 'Wright',
    roles: ['Carder'], primaryRole: 'Carder', wage: 10.50,
    targetHours: 18, maxHours: 25, performanceTier: 'new',
    availability: {
      Monday: null,
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-067', firstName: 'Ashley', lastName: 'Bennett',
    roles: ['Carder'], primaryRole: 'Carder', wage: 12.00,
    targetHours: 22, maxHours: 30, performanceTier: 'high',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-068', firstName: 'Cameron', lastName: 'Ross',
    roles: ['Carder'], primaryRole: 'Carder', wage: 11.00,
    targetHours: 20, maxHours: 28, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-069', firstName: 'Jordan', lastName: 'Powell',
    roles: ['Carder'], primaryRole: 'Carder', wage: 12.00,
    targetHours: 22, maxHours: 30, performanceTier: 'mid',
    availability: {
      Monday: null,
      Tuesday: { from: '16:00', to: '02:00' },
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-070', firstName: 'Riley', lastName: 'Coleman',
    roles: ['Carder'], primaryRole: 'Carder', wage: 10.50,
    targetHours: 18, maxHours: 25, performanceTier: 'new',
    availability: {
      Monday: null,
      Tuesday: null,
      Wednesday: { from: '16:00', to: '02:00' },
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '16:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },

  // ============================================================
  // BAR MANAGERS (4) — can fill Bartender wells
  // ============================================================
  {
    id: 'EMP-047', firstName: 'Kevin', lastName: 'Walsh',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 22.00,
    targetHours: 38, maxHours: 45, performanceTier: 'top',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'PM',
  },
  {
    id: 'EMP-048', firstName: 'Rachel', lastName: 'Ellis',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 21.00,
    targetHours: 36, maxHours: 44, performanceTier: 'top',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: null,
      Friday: { from: '11:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Friday', 'Saturday'],
    preferredShift: 'Any',
  },
  {
    id: 'EMP-049', firstName: 'Ian', lastName: 'Doyle',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 14.00,
    targetHours: 28, maxHours: 35, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '02:00' },
      Tuesday: { from: '11:00', to: '02:00' },
      Wednesday: null,
      Thursday: { from: '16:00', to: '02:00' },
      Friday: { from: '16:00', to: '02:00' },
      Saturday: { from: '11:00', to: '02:00' },
      Sunday: null,
    },
    preferredDays: ['Thursday', 'Friday', 'Saturday'],
    preferredShift: 'Late',
  },
  {
    id: 'EMP-050', firstName: 'Taylor', lastName: 'Quinn',
    roles: ['Bartender'], primaryRole: 'Bartender', wage: 13.00,
    targetHours: 25, maxHours: 32, performanceTier: 'mid',
    availability: {
      Monday: { from: '11:00', to: '22:00' },
      Tuesday: { from: '11:00', to: '22:00' },
      Wednesday: { from: '11:00', to: '02:00' },
      Thursday: { from: '11:00', to: '02:00' },
      Friday: { from: '11:00', to: '02:00' },
      Saturday: null,
      Sunday: { from: '11:00', to: '22:00' },
    },
    preferredDays: ['Wednesday', 'Thursday', 'Friday'],
    preferredShift: 'PM',
  },

];
