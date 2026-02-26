/**
 * Mock Data Generator
 * Generates realistic Toast POS + 7shifts export CSVs for Kilroy's on Kirkwood
 */

import * as fs from 'fs';
import * as path from 'path';
import { MOCK_EMPLOYEES, DAYS, SHIFT_DEFINITIONS, ROLE_CONFIG, DAY_SHIFT_TYPES, getStaffingReqs, getPrimeTier } from '../src/lib/mock-config';
import type { DayOfWeek } from '../src/lib/types';

// ============================================================
// Seeded random for deterministic output
// ============================================================
let seed = 42;
function random(): number {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}
function randBetween(min: number, max: number): number {
  return min + random() * (max - min);
}
function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

const outDir = path.join(__dirname, '..', 'mock-data');

// ============================================================
// Date helpers
// ============================================================
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getDayName(d: Date): DayOfWeek {
  const names: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[d.getDay()];
}

// Generate 4 weeks of dates ending this week
const today = new Date('2026-02-20');
const fourWeeksAgo = addDays(today, -28);
const allDates: Date[] = [];
for (let i = 0; i < 28; i++) {
  allDates.push(addDays(fourWeeksAgo, i));
}

// ============================================================
// Performance tiers — base metrics
// ============================================================
const perfTiers = {
  top:  { salesPerHr: [180, 240], tipsPerHr: [35, 50], tipPct: [20, 24], reliability: [95, 100] },
  high: { salesPerHr: [140, 190], tipsPerHr: [25, 38], tipPct: [18, 22], reliability: [88, 96] },
  mid:  { salesPerHr: [100, 150], tipsPerHr: [18, 28], tipPct: [16, 20], reliability: [80, 92] },
  low:  { salesPerHr: [70, 110],  tipsPerHr: [12, 20], tipPct: [14, 18], reliability: [70, 85] },
  new:  { salesPerHr: [60, 100],  tipsPerHr: [10, 18], tipPct: [13, 17], reliability: [75, 88] },
};

// Revenue multipliers by day
const dayRevMultiplier: Record<DayOfWeek, number> = {
  Monday: 0.5, Tuesday: 0.55, Wednesday: 0.7, Thursday: 1.0,
  Friday: 1.8, Saturday: 2.0, Sunday: 0.8,
};

// ============================================================
// 1. Generate 7shifts Employees CSV
// ============================================================
function genEmployeesCSV(): string {
  const rows = MOCK_EMPLOYEES.map(e => {
    const dept = ROLE_CONFIG[e.primaryRole]?.department || 'Bar';
    return [
      e.id, e.firstName, e.lastName,
      `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}@email.com`,
      `+1${randInt(200, 999)}${randInt(100, 999)}${randInt(1000, 9999)}`,
      e.wage.toFixed(2),
      dept,
      e.roles.join(';'),
    ].join(',');
  });
  return ['Employee ID,First Name,Last Name,Email,Phone,Wage,Departments,Roles', ...rows].join('\n');
}

// ============================================================
// 2. Generate 7shifts Availability CSV
// ============================================================
function genAvailabilityCSV(): string {
  const rows: string[] = [];
  for (const emp of MOCK_EMPLOYEES) {
    for (const day of DAYS) {
      const avail = emp.availability[day];
      if (avail === undefined) {
        // Not specified — default to unavailable
        rows.push([emp.id, emp.firstName, emp.lastName, emp.primaryRole, day, 'All Day Unavailable', '', ''].join(','));
      } else if (avail === null) {
        rows.push([emp.id, emp.firstName, emp.lastName, emp.primaryRole, day, 'All Day Unavailable', '', ''].join(','));
      } else {
        rows.push([emp.id, emp.firstName, emp.lastName, emp.primaryRole, day, 'Available', avail.from, avail.to].join(','));
      }
    }
  }
  return ['Employee ID,First Name,Last Name,Role,Day,Availability,Available From,Available To', ...rows].join('\n');
}

