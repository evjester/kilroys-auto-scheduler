// ============================================================
// Toast POS Export Types
// ============================================================

export interface ToastSalesSummary {
  businessDate: string;
  revenueCenter: string;
  mealPeriod: string;
  netSales: number;
  grossSales: number;
  discounts: number;
  voids: number;
  comps: number;
  tax: number;
  tips: number;
  checkCount: number;
  guestCount: number;
  avgCheck: number;
}

export interface ToastEmployeeTips {
  businessDate: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  revenueCenter: string;
  shift: string;
  clockIn: string;
  clockOut: string;
  hoursWorked: number;
  cashTips: number;
  ccTips: number;
  totalTips: number;
  tipOutGiven: number;
  tipOutReceived: number;
  netTips: number;
  tipsPerHour: number;
  checksServed: number;
  netSales: number;
  tipPct: number;
}

export interface ToastLaborReport {
  businessDate: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  payRate: number;
  scheduledIn: string;
  scheduledOut: string;
  scheduledHours: number;
  clockIn: string;
  clockOut: string;
  regularHours: number;
  otHours: number;
  totalHours: number;
  totalPay: number;
}

export interface ToastChecksDetail {
  checkNum: number;
  opened: string;
  closed: string;
  revenueCenter: string;
  server: string;
  item: string;
  menuGroup: string;
  qty: number;
  itemPrice: number;
  netAmount: number;
  tax: number;
  tip: number;
  paymentMethod: string;
}

// ============================================================
// 7shifts Export Types
// ============================================================

export interface SevenShiftsEmployee {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  wage: number;
  departments: string;
  roles: string;
}

export interface SevenShiftsAvailability {
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string;
  day: DayOfWeek;
  availability: 'All Day Available' | 'Available' | 'All Day Unavailable' | 'Unavailable';
  availableFrom: string;
  availableTo: string;
}

export interface SevenShiftsTimeOff {
  requestId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fromDate: string;
  toDate: string;
  category: string;
  status: 'Approved' | 'Pending' | 'Declined';
  comments: string;
}

export interface SevenShiftsShift {
  shiftId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  shiftDate: string;
  start: string;
  end: string;
  hours: number;
  status: string;
}

// ============================================================
// Internal Computed Types
// ============================================================

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface TimeWindow {
  from: string; // HH:mm
  to: string;   // HH:mm (can be next day, e.g., "02:00")
}

export interface EmployeeProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  roles: string[];
  primaryRole: string;
  department: string;
  wage: number;

  // Performance metrics (from Toast)
  performanceScore: number;   // 0-100 composite
  avgSalesPerHour: number;
  avgTipsPerHour: number;
  avgTipPct: number;
  reliabilityScore: number;   // 0-100

  // Scheduling constraints
  maxWeeklyHours: number;
  targetWeeklyHours: number;
  availability: Partial<Record<DayOfWeek, TimeWindow | null>>;
  timeOff: { from: string; to: string }[];

  // Preferences
  preferences: {
    preferredDays: DayOfWeek[];
    preferredShiftType: 'AM' | 'PM' | 'Late' | 'Any';
  };

  // Fairness tracking
  recentPrimeShiftCount: number; // last 4 weeks

  // Runtime (during scheduling)
  currentWeekHours: number;
  assignedShifts: string[]; // shift IDs assigned this run
}

export type PrimeTier = 1 | 2 | 3 | 4;

export type ShiftType = 'AM' | 'PM' | 'Late';

export interface ShiftSlot {
  id: string;
  dayOfWeek: DayOfWeek;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  duration: number;      // hours
  requiredRole: string;
  department: string;
  primeTier: PrimeTier;
  shiftType: ShiftType;
}

export interface ReasonFactor {
  name: string;
  value: number;       // raw score 0-100
  weight: number;      // 0.0-1.0
  weighted: number;    // value * weight
  explanation: string;
}

export interface Assignment {
  shiftSlot: ShiftSlot;
  employee: {
    id: string;
    name: string;
    role: string;
    performanceScore: number;
  };
  totalScore: number;
  factors: ReasonFactor[];
  summary: string;
  alternativesCount: number;
  runnerUp?: {
    name: string;
    score: number;
    gapReason: string;
  };
}

export interface ScheduleResult {
  weekStart: string;
  weekEnd: string;
  assignments: Assignment[];
  unfilledShifts: ShiftSlot[];
  warnings: string[];
  stats: {
    totalShifts: number;
    filledShifts: number;
    fillRate: number;
    avgScore: number;
    primeShiftsFilled: number;
    totalPrimeShifts: number;
  };
}

export interface WhatIfScenario {
  type: 'callout' | 'availability_change';
  employeeId: string;
  date?: string;          // for callout
  day?: DayOfWeek;        // for availability change
  newAvailability?: TimeWindow | null;
}

export interface WhatIfResult {
  original: ScheduleResult;
  modified: ScheduleResult;
  changes: {
    shiftId: string;
    shiftLabel: string;
    previousEmployee: string;
    newEmployee: string;
    reason: string;
  }[];
}

// ============================================================
// Lineup Types
// ============================================================

export type PositionType = 'speed' | 'standard' | 'barback' | 'on_call' | 'server' | 'carder' | 'exit_door' | 'fixed_post' | 'roam' | 'boh';

export interface WellPosition {
  id: string;           // e.g. "old-bar-wu"
  label: string;        // e.g. "WU"
  type: PositionType;
  speedRank?: number;   // 1 = top speed well (for auto-fill ordering)
}

export interface BarArea {
  id: string;           // e.g. "old-bar"
  name: string;         // e.g. "OLD BAR"
  positions: WellPosition[];
}

