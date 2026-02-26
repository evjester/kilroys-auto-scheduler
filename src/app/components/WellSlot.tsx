'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { LineupAssignment, PositionType } from '@/lib/types';
import EmployeeChip from './EmployeeChip';
import ShiftPopover from './ShiftPopover';

interface WellSlotProps {
  positionId: string;
  label: string;
  type: PositionType;
  assignment: LineupAssignment | undefined;
  shiftDefaultHours: { start: string; end: string };
  onCustomHoursChange?: (positionId: string, customHours: { start: string; end: string } | undefined) => void;
}

const TYPE_STYLES: Record<PositionType, string> = {
  speed:      'bg-amber-500/20 border-amber-500/30 font-bold text-amber-400',
  standard:   'bg-overlay-hover border-border-strong text-secondary',
  barback:    'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
  on_call:    'bg-orange-500/20 border-orange-500/30 text-orange-400',
  server:     'bg-green-500/20 border-green-500/30 text-green-400',
  carder:     'bg-orange-500/20 border-orange-500/30 text-orange-400',
  exit_door:  'bg-red-500/20 border-red-500/30 text-red-400',
  fixed_post: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
  roam:       'bg-blue-500/20 border-blue-500/30 text-blue-400',
  boh:        'bg-overlay-hover border-border-strong text-muted',
};

export default function WellSlot({ positionId, label, type, assignment, shiftDefaultHours, onCustomHoursChange }: WellSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: positionId,
    data: { positionId, type },
  });

  const [showPopover, setShowPopover] = useState(false);
  const hasEmployee = assignment && assignment.employeeId;
  const labelStyle = TYPE_STYLES[type] || TYPE_STYLES.standard;

  return (
    <div
      ref={setNodeRef}
      className={`
        relative flex items-center gap-2 rounded-lg border px-3 py-1.5 min-h-[38px] transition-colors
        ${isOver ? 'border-brand-400 bg-brand-500/10 ring-2 ring-brand-500/30' : 'border-border bg-overlay-subtle'}
      `}
    >
      <span className={`inline-flex items-center justify-center gap-0.5 rounded px-2 py-0.5 text-xs font-semibold min-w-[42px] text-center ${labelStyle}`}>
        {assignment?.isPreferredWell && (
          <span className="text-amber-400 text-[10px]" title="Well preference">★</span>
        )}
        {label}
      </span>
      <div className="flex-1 min-w-0">
        {hasEmployee ? (
          <EmployeeChip
            employeeId={assignment.employeeId!}
            employeeName={assignment.employeeName}
            performanceScore={assignment.performanceScore}
            role={assignment.role}
            customHours={assignment.customHours}
            shiftDefaultHours={shiftDefaultHours}
            isOnCall={assignment.isOnCall}
            isPinned={assignment.isPinned}
            note={assignment.note}
            onCustomHoursClick={() => setShowPopover(true)}
            compact
          />
        ) : (
          <div className={`
            rounded border-2 border-dashed px-3 py-1 text-center text-xs
            ${isOver ? 'border-brand-500/50 text-brand-500' : 'border-border text-faint'}
          `}>
            {isOver ? 'Drop here' : '—'}
          </div>
        )}
      </div>

      {showPopover && hasEmployee && (
        <ShiftPopover
          defaultHours={shiftDefaultHours}
          customHours={assignment.customHours}
          onChange={(hours) => onCustomHoursChange?.(positionId, hours)}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  );
}
