'use client';

import { useEffect, useRef } from 'react';

interface ShiftPopoverProps {
  defaultHours: { start: string; end: string };
  customHours?: { start: string; end: string };
  onChange: (customHours: { start: string; end: string } | undefined) => void;
  onClose: () => void;
}

/** Common half-shift presets relative to a shift's end time */
const HALF_SHIFT_PRESETS = [
  { label: 'Late call 10:30PM', start: '22:30', end: '02:00' },
  { label: 'Late call 10PM', start: '22:00', end: '02:00' },
  { label: 'Late call 11PM', start: '23:00', end: '02:00' },
  { label: 'Early out 10PM', start: '', end: '22:00' },
  { label: 'Early out 12AM', start: '', end: '00:00' },
  { label: 'Morning half 11AM-2PM', start: '11:00', end: '14:00' },
  { label: 'Afternoon 2PM-6PM', start: '14:00', end: '18:00' },
];

export default function ShiftPopover({ defaultHours, customHours, onChange, onClose }: ShiftPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const current = customHours || defaultHours;
  const isCustom = !!customHours;

  const setTime = (field: 'start' | 'end', value: string) => {
    const updated = { ...current, [field]: value };
    onChange(updated);
  };

  const applyPreset = (preset: { start: string; end: string }) => {
    onChange({
      start: preset.start || defaultHours.start,
      end: preset.end || defaultHours.end,
    });
  };

  const resetToDefault = () => {
    onChange(undefined);
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border-strong bg-elevated shadow-xl shadow-black/60"
    >
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">Shift Hours</span>
          {isCustom && (
            <button
              onClick={resetToDefault}
              className="text-xs text-brand-500 hover:text-brand-400"
            >
              Reset to default
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="time"
            value={current.start}
            onChange={e => setTime('start', e.target.value)}
            className="rounded border border-border bg-surface-2 px-1.5 py-1 text-xs text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-24"
          />
          <span className="text-xs text-faint">–</span>
          <input
            type="time"
            value={current.end}
            onChange={e => setTime('end', e.target.value)}
            className="rounded border border-border bg-surface-2 px-1.5 py-1 text-xs text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-24"
          />
        </div>

        <div className="border-t border-border pt-2">
          <span className="text-xs font-medium text-faint mb-1 block">Quick presets</span>
          <div className="flex flex-wrap gap-1">
            {HALF_SHIFT_PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-border bg-overlay px-2 py-0.5 text-xs text-muted hover:bg-brand-500/10 hover:border-brand-500/30 hover:text-brand-400 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