export interface ShiftTemplate {
  id: string;        // 'morning', 'happy-hour', 'night'
  label: string;     // 'Morning', 'Happy Hour', 'Night'
  start: string;     // '11:00' (HH:mm)
  end: string;       // '16:00' (HH:mm)
}

export type ShiftPeriod = 'morning' | 'happy-hour' | 'night';

export interface AssignedShift {
  templateId: string | null;  // null = custom hours
  start: string;              // '16:00'
  end: string;                // '02:00'
}

export interface SidebarFilters {
  available: boolean;
  topPerformers: boolean;
  managementPreferred: boolean;
  unavailable: boolean;
}

export interface LineupAssignment {
  positionId: string;
  employeeId: string | null;
  employeeName: string;
  performanceScore: number;
  role: string;
  customHours?: { start: string; end: string };  // only set if manager overrides shift defaults
  isOnCall: boolean;
  isPinned?: boolean;
  isPreferredWell?: boolean;
  note?: string;
}

export interface ShiftLineup {
  date: string;
  dayOfWeek: DayOfWeek;
  shiftPeriod: ShiftPeriod;
  shiftHours: { start: string; end: string };
  areas: {
    areaId: string;
    assignments: LineupAssignment[];
  }[];
  unassigned: {
    employeeId: string;
    employeeName: string;
    performanceScore: number;
    role: string;
  }[];
}

export interface DailyLineup {
  date: string;
  dayOfWeek: DayOfWeek;
  operatingHours: { open: string; close: string };
  shifts: ShiftLineup[];
  securityShifts?: ShiftLineup[];
}

export interface WeeklyLineups {
  weekStart: string;
  lineups: DailyLineup[];
}

// ============================================================
// Week Config Types
// ============================================================

export type StaffingLevel = 'light' | 'normal' | 'heavy';

export interface DayConfig {
  open: boolean;
  disabledShifts: ShiftPeriod[];
  closedBars: Record<ShiftPeriod, string[]>;
  staffingLevel: StaffingLevel;
  morningStartOverride?: string;
}

export interface PinnedPlacement {
  dayOfWeek: DayOfWeek;
  shiftPeriod: ShiftPeriod;
  positionId: string;
  employeeId: string;
  employeeName: string;
  performanceScore: number;
  role: string;
}

export interface WeekConfig {
  templateId: string;
  days: Record<DayOfWeek, DayConfig>;
  pinnedPlacements: PinnedPlacement[];
  shiftTemplates: ShiftTemplate[];
}

// ============================================================
// Generation Config Types (Generate Panel)
// ============================================================

/** Staffing for a single bar area within a shift */
export interface BarStaffing {
  bartenders: number;  // full-shift bartenders at this bar
  barbacks: number;    // barbacks at this bar
  onCalls: number;     // on-call bartenders at this bar (0-2)
  halves: number;      // half-shift bartenders at this bar
}

/** Per-shift staffing config — per-bar granularity */
export interface ShiftStaffing {
  bars: Record<string, BarStaffing>;  // keyed by bar area id (old-bar, new-bar, etc.)
  servers: { downstairs: number; upstairs: number };
  doormen: number;  // legacy — kept for backward compat, unused in new code
}

/** Security staffing for a single shift */
export interface SecurityStaffing {
  carders: number;
  exitDoors: number;
  fixedPosts: number;
  roam: Record<string, number>;  // keyed by security roam area id
  boh: { dish: number; expo: number };
}

/** Full config for a single shift within a day */
export interface ShiftConfig {
  enabled: boolean;
  staffing: ShiftStaffing;
  securityStaffing: SecurityStaffing;
  closedBars: string[];
  startTime: string;
  endTime: string;
}

/** Full config for a single day */
export interface GenerateDayConfig {
  open: boolean;
  shifts: Record<ShiftPeriod, ShiftConfig>;
}

/** What the Generate Panel passes to the API */
export interface GenerationConfig {
  mode: 'day' | 'week';
  targetDay?: DayOfWeek;
  days: Record<DayOfWeek, GenerateDayConfig>;
}

/** A saved template (week or single day) */
export interface SavedTemplate {
  id: string;
  name: string;
  type: 'week' | 'day';
  lineupType?: 'bartender' | 'security';
  days?: Record<DayOfWeek, GenerateDayConfig>;
  dayConfig?: GenerateDayConfig;
}

// CSV header mappings for ingestion
export const TOAST_SALES_HEADERS = [
  'Business Date', 'Revenue Center', 'Meal Period', 'Net Sales', 'Gross Sales',
  'Discounts', 'Voids', 'Comps', 'Tax', 'Tips', 'Check Count', 'Guest Count', 'Avg Check'
] as const;

export const TOAST_TIPS_HEADERS = [
  'Business Date', 'Employee ID', 'Employee Name', 'Job Title', 'Revenue Center',
  'Shift', 'Clock In', 'Clock Out', 'Hours Worked', 'Cash Tips', 'CC Tips',
  'Total Tips', 'Tip Out Given', 'Tip Out Received', 'Net Tips', 'Tips Per Hour',
  'Checks Served', 'Net Sales', 'Tip Pct'
] as const;

export const TOAST_LABOR_HEADERS = [
  'Business Date', 'Employee ID', 'Employee Name', 'Job Title', 'Pay Rate',
  'Scheduled In', 'Scheduled Out', 'Scheduled Hours', 'Clock In', 'Clock Out',
  'Regular Hours', 'OT Hours', 'Total Hours', 'Total Pay'
] as const;

export const TOAST_CHECKS_HEADERS = [
  'Check Num', 'Opened', 'Closed', 'Revenue Center', 'Server', 'Item',
  'Menu Group', 'Qty', 'Item Price', 'Net Amount', 'Tax', 'Tip', 'Payment Method'
] as const;
