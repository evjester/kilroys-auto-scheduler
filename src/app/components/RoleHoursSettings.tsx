'use client';

import { useState } from 'react';
import type { ShiftTemplate } from '@/lib/types';
import { BAR_AREAS } from '@/lib/venue-config';
import { formatTimeCompact } from '@/lib/time-utils';

interface RoleHoursSettingsProps {
  operatingHours: { open: string; close: string };
  onOperatingHoursChange: (hours: { open: string; close: string }) => void;
  shiftTemplates: ShiftTemplate[];
  onShiftTemplatesChange: (templates: ShiftTemplate[]) => void;
  closedBars: Set<string>;
  onClosedBarsChange: (closedBars: Set<string>) => void;
}

function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function RoleHoursSettings({
  operatingHours,
  onOperatingHoursChange,
  shiftTemplates,
  onShiftTemplatesChange,
  closedBars,
  onClosedBarsChange,
}: RoleHoursSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openBarCount = BAR_AREAS.length - closedBars.size;

  const toggleBar = (barId: string) => {
    const next = new Set(closedBars);
    if (next.has(barId)) next.delete(barId);
    else next.add(barId);
    onClosedBarsChange(next);
  };

  const updateTemplate = (id: string, field: 'start' | 'end' | 'label', value: string) => {
    onShiftTemplatesChange(
      shiftTemplates.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  const addTemplate = () => {
    const id = `custom-${Date.now()}`;
    onShiftTemplatesChange([
      ...shiftTemplates,
      { id, label: 'Custom', start: '12:00', end: '20:00' },
    ]);
  };

  const removeTemplate = (id: string) => {
    onShiftTemplatesChange(shiftTemplates.filter(t => t.id !== id));
  };

  const templatesSummary = shiftTemplates
    .map(t => `${t.label} ${formatTimeCompact(t.start)}-${formatTimeCompact(t.end)}`)
    .join(', ');

  return (
    <div className="rounded-xl glass-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-overlay transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-semibold text-secondary">Settings</span>
          <span className="text-xs text-faint">
            Open {formatTime12(operatingHours.open)} – {formatTime12(operatingHours.close)} | {openBarCount}/{BAR_AREAS.length} bars | {shiftTemplates.length} shifts
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-faint transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-3 space-y-4">
          {/* Operating Hours */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">Operating Hours</label>
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-faint mb-0.5">Open</label>
                <input
                  type="time"
                  value={operatingHours.open}
                  onChange={e => onOperatingHoursChange({ ...operatingHours, open: e.target.value })}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <span className="text-faint mt-4">–</span>
              <div>
                <label className="block text-xs text-faint mb-0.5">Close</label>
                <input
                  type="time"
                  value={operatingHours.close}
                  onChange={e => onOperatingHoursChange({ ...operatingHours, close: e.target.value })}
                  className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Bars Open/Closed */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">Bars Open This Shift</label>
            <div className="flex flex-wrap gap-2">
              {BAR_AREAS.map(area => {
                const isClosed = closedBars.has(area.id);
                return (
                  <button
                    key={area.id}
                    onClick={() => toggleBar(area.id)}
                    className={`
                      rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border
                      ${isClosed
                        ? 'bg-overlay text-faint border-border line-through'
                        : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                      }
                    `}
                  >
                    {area.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shift Templates */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">Shift Templates</label>
            <div className="space-y-2">
              {shiftTemplates.map(tmpl => (
                <div key={tmpl.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tmpl.label}
                    onChange={e => updateTemplate(tmpl.id, 'label', e.target.value)}
                    className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-foreground w-24 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <input
                    type="time"
                    value={tmpl.start}
                    onChange={e => updateTemplate(tmpl.id, 'start', e.target.value)}
                    className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <span className="text-xs text-faint">–</span>
                  <input
                    type="time"
                    value={tmpl.end}
                    onChange={e => updateTemplate(tmpl.id, 'end', e.target.value)}
                    className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  {tmpl.id.startsWith('custom-') && (
                    <button
                      onClick={() => removeTemplate(tmpl.id)}
                      className="text-xs text-faint hover:text-red-400"
                      title="Remove template"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTemplate}
                className="rounded border border-dashed border-border px-2 py-1 text-xs font-medium text-faint hover:border-border-strong hover:text-secondary transition-colors"
              >
                + Add Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
