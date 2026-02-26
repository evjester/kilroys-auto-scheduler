/**
 * CSV Ingestion — parses Toast + 7shifts export files into typed objects
 */

import Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ToastSalesSummary,
  ToastEmployeeTips,
  ToastLaborReport,
  ToastChecksDetail,
  SevenShiftsEmployee,
  SevenShiftsAvailability,
  SevenShiftsTimeOff,
  SevenShiftsShift,
  DayOfWeek,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'mock-data');

function parseCSV<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(content, { header: true, skipEmptyLines: true });
  return result.data as T[];
}

function num(v: string | undefined): number {
  return parseFloat(v || '0') || 0;
}

// ============================================================
// Toast Parsers
// ============================================================

export function ingestSalesSummary(): ToastSalesSummary[] {
  const raw = parseCSV<Record<string, string>>(path.join(DATA_DIR, 'toast', 'sales-summary.csv'));
  return raw.map(r => ({
    businessDate: r['Business Date'],
    revenueCenter: r['Revenue Center'],
    mealPeriod: r['Meal Period'],
    netSales: num(r['Net Sales']),
    grossSales: num(r['Gross Sales']),
    discounts: num(r['Discounts']),
    voids: num(r['Voids']),
    comps: num(r['Comps']),
    tax: num(r['Tax']),
    tips: num(r['Tips']),
    checkCount: num(r['Check Count']),
    guestCount: num(r['Guest Count']),
    avgCheck: num(r['Avg Check']),
  }));
}

export function ingestEmployeeTips(): ToastEmployeeTips[] {
  const raw = parseCSV<Record<string, string>>(path.join(DATA_DIR, 'toast', 'employee-tips.csv'));
  return raw.map(r => ({
    businessDate: r['Business Date'],
    employeeId: r['Employee ID'],
    employeeName: r['Employee Name'],
    jobTitle: r['Job Title'],
    revenueCenter: r['Revenue Center'],
    shift: r['Shift'],
    clockIn: r['Clock In'],
    clockOut: r['Clock Out'],
    hoursWorked: num(r['Hours Worked']),
    cashTips: num(r['Cash Tips']),
    ccTips: num(r['CC Tips']),
    totalTips: num(r['Total Tips']),
    tipOutGiven: num(r['Tip Out Given']),
    tipOutReceived: num(r['Tip Out Received']),
    netTips: num(r['Net Tips']),
    tipsPerHour: num(r['Tips Per Hour']),
    checksServed: num(r['Checks Served']),
    netSales: num(r['Net Sales']),
    tipPct: num(r['Tip Pct']),
  }));
}

export function ingestLaborReport(): ToastLaborReport[] {
  const raw = parseCSV<Record<string, string>>(path.join(DATA_DIR, 'toast', 'labor-report.csv'));
  return raw.map(r => ({
    businessDate: r['Business Date'],
    employeeId: r['Employee ID'],
    employeeName: r['Employee Name'],
    jobTitle: r['Job Title'],
    payRate: num(r['Pay Rate']),
    scheduledIn: r['Scheduled In'],
    scheduledOut: r['Scheduled Out'],
    scheduledHours: num(r['Scheduled Hours']),
    clockIn: r['Clock In'],
    clockOut: r['Clock Out'],
    regularHours: num(r['Regular Hours']),
    otHours: num(r['OT Hours']),
    totalHours: num(r['Total Hours']),
    totalPay: num(r['Total Pay']),
  }));
}

export function ingestChecksDetail(): ToastChecksDetail[] {
  const raw = parseCSV<Record<string, string>>(path.join(DATA_DIR, 'toast', 'checks-detail.csv'));
  return raw.map(r => ({
    checkNum: num(r['Check Num']),
    opened: r['Opened'],
    closed: r['Closed'],
    revenueCenter: r['Revenue Center'],
    server: r['Server'],
    item: r['Item'],
    menuGroup: r['Menu Group'],
    qty: num(r['Qty']),
    itemPrice: num(r['Item Price']),
    netAmount: num(r['Net Amount']),
    tax: num(r['Tax']),
    tip: num(r['Tip']),
    paymentMethod: r['Payment Method'],
  }));
}

// ============================================================
// 7shifts Parsers
// ============================================================

export function ingestEmployees(): SevenShiftsEmployee[] {
  const raw = parseCSV<Record<string, string>>(path.join(DATA_DIR, '7shifts', 'employees.csv'));
  return raw.map(r => ({
    employeeId: r['Employee ID'],
    firstName: r['First Name'],
    lastName: r['Last Name'],
    email: r['Email'],
    phone: r['Phone'],
    wage: num(r['Wage']),
    departments: r['Departments'],
    roles: r['Roles'],
  }));
}

export function ingestAvailability(): SevenShiftsAvailability[] {
  const raw = parseCSV<Record<string, string>>(path.join(DATA_DIR, '7shifts', 'availability.csv'));
  return raw.map(r => ({
    employeeId: r['Employee ID'],
    firstName: r['First Name'],
    lastName: r['Last Name'],
    role: r['Role'],
    day: r['Day'] as DayOfWeek,
    availability: r['Availability'] as SevenShiftsAvailability['availability'],
    availableFrom: r['Available From'],
    availableTo: r['Available To'],
  }));
}

export function ingestTimeOff(): SevenShiftsTimeOff[] {
  const raw = parseCSV<Record<string, string>>(path.join(DATA_DIR, '7shifts', 'time-off-requests.csv'));
  return raw.map(r => ({
    requestId: r['Request ID'],
    employeeId: r['Employee ID'],
    firstName: r['First Name'],
    lastName: r['Last Name'],
    fromDate: r['From Date'],
    toDate: r['To Date'],
    category: r['Category'],
    status: r['Status'] as SevenShiftsTimeOff['status'],
    comments: r['Comments'],
  }));
}

export function ingestShifts(): SevenShiftsShift[] {
  const raw = parseCSV<Record<string, string>>(path.join(DATA_DIR, '7shifts', 'shifts.csv'));
  return raw.map(r => ({
    shiftId: r['Shift ID'],
    employeeId: r['Employee ID'],
    firstName: r['First Name'],
    lastName: r['Last Name'],
    department: r['Department'],
    role: r['Role'],
    shiftDate: r['Shift Date'],
    start: r['Start'],
    end: r['End'],
    hours: num(r['Hours']),
    status: r['Status'],
  }));
}

/** Ingest all data at once */
export function ingestAllData() {
  return {
    salesSummary: ingestSalesSummary(),
    employeeTips: ingestEmployeeTips(),
    laborReport: ingestLaborReport(),
    checksDetail: ingestChecksDetail(),
    employees: ingestEmployees(),
    availability: ingestAvailability(),
    timeOff: ingestTimeOff(),
    shifts: ingestShifts(),
  };
}