// ============================================================
// 3. Generate 7shifts Time-Off Requests CSV
// ============================================================
function genTimeOffCSV(): string {
  // A few realistic time-off requests for the upcoming schedule week
  const requests = [
    { id: 'TO-001', empId: 'EMP-002', fn: 'Marcus', ln: 'Rivera', from: '2026-02-27', to: '2026-02-27', cat: 'Personal', status: 'Approved', comment: 'Dentist appointment' },
    { id: 'TO-002', empId: 'EMP-008', fn: 'Aisha', ln: 'Williams', from: '2026-03-06', to: '2026-03-08', cat: 'Vacation', status: 'Approved', comment: 'Weekend trip' },
    { id: 'TO-003', empId: 'EMP-013', fn: 'Darius', ln: 'Washington', from: '2026-02-28', to: '2026-02-28', cat: 'Personal', status: 'Approved', comment: 'Family event' },
    { id: 'TO-004', empId: 'EMP-010', fn: 'Katie', ln: 'Brown', from: '2026-03-03', to: '2026-03-03', cat: 'Sick', status: 'Pending', comment: '' },
  ];

  const rows = requests.map(r =>
    [r.id, r.empId, r.fn, r.ln, r.from, r.to, r.cat, r.status, r.comment].join(',')
  );
  return ['Request ID,Employee ID,First Name,Last Name,From Date,To Date,Category,Status,Comments', ...rows].join('\n');
}

// ============================================================
// 4. Generate 7shifts Historical Shifts CSV
// ============================================================
function genShiftsCSV(): string {
  const rows: string[] = [];
  let shiftId = 80001;

  for (const date of allDates) {
    const dayName = getDayName(date);
    const shiftTypes = DAY_SHIFT_TYPES[dayName];

    for (const shiftType of shiftTypes) {
      const reqs = getStaffingReqs(dayName, shiftType);
      const shiftDef = SHIFT_DEFINITIONS[shiftType];

      for (const req of reqs) {
        // Find eligible employees for this role
        const eligible = MOCK_EMPLOYEES.filter(e =>
          e.roles.includes(req.role) && e.availability[dayName] !== null && e.availability[dayName] !== undefined
        );

        for (let c = 0; c < req.count; c++) {
          const emp = eligible[c % eligible.length];
          if (!emp) continue;

          const dept = ROLE_CONFIG[req.role]?.department || 'Bar';
          const hours = ((shiftDef.duration) - (random() > 0.7 ? 0.5 : 0)).toFixed(1);

          rows.push([
            `SH-${shiftId++}`,
            emp.id,
            emp.firstName,
            emp.lastName,
            dept,
            req.role,
            formatDate(date),
            shiftDef.start,
            shiftDef.end,
            hours,
            'Published',
          ].join(','));
        }
      }
    }
  }

  return ['Shift ID,Employee ID,First Name,Last Name,Department,Role,Shift Date,Start,End,Hours,Status', ...rows].join('\n');
}

