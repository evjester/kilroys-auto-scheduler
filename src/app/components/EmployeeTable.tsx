'use client';

import { useState, useMemo, Fragment } from 'react';
import type { EmployeeProfile, DayOfWeek } from '@/lib/types';
import { PERFORMANCE_WEIGHTS } from '@/lib/mock-config';
import MetricsBadge from './MetricsBadge';

interface Props {
  employees: EmployeeProfile[];
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBR: Record<DayOfWeek, string> = {
  Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'Th', Friday: 'F', Saturday: 'Sa', Sunday: 'Su',
};

type PerformanceSortKey = 'name' | 'performanceScore' | 'avgSalesPerHour' | 'avgTipsPerHour' | 'avgTipPct' | 'reliabilityScore';
type AttendanceSortKey = 'name' | 'reliabilityScore' | 'targetWeeklyHours';

interface RoleSectionConfig {
  role: string;
  label: string;
  type: 'performance' | 'attendance';
  color: string;
  badgeClass: string;
  defaultExpanded: boolean;
}

const ROLE_SECTIONS: RoleSectionConfig[] = [
  { role: 'Bartender', label: 'Bartenders', type: 'performance', color: 'blue', badgeClass: 'bg-blue-500/20 text-blue-400', defaultExpanded: true },
  { role: 'Server', label: 'Servers', type: 'performance', color: 'green', badgeClass: 'bg-green-500/20 text-green-400', defaultExpanded: false },
  { role: 'Barback', label: 'Barbacks', type: 'attendance', color: 'cyan', badgeClass: 'bg-cyan-500/20 text-cyan-400', defaultExpanded: false },
  { role: 'Security', label: 'Security', type: 'attendance', color: 'red', badgeClass: 'bg-red-500/20 text-red-400', defaultExpanded: false },
  { role: 'Carder', label: 'Carders', type: 'attendance', color: 'orange', badgeClass: 'bg-orange-500/20 text-orange-400', defaultExpanded: false },
];

export default function EmployeeTable({ employees }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(ROLE_SECTIONS.filter(s => s.defaultExpanded).map(s => s.role))
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, EmployeeProfile[]>();
    for (const section of ROLE_SECTIONS) {
      map.set(section.role, []);
    }
    for (const emp of employees) {
      const list = map.get(emp.primaryRole);
      if (list) list.push(emp);
    }
    return map;
  }, [employees]);

  // Team averages for score breakdown (only from performance roles)
  const teamAvgs = useMemo(() => {
    const perfEmps = employees.filter(e => e.primaryRole === 'Bartender' || e.primaryRole === 'Server');
    if (perfEmps.length === 0) return { sales: 1, tips: 1, tipPct: 1, reliability: 1 };
    const n = perfEmps.length;
    return {
      sales: perfEmps.reduce((s, e) => s + e.avgSalesPerHour, 0) / n || 1,
      tips: perfEmps.reduce((s, e) => s + e.avgTipsPerHour, 0) / n || 1,
      tipPct: perfEmps.reduce((s, e) => s + e.avgTipPct, 0) / n || 1,
      reliability: perfEmps.reduce((s, e) => s + e.reliabilityScore, 0) / n || 1,
    };
  }, [employees]);

  const toggleSection = (role: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {ROLE_SECTIONS.map(section => {
        const sectionEmployees = grouped.get(section.role) || [];
        if (sectionEmployees.length === 0) return null;
        const isOpen = expandedSections.has(section.role);

        const summaryValue = section.type === 'performance'
          ? `Avg Score: ${Math.round(sectionEmployees.reduce((s, e) => s + e.performanceScore, 0) / sectionEmployees.length)}`
          : `Avg Reliability: ${Math.round(sectionEmployees.reduce((s, e) => s + e.reliabilityScore, 0) / sectionEmployees.length)}%`;

        return (
          <div key={section.role} className="overflow-hidden rounded-xl glass-card">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.role)}
              className="flex w-full items-center justify-between px-4 py-3 bg-overlay-subtle hover:bg-overlay transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`h-4 w-4 text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold ${section.badgeClass}`}>
                  {section.label.toUpperCase()}
                </span>
                <span className="text-sm text-faint">({sectionEmployees.length})</span>
              </div>
              <span className="text-xs text-faint">{summaryValue}</span>
            </button>

            {/* Section body */}
            {isOpen && (
              section.type === 'performance' ? (
                <PerformanceTable
                  employees={sectionEmployees}
                  teamAvgs={teamAvgs}
                  expandedId={expandedId}
                  onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                />
              ) : (
                <AttendanceTable
                  employees={sectionEmployees}
                  expandedId={expandedId}
                  onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Performance Table (Bartenders, Servers)
// ============================================================

function PerformanceTable({
  employees,
  teamAvgs,
  expandedId,
  onToggleExpand,
}: {
  employees: EmployeeProfile[];
  teamAvgs: { sales: number; tips: number; tipPct: number; reliability: number };
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<PerformanceSortKey>('performanceScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...employees].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  function toggleSort(key: PerformanceSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function getScoreBreakdown(emp: EmployeeProfile) {
    const normSales = Math.min(100, (emp.avgSalesPerHour / teamAvgs.sales) * 50);
    const normTips = Math.min(100, (emp.avgTipsPerHour / teamAvgs.tips) * 50);
    const normTipPct = Math.min(100, (emp.avgTipPct / teamAvgs.tipPct) * 50);
    const normReliability = Math.min(100, emp.reliabilityScore);

    return [
      { name: 'Sales/hr', weight: PERFORMANCE_WEIGHTS.salesPerHour, rawValue: `$${emp.avgSalesPerHour.toFixed(0)}/hr`, normalized: normSales, weighted: normSales * PERFORMANCE_WEIGHTS.salesPerHour, description: 'Revenue generated per hour worked', color: 'bg-blue-500' },
      { name: 'Tips/hr', weight: PERFORMANCE_WEIGHTS.tipsPerHour, rawValue: `$${emp.avgTipsPerHour.toFixed(0)}/hr`, normalized: normTips, weighted: normTips * PERFORMANCE_WEIGHTS.tipsPerHour, description: 'Tip income per hour — reflects service quality', color: 'bg-green-500' },
      { name: 'Tip %', weight: PERFORMANCE_WEIGHTS.tipPct, rawValue: `${emp.avgTipPct.toFixed(1)}%`, normalized: normTipPct, weighted: normTipPct * PERFORMANCE_WEIGHTS.tipPct, description: 'Tip percentage across all checks', color: 'bg-purple-500' },
      { name: 'Reliability', weight: PERFORMANCE_WEIGHTS.reliability, rawValue: `${emp.reliabilityScore}%`, normalized: normReliability, weighted: normReliability * PERFORMANCE_WEIGHTS.reliability, description: 'Actual hours worked vs. scheduled hours', color: 'bg-amber-500' },
    ];
  }

  const headers: { key: PerformanceSortKey; label: string }[] = [
    { key: 'name', label: 'Employee' },
    { key: 'performanceScore', label: 'Score' },
    { key: 'avgSalesPerHour', label: 'Sales/hr' },
    { key: 'avgTipsPerHour', label: 'Tips/hr' },
    { key: 'avgTipPct', label: 'Tip %' },
    { key: 'reliabilityScore', label: 'Reliability' },
  ];

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-border bg-overlay-subtle">
          {headers.map(h => (
            <th
              key={h.key}
              onClick={() => toggleSort(h.key)}
              className="cursor-pointer px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-faint hover:text-secondary select-none"
            >
              <div className="flex items-center gap-1">
                {h.label}
                {sortKey === h.key && (
                  <span className="text-brand-500">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                )}
              </div>
            </th>
          ))}
          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-faint">Availability</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {sorted.map(emp => {
          const isExpanded = expandedId === emp.id;
          return (
            <Fragment key={emp.id}>
              <tr
                className={`transition-colors cursor-pointer ${isExpanded ? 'bg-overlay-subtle' : 'hover:bg-overlay-subtle'}`}
                onClick={() => onToggleExpand(emp.id)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{emp.name}</div>
                  <div className="text-xs text-faint">{emp.id}</div>
                </td>
                <td className="px-4 py-3">
                  <MetricsBadge score={emp.performanceScore} />
                </td>
                <td className="px-4 py-3 text-sm font-mono text-secondary">
                  ${emp.avgSalesPerHour.toFixed(0)}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-secondary">
                  ${emp.avgTipsPerHour.toFixed(0)}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-secondary">
                  {emp.avgTipPct.toFixed(1)}%
                </td>
                <td className="px-4 py-3">
                  <MetricsBadge score={emp.reliabilityScore} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {DAYS.map(d => {
                        const isAvail = emp.availability[d] !== null && emp.availability[d] !== undefined;
                        return (
                          <span
                            key={d}
                            title={`${d}: ${isAvail ? 'Available' : 'Unavailable'}`}
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-medium ${
                              isAvail
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-overlay text-faint'
                            }`}
                          >
                            {DAY_ABBR[d]}
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-xs text-faint">{DAYS.filter(d => emp.availability[d] !== null && emp.availability[d] !== undefined).length}d</span>
                    <svg
                      className={`h-4 w-4 text-faint transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </td>
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <ScoreBreakdown emp={emp} breakdown={getScoreBreakdown(emp)} />
                    <AttendanceDetail emp={emp} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

// ============================================================
// Attendance Table (Barbacks, Security, Carders)
// ============================================================

function AttendanceTable({
  employees,
  expandedId,
  onToggleExpand,
}: {
  employees: EmployeeProfile[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<AttendanceSortKey>('reliabilityScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...employees].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  function toggleSort(key: AttendanceSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const headers: { key: AttendanceSortKey; label: string }[] = [
    { key: 'name', label: 'Employee' },
    { key: 'reliabilityScore', label: 'Reliability' },
    { key: 'targetWeeklyHours', label: 'Target Hrs' },
  ];

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-border bg-overlay-subtle">
          {headers.map(h => (
            <th
              key={h.key}
              onClick={() => toggleSort(h.key)}
              className="cursor-pointer px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-faint hover:text-secondary select-none"
            >
              <div className="flex items-center gap-1">
                {h.label}
                {sortKey === h.key && (
                  <span className="text-brand-500">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                )}
              </div>
            </th>
          ))}
          <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-faint">Availability</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {sorted.map(emp => {
          const isExpanded = expandedId === emp.id;
          const availDays = DAYS.filter(d => {
            const a = emp.availability[d];
            return a !== null && a !== undefined;
          });

          return (
            <Fragment key={emp.id}>
              <tr
                className={`transition-colors cursor-pointer ${isExpanded ? 'bg-overlay-subtle' : 'hover:bg-overlay-subtle'}`}
                onClick={() => onToggleExpand(emp.id)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{emp.name}</div>
                  <div className="text-xs text-faint">{emp.id}</div>
                </td>
                <td className="px-4 py-3">
                  <MetricsBadge score={emp.reliabilityScore} size="sm" />
                </td>
                <td className="px-4 py-3 text-sm font-mono text-secondary">
                  {emp.targetWeeklyHours}hr
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {DAYS.map(d => {
                        const isAvail = emp.availability[d] !== null && emp.availability[d] !== undefined;
                        return (
                          <span
                            key={d}
                            title={`${d}: ${isAvail ? 'Available' : 'Unavailable'}`}
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-medium ${
                              isAvail
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-overlay text-faint'
                            }`}
                          >
                            {DAY_ABBR[d]}
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-xs text-faint">{availDays.length}d</span>
                    <svg
                      className={`h-4 w-4 text-faint transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </td>
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <AttendanceDetail emp={emp} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

// ============================================================
// Expanded Detail Panels
// ============================================================

function ScoreBreakdown({ emp, breakdown }: {
  emp: EmployeeProfile;
  breakdown: { name: string; weight: number; rawValue: string; normalized: number; weighted: number; description: string; color: string }[];
}) {
  const totalWeighted = breakdown.reduce((s, f) => s + f.weighted, 0);

  return (
    <div className="border-t border-border bg-overlay-subtle px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-secondary">Score Breakdown</h4>
        <span className="text-xs text-faint">
          Computed: {Math.round(totalWeighted)} | Displayed: {emp.performanceScore}
        </span>
      </div>
      <div className="space-y-3">
        {breakdown.map(factor => (
          <div key={factor.name} className="flex items-start gap-3">
            <div className="w-24 shrink-0">
              <div className="text-sm font-medium text-secondary">{factor.name}</div>
              <div className="text-xs text-faint">{(factor.weight * 100).toFixed(0)}% weight</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="h-2 flex-1 rounded-full bg-overlay-hover overflow-hidden">
                  <div
                    className={`h-full rounded-full ${factor.color} transition-all`}
                    style={{ width: `${Math.min(100, factor.normalized)}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs font-mono text-muted">
                  {factor.rawValue}
                </span>
                <span className="w-16 text-right text-xs font-mono font-semibold text-gray-200">
                  +{factor.weighted.toFixed(1)} pts
                </span>
              </div>
              <div className="text-xs text-faint">{factor.description}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-border text-xs text-faint">
        50 = team median. Metrics normalized against team averages from 4 weeks of Toast POS data.
      </div>
    </div>
  );
}

function AttendanceDetail({ emp }: { emp: EmployeeProfile }) {
  return (
    <div className="border-t border-border bg-overlay-subtle px-6 py-4">
      <h4 className="text-sm font-semibold text-secondary mb-3">Availability & Schedule</h4>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map(d => {
          const avail = emp.availability[d];
          const isAvail = avail !== null && avail !== undefined;
          const timeStr = isAvail && avail ? `${avail.from} - ${avail.to}` : '';
          return (
            <div
              key={d}
              className={`rounded-lg border px-2 py-2 text-center ${
                isAvail
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-border bg-overlay-subtle'
              }`}
            >
              <div className={`text-xs font-semibold ${isAvail ? 'text-green-400' : 'text-faint'}`}>
                {d.slice(0, 3)}
              </div>
              {isAvail ? (
                <div className="text-[10px] text-green-400/70 mt-0.5">{timeStr}</div>
              ) : (
                <div className="text-[10px] text-faint mt-0.5">Off</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-faint">
        <span>Preferred shift: <span className="font-medium text-secondary">{emp.preferences.preferredShiftType}</span></span>
        <span>Reliability: <span className="font-medium text-secondary">{emp.reliabilityScore}%</span></span>
        <span>Target Hours: <span className="font-medium text-secondary">{emp.targetWeeklyHours}hr</span></span>
      </div>
    </div>
  );
}
