'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BAR_AREAS } from '@/lib/venue-config';
import { SECURITY_AREAS } from '@/lib/security-venue-config';

interface WellPreferencePopoverProps {
  currentPositionId?: string;
  position: { top: number; left: number };
  onSelect: (positionId: string | undefined) => void;
  onClose: () => void;
  lineupType?: 'bartender' | 'security';
}

// ============================================================
// Bartender positions
// ============================================================

const SPEED_WELLS = BAR_AREAS.flatMap(area =>
  area.positions
    .filter(p => p.type === 'speed')
    .map(p => ({ positionId: p.id, label: `${area.name} ${p.label}`, speedRank: p.speedRank ?? 99 }))
).sort((a, b) => a.speedRank - b.speedRank);

const STANDARD_WELLS_BY_BAR = BAR_AREAS
  .filter(area => area.id !== 'servers')
  .map(area => ({
    barName: area.name,
    positions: area.positions
      .filter(p => p.type === 'standard')
      .map(p => ({ positionId: p.id, label: p.label })),
  }))
  .filter(g => g.positions.length > 0);

// ============================================================
// Security positions grouped by area
// ============================================================

const SECURITY_GROUPS = SECURITY_AREAS.map(area => ({
  areaName: area.name,
  positions: area.positions.map(p => ({ positionId: p.id, label: p.label })),
}));

export default function WellPreferencePopover({ currentPositionId, position, onSelect, onClose, lineupType = 'bartender' }: WellPreferencePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Delay to avoid the star click itself closing the popover
    const timer = setTimeout(() => document.addEventListener('mousedown', handle), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handle);
    };
  }, [onClose]);

  // Adjust position if popover would overflow viewport bottom
  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        ref.current.style.top = `${position.top - rect.height - 8}px`;
      }
    }
  }, [position]);

  const popover = (
    <div
      ref={ref}
      style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
      className="w-56 rounded-lg border border-border-strong py-1 max-h-72 overflow-y-auto bg-elevated shadow-xl shadow-black/60"
    >
      {/* No specific well */}
      <button
        onClick={() => onSelect(undefined)}
        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-overlay-hover ${
          !currentPositionId ? 'font-semibold text-brand-500' : 'text-secondary'
        }`}
      >
        No specific position
      </button>

      <div className="border-t border-border my-1" />

      {lineupType === 'bartender' ? (
        <>
          {/* Speed wells section */}
          <div className="px-3 py-1">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Speed Wells</span>
          </div>
          {SPEED_WELLS.map(w => (
            <button
              key={w.positionId}
              onClick={() => onSelect(w.positionId)}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-amber-500/10 ${
                currentPositionId === w.positionId ? 'font-semibold text-amber-400 bg-amber-500/10' : 'text-secondary'
              }`}
            >
              {w.label}
            </button>
          ))}

          <div className="border-t border-border my-1" />

          {/* Standard wells by bar */}
          {STANDARD_WELLS_BY_BAR.map(group => (
            <div key={group.barName}>
              <div className="px-3 py-1">
                <span className="text-xs font-bold text-faint uppercase tracking-wide">{group.barName}</span>
              </div>
              {group.positions.map(p => (
                <button
                  key={p.positionId}
                  onClick={() => onSelect(p.positionId)}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-overlay-hover ${
                    currentPositionId === p.positionId ? 'font-semibold text-brand-500 bg-brand-500/10' : 'text-secondary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          {/* Security positions by area */}
          {SECURITY_GROUPS.map(group => (
            <div key={group.areaName}>
              <div className="px-3 py-1">
                <span className="text-xs font-bold text-faint uppercase tracking-wide">{group.areaName}</span>
              </div>
              {group.positions.map(p => (
                <button
                  key={p.positionId}
                  onClick={() => onSelect(p.positionId)}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-overlay-hover ${
                    currentPositionId === p.positionId ? 'font-semibold text-brand-500 bg-brand-500/10' : 'text-secondary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );

  return createPortal(popover, document.body);
}
