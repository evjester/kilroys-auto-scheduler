'use client';

import type { ShiftPeriod, ShiftTemplate } from '@/lib/types';
import { formatTimeCompact } from '@/lib/time-utils';

interface ShiftSelectorProps {
  selectedShift: ShiftPeriod;
  onSelectShift: (shift: ShiftPeriod) => void;
  shiftTemplates: ShiftTemplate[];
  disabledShifts: Set<ShiftPeriod>;
  onToggleShift: (shift: ShiftPeriod) => void;
}

export default function ShiftSelector({ selectedShift, onSelectShift, shiftTemplates, disabledShifts, onToggleShift }: ShiftSelectorProps) {
  return (
    <div className="flex gap-1 glass rounded-lg p-1">
      {shiftTemplates.map(tmpl => {
        const period = tmpl.id as ShiftPeriod;
        const isDisabled = disabledShifts.has(period);
        const isSelected = period === selectedShift && !isDisabled;

        return (
          <div key={tmpl.id} className="relative flex items-center">
            <button
              onClick={() => {
                if (isDisabled) {
                  onToggleShift(period);
                  onSelectShift(period);
                } else {
                  onSelectShift(period);
                }
              }}
              className={`
                flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${isDisabled
                  ? 'text-faint line-through'
                  : isSelected
                    ? 'bg-overlay-medium text-brand-500 shadow-sm'
                    : 'text-muted hover:text-foreground hover:bg-overlay'
                }
              `}
            >
              <span>{tmpl.label}</span>
              <span className={`text-xs ${isDisabled ? 'text-faint' : isSelected ? 'text-brand-500' : 'text-faint'}`}>
                {formatTimeCompact(tmpl.start)}-{formatTimeCompact(tmpl.end)}
              </span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleShift(period);
              }}
              className={`
                ml-0.5 rounded p-0.5 text-xs transition-colors
                ${isDisabled
                  ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                  : 'text-faint hover:text-red-400 hover:bg-red-500/10'
                }
              `}
              title={isDisabled ? `Enable ${tmpl.label}` : `Disable ${tmpl.label}`}
            >
              {isDisabled ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
