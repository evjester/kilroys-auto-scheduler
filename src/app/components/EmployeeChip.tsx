'use client';

import { useState, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ROLE_COLORS } from '@/lib/mock-config';
import WellPreferencePopover from './WellPreferencePopover';

interface EmployeeChipProps {
  employeeId: string;
  employeeName: string;
  performanceScore: number;
  role: string;
  customHours?: { start: string; end: string };
  shiftDefaultHours?: { start: string; end: string };
  isOnCall?: boolean;
  note?: string;
  isPreferred?: boolean;
  isUnavailable?: boolean;
  isPlaced?: boolean;
  isDouble?: boolean;
  isPinned?: boolean;
  onCustomHoursClick?: () => void;
  onTogglePreferred?: () => void;
  onPreferWithWell?: (positionId: string | undefined) => void;
  preferredPositionId?: string;
  lineupType?: 'bartender' | 'security';
  compact?: boolean;
  dragIdPrefix?: string;
}

export default function EmployeeChip({
  employeeId,
  employeeName,
  performanceScore,
  role,
  customHours,
  shiftDefaultHours,
  isOnCall,
  note,
  isPreferred,
  isUnavailable,
  isPlaced,
  isDouble,
  isPinned,
  onCustomHoursClick,
  onTogglePreferred,
  onPreferWithWell,
  preferredPositionId,
  lineupType,
  compact,
  dragIdPrefix,
}: EmployeeChipProps) {
  const [showWellPopover, setShowWellPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const starRef = useRef<HTMLButtonElement>(null);
  const draggableId = dragIdPrefix ? `${dragIdPrefix}-${employeeId}` : employeeId;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { employeeId, employeeName, performanceScore, role },
    disabled: isUnavailable,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const roleColor = ROLE_COLORS[role] || 'bg-overlay-hover text-muted';

  const isHalf = !!customHours;

  const formatHour = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
  };

  const displayHours = customHours || (compact ? shiftDefaultHours : undefined);
  const hoursDisplay = displayHours ? `${formatHour(displayHours.start)}-${formatHour(displayHours.end)}` : '';

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPreferred) {
      onTogglePreferred?.();
    } else if (onPreferWithWell && starRef.current) {
      const rect = starRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: rect.left });
      setShowWellPopover(true);
    } else {
      onTogglePreferred?.();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-shadow max-w-full
        ${isUnavailable
          ? 'opacity-40 border-border bg-overlay-subtle cursor-not-allowed'
          : isDragging
            ? 'opacity-50 border-brand-400 bg-brand-500/10 shadow-lg z-50 cursor-grabbing'
            : isPlaced
              ? 'border-border bg-overlay-subtle opacity-60 cursor-grab'
              : 'border-border bg-white/[0.05] hover:border-border-strong hover:bg-overlay-hover cursor-grab'
        }
        ${compact ? 'text-xs' : 'text-sm'}
      `}
    >
      {onTogglePreferred && (
        <button
          ref={starRef}
          onClick={handleStarClick}
          className={`text-sm leading-none ${isPreferred ? 'text-amber-400' : 'text-faint hover:text-amber-400'}`}
          title={isPreferred ? 'Remove preference' : 'Set well preference'}
        >
          ★
        </button>
      )}
      {showWellPopover && onPreferWithWell && (
        <WellPreferencePopover
          currentPositionId={preferredPositionId}
          position={popoverPos}
          onSelect={(posId) => {
            onPreferWithWell(posId);
            setShowWellPopover(false);
          }}
          onClose={() => setShowWellPopover(false)}
          lineupType={lineupType}
        />
      )}
      <span className={`font-medium whitespace-nowrap overflow-hidden text-ellipsis ${isUnavailable ? 'text-faint line-through' : 'text-foreground'}`}>
        {employeeName}
      </span>
      {isPinned && (
        <span className="shrink-0" aria-label="Pinned placement">
          <svg className="h-3 w-3 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </span>
      )}
      {isHalf && <span className="text-red-400 font-bold text-xs leading-none">**</span>}
      {hoursDisplay && (
        onCustomHoursClick ? (
          <button
            onClick={(e) => { e.stopPropagation(); onCustomHoursClick(); }}
            className={`text-xs whitespace-nowrap hover:underline ${isHalf ? 'text-red-400 hover:text-red-300' : 'text-faint hover:text-brand-500'}`}
            title="Click to edit hours"
          >
            {hoursDisplay}
          </button>
        ) : (
          <span className={`text-xs whitespace-nowrap ${isHalf ? 'text-red-400' : 'text-faint'}`}>{hoursDisplay}</span>
        )
      )}
      {isOnCall && (
        <span className="text-xs text-amber-400 font-medium">(OC)</span>
      )}
{note && (
        <span className="text-xs text-faint">({note})</span>
      )}
      {isUnavailable && (
        <span className="rounded bg-red-500/20 px-1 py-0.5 text-xs font-medium text-red-400">OFF</span>
      )}
      {!isUnavailable && !compact && (
        <span className={`inline-flex rounded px-1 py-0.5 text-xs font-medium ${roleColor}`}>
          {performanceScore}
        </span>
      )}
    </div>
  );
}
