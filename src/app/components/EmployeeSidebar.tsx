'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { EmployeeProfile, DayOfWeek, SidebarFilters } from '@/lib/types';
import { ROLE_COLORS } from '@/lib/mock-config';
import { BAR_AREAS } from '@/lib/venue-config';
import { SECURITY_AREAS } from '@/lib/security-venue-config';
import EmployeeChip from './EmployeeChip';

type PreferredMap = Record<string, { positionId?: string }>;

function getWellLabel(positionId: string): string {
  for (const area of BAR_AREAS) {
    const pos = area.positions.find(p => p.id === positionId);
    if (pos) return `${area.name} ${pos.label}`;
  }
  for (const area of SECURITY_AREAS) {
    const pos = area.positions.find(p => p.id === positionId);
    if (pos) return `${area.name} ${pos.label}`;
  }
  return '';
}

interface EmployeeSidebarProps {
  employees: EmployeeProfile[];
  selectedDay: DayOfWeek;
  placedEmployeeIds: Set<string>;
  placedInOtherShifts?: Set<string>;
  preferredIds: Set<string>;
  preferredMap?: PreferredMap;
  lineupType?: 'bartender' | 'security';
  filters: SidebarFilters;
  onFiltersChange: (filters: SidebarFilters) => void;
  onTogglePreferred: (employeeId: string) => void;
  onSetWellPreference?: (employeeId: string, positionId: string | undefined) => void;
}

export default function EmployeeSidebar({
  employees,
  selectedDay,
  placedEmployeeIds,
  placedInOtherShifts,
  preferredIds,
  preferredMap,
  lineupType,
  filters,
  onFiltersChange,
  onTogglePreferred,
  onSetWellPreference,
}: EmployeeSidebarProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'employee-sidebar',
    data: { type: 'sidebar' },
  });

  const [searchQuery, setSearchQuery] = useState('');

  const withAvailability = employees.map(emp => {
    const dayAvail = emp.availability[selectedDay];
    const isAvailable = dayAvail !== null && dayAvail !== undefined;
    const isTopPerformer = emp.performanceScore >= 75;
    const isPreferred = preferredIds.has(emp.id);
    return { emp, isAvailable, isTopPerformer, isPreferred };
  });

  const searched = searchQuery.trim()
    ? withAvailability.filter(({ emp }) =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : withAvailability;

  const filtered = searched.filter(({ isAvailable, isTopPerformer, isPreferred }) => {
    const anyFilterActive = filters.available || filters.topPerformers || filters.managementPreferred || filters.unavailable;
    if (!anyFilterActive) return true;

    if (filters.available && isAvailable) return true;
    if (filters.topPerformers && isTopPerformer) return true;
    if (filters.managementPreferred && isPreferred) return true;
    if (filters.unavailable && !isAvailable) return true;
    return false;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    return b.emp.performanceScore - a.emp.performanceScore;
  });

  const toggleFilter = (key: keyof SidebarFilters) => {
    onFiltersChange({ ...filters, [key]: !filters[key] });
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-xl glass-card overflow-hidden h-full
        ${isOver ? 'border-brand-400 ring-2 ring-brand-500/30' : ''}
      `}
    >
      <div className="border-b border-border bg-overlay-subtle px-3 py-2">
        <h3 className="text-sm font-bold text-foreground">Employees</h3>
        <p className="text-xs text-faint">{sorted.length} of {employees.length}</p>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-foreground placeholder-faint focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        {([
          { key: 'available' as const, label: 'Available', active: 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' },
          { key: 'topPerformers' as const, label: 'Top Perf', active: 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30' },
          { key: 'managementPreferred' as const, label: 'Preferred', active: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' },
          { key: 'unavailable' as const, label: 'Unavail', active: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' },
        ]).map(({ key, label, active }) => (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            className={`
              rounded-full px-2 py-0.5 text-xs font-medium transition-colors
              ${filters[key] ? active : 'bg-overlay text-faint hover:bg-overlay-hover'}
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Employee list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {sorted.map(({ emp, isAvailable, isPreferred }) => {
          const isPlaced = placedEmployeeIds.has(emp.id);
          const inOtherShift = placedInOtherShifts?.has(emp.id) ?? false;
          const roleColor = ROLE_COLORS[emp.primaryRole] || 'bg-overlay-hover text-muted';

          const wellPosId = preferredMap?.[emp.id]?.positionId;
          const wellLabel = wellPosId ? getWellLabel(wellPosId) : '';

          return (
            <div key={emp.id} className={`${!isAvailable ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-1">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <EmployeeChip
                    employeeId={emp.id}
                    employeeName={emp.name}
                    performanceScore={emp.performanceScore}
                    role={emp.primaryRole}
                    isPreferred={isPreferred}
                    isUnavailable={!isAvailable}
                    isPlaced={isPlaced}
                    isDouble={inOtherShift}
                    onTogglePreferred={() => onTogglePreferred(emp.id)}
                    onPreferWithWell={onSetWellPreference ? (posId) => onSetWellPreference(emp.id, posId) : undefined}
                    preferredPositionId={wellPosId}
                    lineupType={lineupType}
                    dragIdPrefix="sidebar"
                  />
                </div>
                <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${roleColor}`}>
                  {emp.primaryRole
                    .replace('Bar Manager', 'Mgr')
                    .replace('Bartender', 'BT')
                    .replace('Barback', 'BB')
                    .replace('Server', 'SRV')
                    .replace('Security', 'SEC')
                    .replace('Carder', 'CRD')
                  }
                </span>
                <span className="shrink-0 text-xs text-faint w-8 text-right">
                  {emp.targetWeeklyHours}h
                </span>
              </div>
              {isPreferred && wellLabel && (
                <div className="ml-6 -mt-0.5 mb-0.5">
                  <span className="text-[10px] font-medium text-amber-400 bg-amber-500/20 rounded px-1 py-0.5">
                    {wellLabel}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-xs text-faint text-center py-4">No employees match filters.</p>
        )}
      </div>
    </div>
  );
}