// ============================================================
// 5. Generate Toast Sales Summary CSV
// ============================================================
function genSalesSummaryCSV(): string {
  const rows: string[] = [];
  const mealPeriods = ['Lunch', 'Dinner', 'Late Night'];
  const revCenters = ['Bar', 'Dining Room'];

  for (const date of allDates) {
    const dayName = getDayName(date);
    const mult = dayRevMultiplier[dayName];

    for (const rc of revCenters) {
      const rcMult = rc === 'Bar' ? 1.0 : 0.6;
      for (const mp of mealPeriods) {
        if (mp === 'Late Night' && !['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(dayName)) continue;

        const mpMult = mp === 'Lunch' ? 0.4 : mp === 'Dinner' ? 1.0 : 0.7;
        const baseSales = 2500 * mult * rcMult * mpMult * randBetween(0.85, 1.15);
        const netSales = Math.round(baseSales * 100) / 100;
        const grossSales = Math.round(netSales * randBetween(1.04, 1.08) * 100) / 100;
        const discounts = Math.round((grossSales - netSales) * randBetween(0.3, 0.5) * 100) / 100;
        const voids = Math.round((grossSales - netSales) * randBetween(0.1, 0.3) * 100) / 100;
        const comps = Math.round((grossSales - netSales - discounts - voids) * 100) / 100;
        const tax = Math.round(netSales * 0.07 * 100) / 100;
        const tips = Math.round(netSales * randBetween(0.18, 0.23) * 100) / 100;
        const checkCount = Math.round(netSales / randBetween(35, 55));
        const guestCount = Math.round(checkCount * randBetween(1.3, 2.0));
        const avgCheck = Math.round(netSales / checkCount * 100) / 100;

        rows.push([
          formatDate(date), rc, mp,
          netSales.toFixed(2), grossSales.toFixed(2), discounts.toFixed(2),
          voids.toFixed(2), comps.toFixed(2), tax.toFixed(2), tips.toFixed(2),
          checkCount, guestCount, avgCheck.toFixed(2),
        ].join(','));
      }
    }
  }

  return ['Business Date,Revenue Center,Meal Period,Net Sales,Gross Sales,Discounts,Voids,Comps,Tax,Tips,Check Count,Guest Count,Avg Check', ...rows].join('\n');
}

// ============================================================
// 6. Generate Toast Employee Tips CSV
// ============================================================
function genEmployeeTipsCSV(): string {
  const rows: string[] = [];

  for (const date of allDates) {
    const dayName = getDayName(date);
    const mult = dayRevMultiplier[dayName];
    const shiftTypes = DAY_SHIFT_TYPES[dayName];

    for (const shiftType of shiftTypes) {
      const reqs = getStaffingReqs(dayName, shiftType);
      const shiftDef = SHIFT_DEFINITIONS[shiftType];
      const shiftLabel = shiftType === 'AM' ? 'AM' : shiftType === 'PM' ? 'PM' : 'Late';

      for (const req of reqs) {
        if (!ROLE_CONFIG[req.role]?.tipped) continue;

        const eligible = MOCK_EMPLOYEES.filter(e =>
          e.roles.includes(req.role) && e.availability[dayName] !== null && e.availability[dayName] !== undefined
        );

        for (let c = 0; c < Math.min(req.count, eligible.length); c++) {
          const emp = eligible[c % eligible.length];
          const tier = perfTiers[emp.performanceTier];
          const hoursWorked = shiftDef.duration + randBetween(-0.5, 0.5);
          const salesPerHr = randBetween(tier.salesPerHr[0], tier.salesPerHr[1]) * mult;
          const netSales = Math.round(salesPerHr * hoursWorked * 100) / 100;
          const tipPct = randBetween(tier.tipPct[0], tier.tipPct[1]);
          const totalTips = Math.round(netSales * tipPct / 100 * 100) / 100;
          const cashTips = Math.round(totalTips * randBetween(0.15, 0.3) * 100) / 100;
          const ccTips = Math.round((totalTips - cashTips) * 100) / 100;
          const tipOut = req.role === 'Bartender' || req.role === 'Lead Bartender'
            ? Math.round(totalTips * 0.15 * 100) / 100
            : 0;
          const tipOutReceived = req.role === 'Barback' ? Math.round(randBetween(80, 150) * mult * 100) / 100 : 0;
          const netTips = Math.round((totalTips - tipOut + tipOutReceived) * 100) / 100;
          const tipsPerHour = Math.round(netTips / hoursWorked * 100) / 100;
          const checksServed = Math.round(netSales / randBetween(30, 55));

          rows.push([
            formatDate(date), emp.id, `${emp.firstName} ${emp.lastName}`,
            emp.primaryRole, 'Bar', shiftLabel,
            shiftDef.start, shiftDef.end,
            hoursWorked.toFixed(1),
            cashTips.toFixed(2), ccTips.toFixed(2), totalTips.toFixed(2),
            tipOut.toFixed(2), tipOutReceived.toFixed(2), netTips.toFixed(2),
            tipsPerHour.toFixed(2), checksServed, netSales.toFixed(2),
            tipPct.toFixed(1),
          ].join(','));
        }
      }
    }
  }

  return ['Business Date,Employee ID,Employee Name,Job Title,Revenue Center,Shift,Clock In,Clock Out,Hours Worked,Cash Tips,CC Tips,Total Tips,Tip Out Given,Tip Out Received,Net Tips,Tips Per Hour,Checks Served,Net Sales,Tip Pct', ...rows].join('\n');
}

// ============================================================
// 7. Generate Toast Labor Report CSV
// ============================================================
function genLaborReportCSV(): string {
  const rows: string[] = [];

  for (const date of allDates) {
    const dayName = getDayName(date);
    const shiftTypes = DAY_SHIFT_TYPES[dayName];

    for (const shiftType of shiftTypes) {
      const reqs = getStaffingReqs(dayName, shiftType);
      const shiftDef = SHIFT_DEFINITIONS[shiftType];

      for (const req of reqs) {
        const eligible = MOCK_EMPLOYEES.filter(e =>
          e.roles.includes(req.role) && e.availability[dayName] !== null && e.availability[dayName] !== undefined
        );

        for (let c = 0; c < Math.min(req.count, eligible.length); c++) {
          const emp = eligible[c % eligible.length];
          const scheduledHours = shiftDef.duration;
          // Slight variance in actual clock-in/out
          const tier = perfTiers[emp.performanceTier];
          const reliabilityFactor = randBetween(tier.reliability[0], tier.reliability[1]) / 100;
          const actualVariance = random() > reliabilityFactor ? randBetween(-0.5, 0.8) : randBetween(-0.1, 0.2);
          const totalHours = Math.max(scheduledHours + actualVariance, scheduledHours - 1);
          const regularHours = Math.min(totalHours, 8);
          const otHours = Math.max(totalHours - 8, 0);
          const totalPay = regularHours * emp.wage + otHours * emp.wage * 1.5;

          // Slight clock variance
          const [sh, sm] = shiftDef.start.split(':').map(Number);
          const clockInVar = Math.round(randBetween(-8, 5));
          const clockInMin = sh * 60 + sm + clockInVar;
          const clockIn = `${Math.floor(clockInMin / 60).toString().padStart(2, '0')}:${(clockInMin % 60).toString().padStart(2, '0')}`;

          const [eh, em] = shiftDef.end.split(':').map(Number);
          const clockOutVar = Math.round(randBetween(-5, 15));
          const clockOutMin = eh * 60 + em + clockOutVar;
          const clockOut = `${Math.floor(((clockOutMin % 1440) + 1440) % 1440 / 60).toString().padStart(2, '0')}:${(((clockOutMin % 1440) + 1440) % 1440 % 60).toString().padStart(2, '0')}`;

          rows.push([
            formatDate(date), emp.id, `${emp.firstName} ${emp.lastName}`,
            emp.primaryRole, emp.wage.toFixed(2),
            shiftDef.start, shiftDef.end, scheduledHours.toFixed(1),
            clockIn, clockOut,
            regularHours.toFixed(1), otHours.toFixed(1), totalHours.toFixed(1),
            totalPay.toFixed(2),
          ].join(','));
        }
      }
    }
  }

  return ['Business Date,Employee ID,Employee Name,Job Title,Pay Rate,Scheduled In,Scheduled Out,Scheduled Hours,Clock In,Clock Out,Regular Hours,OT Hours,Total Hours,Total Pay', ...rows].join('\n');
}

// ============================================================
// 8. Generate Toast Checks Detail CSV
// ============================================================
function genChecksDetailCSV(): string {
  const rows: string[] = [];
  let checkNum = 100001;

  const menuItems = [
    { item: 'Old Fashioned', group: 'Cocktails', price: 14 },
    { item: 'Margarita', group: 'Cocktails', price: 13 },
    { item: 'Espresso Martini', group: 'Cocktails', price: 15 },
    { item: 'Moscow Mule', group: 'Cocktails', price: 12 },
    { item: 'Long Island', group: 'Cocktails', price: 14 },
    { item: 'Vodka Soda', group: 'Well Drinks', price: 9 },
    { item: 'Rum & Coke', group: 'Well Drinks', price: 9 },
    { item: 'Gin & Tonic', group: 'Well Drinks', price: 9 },
    { item: 'IPA Draft', group: 'Beer', price: 8 },
    { item: 'Bud Light', group: 'Beer', price: 6 },
    { item: 'Guinness Draft', group: 'Beer', price: 8.5 },
    { item: 'White Claw', group: 'Beer', price: 7 },
    { item: 'House Red Wine', group: 'Wine', price: 12 },
    { item: 'Prosecco', group: 'Wine', price: 11 },
    { item: 'Shot - Jameson', group: 'Spirits', price: 8 },
    { item: 'Shot - Fireball', group: 'Spirits', price: 7 },
    { item: 'Shot - Tequila', group: 'Spirits', price: 9 },
    { item: 'Wings Basket', group: 'Food', price: 15 },
    { item: 'Loaded Nachos', group: 'Food', price: 14 },
    { item: 'Burger', group: 'Food', price: 16 },
    { item: 'Fish Tacos', group: 'Food', price: 15 },
    { item: 'Mozzarella Sticks', group: 'Food', price: 11 },
    { item: 'Pretzel Bites', group: 'Food', price: 12 },
  ];

  const payMethods = ['Visa', 'Mastercard', 'Amex', 'Cash', 'Discover'];

  // Only generate checks for a subset of dates to keep file size reasonable
  const sampleDates = allDates.filter((_, i) => i % 3 === 0); // every 3rd day

  for (const date of sampleDates) {
    const dayName = getDayName(date);
    const mult = dayRevMultiplier[dayName];
    const checksPerDay = Math.round(randBetween(40, 80) * mult);

    // Get servers working this day
    const servers = MOCK_EMPLOYEES.filter(e =>
      (e.roles.includes('Bartender') || e.roles.includes('Server') || e.roles.includes('Lead Bartender')) &&
      e.availability[dayName] !== null && e.availability[dayName] !== undefined
    );

    for (let c = 0; c < checksPerDay; c++) {
      const server = pick(servers);
      const numItems = randInt(1, 5);
      const openHour = randInt(11, 23);
      const openMin = randInt(0, 59);
      const durMin = randInt(15, 120);
      const opened = `${formatDate(date)} ${openHour.toString().padStart(2, '0')}:${openMin.toString().padStart(2, '0')}:00`;
      const closeDate = new Date(date);
      closeDate.setHours(openHour, openMin + durMin);
      const closed = `${formatDate(closeDate)} ${closeDate.getHours().toString().padStart(2, '0')}:${closeDate.getMinutes().toString().padStart(2, '0')}:00`;

      let subtotal = 0;
      const items: { item: string; group: string; qty: number; price: number; net: number }[] = [];

      for (let i = 0; i < numItems; i++) {
        const mi = pick(menuItems);
        const qty = randInt(1, 3);
        const discount = random() > 0.9 ? Math.round(mi.price * qty * randBetween(0.1, 0.3) * 100) / 100 : 0;
        const net = mi.price * qty - discount;
        subtotal += net;
        items.push({ item: mi.item, group: mi.group, qty, price: mi.price, net: Math.round(net * 100) / 100 });
      }

      const tax = Math.round(subtotal * 0.07 * 100) / 100;
      const tipPct = randBetween(0.15, 0.25);
      const tip = Math.round(subtotal * tipPct * 100) / 100;
      const pm = pick(payMethods);
      const cn = checkNum++;

      for (const it of items) {
        rows.push([
          cn, opened, closed, 'Bar',
          `${server.firstName} ${server.lastName}`,
          it.item, it.group, it.qty, it.price.toFixed(2), it.net.toFixed(2),
          tax.toFixed(2), tip.toFixed(2), pm,
        ].join(','));
      }
    }
  }

  return ['Check Num,Opened,Closed,Revenue Center,Server,Item,Menu Group,Qty,Item Price,Net Amount,Tax,Tip,Payment Method', ...rows].join('\n');
}

// ============================================================
// Write all files
// ============================================================
function main() {
  // Ensure directories exist
  fs.mkdirSync(path.join(outDir, 'toast'), { recursive: true });
  fs.mkdirSync(path.join(outDir, '7shifts'), { recursive: true });

  const files: [string, string][] = [
    [path.join(outDir, '7shifts', 'employees.csv'), genEmployeesCSV()],
    [path.join(outDir, '7shifts', 'availability.csv'), genAvailabilityCSV()],
    [path.join(outDir, '7shifts', 'time-off-requests.csv'), genTimeOffCSV()],
    [path.join(outDir, '7shifts', 'shifts.csv'), genShiftsCSV()],
    [path.join(outDir, 'toast', 'sales-summary.csv'), genSalesSummaryCSV()],
    [path.join(outDir, 'toast', 'employee-tips.csv'), genEmployeeTipsCSV()],
    [path.join(outDir, 'toast', 'labor-report.csv'), genLaborReportCSV()],
    [path.join(outDir, 'toast', 'checks-detail.csv'), genChecksDetailCSV()],
  ];

  for (const [filepath, content] of files) {
    fs.writeFileSync(filepath, content, 'utf-8');
    const lines = content.split('\n').length - 1;
    console.log(`  ✓ ${path.relative(outDir, filepath)} (${lines} rows)`);
  }

  console.log('\nDone! Mock data generated in mock-data/');
}

main();
