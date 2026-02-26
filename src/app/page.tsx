'use client';

import { useEffect, useState, useMemo } from 'react';
import type { ScheduleResult, EmployeeProfile, DayOfWeek } from '@/lib/types';
import StatCard from './components/StatCard';
import MetricsBadge from './components/MetricsBadge';
import Link from 'next/link';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ROLES = ['Bartender', 'Server', 'Barback', 'Security', 'Carder'];

const ROLE_TEXT_COLORS: Record<string, string> = {
  Bartender: 'text-blue-400',
  Server: 'text-green-400',
  Barback: 'text-cyan-400',
  Security: 'text-red-400',
  Carder: 'text-orange-400',
};

const ROLE_DOT_COLORS: Record<string, string> = {
  Bartender: 'bg-blue-500',
  Server: 'bg-green-500',
  Barback: 'bg-cyan-500',
  Security: 'bg-red-500',
  Carder: 'bg-orange-500',
};

const ROLE_STROKE_COLORS: Record<string, string> = {
  Bartender: '#3b82f6',
  Server: '#22c55e',
  Barback: '#06b6d4',
  Security: '#ef4444',
  Carder: '#f97316',
};

export default function Dashboard() {
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/schedule').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ])
      .then(([schedData, empData]) => {
        setSchedule(schedData);
        setEmployees(empData.employees);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const data = useMemo(() => {
    if (!schedule || employees.length === 0) return null;

    // --- KPI Stats ---
    const uniqueEmployeeIds = new Set(schedule.assignments.map(a => a.employee.id));
    const totalStaffOn = uniqueEmployeeIds.size;
    const barStaff = employees.filter(e => e.primaryRole === 'Bartender' || e.primaryRole === 'Server');
    const avgPerformance = barStaff.length > 0
      ? Math.round(barStaff.reduce((s, e) => s + e.performanceScore, 0) / barStaff.length)
      : 0;
    const totalLaborHours = Math.round(schedule.assignments.reduce((sum, a) => sum + a.shiftSlot.duration, 0));

    // --- Availability Heatmap ---
    const heatmap: Record<string, Record<string, number>> = {};
    for (const day of DAYS) {
      heatmap[day] = {};
      for (const role of ROLES) {
        heatmap[day][role] = employees.filter(e =>
          e.primaryRole === role &&
          e.availability[day] !== null &&
          e.availability[day] !== undefined
        ).length;
      }
    }
    const roleTotals: Record<string, number> = {};
    for (const role of ROLES) {
      roleTotals[role] = employees.filter(e => e.primaryRole === role).length;
    }

    // --- Top Performers ---
    const topPerformers = [...barStaff]
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 5);

    // --- Staffing Alerts ---
    const alerts: { type: 'danger' | 'warning' | 'info'; message: string }[] = [];

    // Hours per employee
    const hoursPerEmp: Record<string, number> = {};
    for (const a of schedule.assignments) {
      hoursPerEmp[a.employee.id] = (hoursPerEmp[a.employee.id] || 0) + a.shiftSlot.duration;
    }
    for (const emp of employees) {
      const scheduled = hoursPerEmp[emp.id] || 0;
      if (scheduled > emp.maxWeeklyHours) {
        alerts.push({ type: 'danger', message: `${emp.name} EXCEEDS max hours: ${Math.round(scheduled)}/${emp.maxWeeklyHours}hr` });
      } else if (scheduled > 0 && emp.maxWeeklyHours - scheduled <= 5) {
        alerts.push({ type: 'warning', message: `${emp.name} approaching max: ${Math.round(scheduled)}/${emp.maxWeeklyHours}hr` });
      }
    }

    // Low reliability
    for (const emp of employees.filter(e => e.reliabilityScore > 0 && e.reliabilityScore < 60)) {
      alerts.push({ type: 'danger', message: `${emp.name} low reliability: ${emp.reliabilityScore}% (${emp.primaryRole})` });
    }

    // Unfilled positions by day
    const unfilledByDay: Record<string, number> = {};
    for (const slot of schedule.unfilledShifts) {
      unfilledByDay[slot.dayOfWeek] = (unfilledByDay[slot.dayOfWeek] || 0) + 1;
    }
    for (const [day, count] of Object.entries(unfilledByDay)) {
      alerts.push({ type: 'warning', message: `${day}: ${count} unfilled position${count > 1 ? 's' : ''}` });
    }

    for (const w of schedule.warnings) {
      alerts.push({ type: 'info', message: w });
    }

    // Sort: danger first, then warning, then info
    alerts.sort((a, b) => {
      const order = { danger: 0, warning: 1, info: 2 };
      return order[a.type] - order[b.type];
    });

    // --- Role Distribution ---
    const roleCount: Record<string, number> = {};
    for (const a of schedule.assignments) {
      roleCount[a.employee.role] = (roleCount[a.employee.role] || 0) + 1;
    }
    const totalAssignments = schedule.assignments.length;

    // --- Daily Coverage by shift type ---
    const dailyCoverage = DAYS.map((day, i) => {
      const dayAssigns = schedule.assignments.filter(a => a.shiftSlot.dayOfWeek === day);
      return {
        day,
        abbr: DAY_ABBR[i],
        AM: dayAssigns.filter(a => a.shiftSlot.shiftType === 'AM').length,
        PM: dayAssigns.filter(a => a.shiftSlot.shiftType === 'PM').length,
        Late: dayAssigns.filter(a => a.shiftSlot.shiftType === 'Late').length,
        total: dayAssigns.length,
      };
    });
    const maxDailyTotal = Math.max(...dailyCoverage.map(d => d.total), 1);

    return {
      totalStaffOn, avgPerformance, totalLaborHours,
      heatmap, roleTotals,
      topPerformers,
      alerts,
      roleCount, totalAssignments,
      dailyCoverage, maxDailyTotal,
    };
  }, [schedule, employees]);

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-overlay-hover" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-overlay" />)}
        </div>
        <div className="h-64 rounded-xl bg-overlay" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-80 rounded-xl bg-overlay" />
          <div className="h-80 rounded-xl bg-overlay" />
        </div>
      </div>
    );
  }

  if (!schedule || !data) {
    return <div className="text-center text-muted py-20">Failed to load schedule data.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
        <p className="text-sm text-muted">
          Week of {schedule.weekStart} to {schedule.weekEnd} — {employees.length} staff
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Staff Scheduled" value={data.totalStaffOn.toString()} color="blue" subtitle={`of ${employees.length} employees`} />
        <StatCard label="Fill Rate" value={`${schedule.stats.fillRate}%`} color="green" subtitle={`${schedule.stats.filledShifts} of ${schedule.stats.totalShifts} shifts`} />
        <StatCard label="Avg Performance" value={data.avgPerformance.toString()} color="purple" subtitle="Bartenders + Servers" />
        <StatCard label="Labor Hours" value={data.totalLaborHours.toString()} color="amber" subtitle="Total scheduled this week" />
      </div>

      {/* Staff Availability Heatmap */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Staff Availability</h2>
        <p className="text-xs text-faint mb-4">Available employees per day by role</p>
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-faint w-24">Role</th>
                {DAYS.map((day, i) => (
                  <th key={day} className="px-1 py-1.5 text-xs font-medium text-faint">{DAY_ABBR[i]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map(role => (
                <tr key={role}>
                  <td className="px-2 py-1 text-left">
                    <span className={`text-xs font-medium ${ROLE_TEXT_COLORS[role]}`}>{role}</span>
                  </td>
                  {DAYS.map(day => {
                    const avail = data.heatmap[day][role];
                    const total = data.roleTotals[role];
                    const ratio = total > 0 ? avail / total : 0;
                    const cellColor = total === 0
                      ? 'bg-overlay text-faint'
                      : ratio >= 0.7 ? 'bg-green-500/20 text-green-400'
                      : ratio >= 0.4 ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400';
                    return (
                      <td key={day} className="px-1 py-1">
                        <div className={`rounded-md px-1.5 py-1.5 text-xs font-bold ${cellColor}`}>
                          {avail}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-faint">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500/30" />
            <span>70%+ available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-yellow-500/30" />
            <span>40-69%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500/30" />
            <span>&lt;40% short</span>
          </div>
        </div>
      </div>

      {/* Top Performers + Staffing Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performers */}
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top Performers</h2>
          <div className="space-y-3">
            {data.topPerformers.map((emp, idx) => (
              <div key={emp.id} className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                  idx === 0 ? 'bg-yellow-500/20 text-yellow-400'
                  : idx === 1 ? 'bg-gray-300/20 text-secondary'
                  : idx === 2 ? 'bg-orange-600/20 text-orange-400'
                  : 'bg-overlay-hover text-faint'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{emp.name}</div>
                  <div className="text-xs text-faint">{emp.primaryRole}</div>
                </div>
                <MetricsBadge score={emp.performanceScore} size="sm" />
                <div className="text-right">
                  <div className="text-xs font-mono text-muted">${emp.avgSalesPerHour.toFixed(0)}/hr</div>
                  <div className="text-xs font-mono text-faint">${emp.avgTipsPerHour.toFixed(0)} tips</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staffing Alerts */}
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Staffing Alerts
            {data.alerts.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                {data.alerts.length}
              </span>
            )}
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {data.alerts.length === 0 ? (
              <p className="text-sm text-faint">No alerts — looking good!</p>
            ) : (
              data.alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                  alert.type === 'danger' ? 'bg-red-500/10 border border-red-500/20'
                  : alert.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20'
                  : 'bg-blue-500/10 border border-blue-500/20'
                }`}>
                  <svg className={`mt-0.5 w-4 h-4 shrink-0 ${
                    alert.type === 'danger' ? 'text-red-400'
                    : alert.type === 'warning' ? 'text-amber-400'
                    : 'text-blue-400'
                  }`} viewBox="0 0 20 20" fill="currentColor">
                    {alert.type === 'danger' ? (
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    ) : alert.type === 'warning' ? (
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                    )}
                  </svg>
                  <span className={`text-xs ${
                    alert.type === 'danger' ? 'text-red-300'
                    : alert.type === 'warning' ? 'text-amber-300'
                    : 'text-blue-300'
                  }`}>
                    {alert.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Role Distribution + Daily Coverage */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Role Distribution Ring */}
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Shifts by Role</h2>
          <div className="flex items-center gap-6">
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {(() => {
                  const entries = Object.entries(data.roleCount).sort((a, b) => b[1] - a[1]);
                  const total = data.totalAssignments || 1;
                  let cumulative = 0;
                  return entries.map(([role, count]) => {
                    const pct = count / total;
                    const dashArray = `${pct * 100} ${100 - pct * 100}`;
                    const dashOffset = 100 - cumulative * 100;
                    cumulative += pct;
                    return (
                      <circle
                        key={role}
                        cx="18" cy="18" r="15.9155"
                        fill="none"
                        stroke={ROLE_STROKE_COLORS[role] || '#6b7280'}
                        strokeWidth="3"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-xl font-bold text-foreground">{data.totalAssignments}</div>
                <div className="text-xs text-faint">shifts</div>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              {Object.entries(data.roleCount)
                .sort((a, b) => b[1] - a[1])
                .map(([role, count]) => {
                  const pct = data.totalAssignments > 0
                    ? Math.round((count / data.totalAssignments) * 100)
                    : 0;
                  return (
                    <div key={role} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${ROLE_DOT_COLORS[role] || 'bg-gray-500'}`} />
                        <span className="text-sm text-secondary">{role}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted">{count}</span>
                        <span className="text-xs text-faint w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Daily Coverage */}
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Daily Coverage</h2>
          <p className="text-xs text-faint mb-4">Shifts per day by period</p>
          <div className="space-y-2.5">
            {data.dailyCoverage.map(d => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="w-10 text-xs font-medium text-muted">{d.abbr}</span>
                <div className="flex-1 flex h-6 rounded-full bg-overlay overflow-hidden">
                  {d.AM > 0 && (
                    <div
                      className="bg-amber-500/70 flex items-center justify-center transition-all"
                      style={{ width: `${(d.AM / data.maxDailyTotal) * 100}%` }}
                      title={`Morning: ${d.AM}`}
                    >
                      {d.AM >= 2 && <span className="text-[10px] font-bold text-white">{d.AM}</span>}
                    </div>
                  )}
                  {d.PM > 0 && (
                    <div
                      className="bg-blue-500/70 flex items-center justify-center transition-all"
                      style={{ width: `${(d.PM / data.maxDailyTotal) * 100}%` }}
                      title={`Happy Hour: ${d.PM}`}
                    >
                      {d.PM >= 2 && <span className="text-[10px] font-bold text-white">{d.PM}</span>}
                    </div>
                  )}
                  {d.Late > 0 && (
                    <div
                      className="bg-purple-500/70 flex items-center justify-center transition-all"
                      style={{ width: `${(d.Late / data.maxDailyTotal) * 100}%` }}
                      title={`Night: ${d.Late}`}
                    >
                      {d.Late >= 2 && <span className="text-[10px] font-bold text-white">{d.Late}</span>}
                    </div>
                  )}
                </div>
                <span className="w-8 text-right text-xs font-mono text-faint">{d.total}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-faint">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500/70" />
              <span>Morning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500/70" />
              <span>Happy Hour</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-500/70" />
              <span>Night</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/schedule" className="glass-card rounded-xl p-5 group hover:bg-overlay-hover transition-all hover:border-brand-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <div className="text-base font-bold text-foreground group-hover:text-brand-500 transition-colors">View Schedule</div>
              <div className="text-xs text-faint">Weekly grid with drag-and-drop lineups</div>
            </div>
          </div>
        </Link>
        <Link href="/employees" className="glass-card rounded-xl p-5 group hover:bg-overlay-hover transition-all hover:border-brand-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div>
              <div className="text-base font-bold text-foreground group-hover:text-brand-500 transition-colors">Employees</div>
              <div className="text-xs text-faint">Performance metrics & score breakdown</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
