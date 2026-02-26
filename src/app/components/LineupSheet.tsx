'use client';

import type { ShiftLineup } from '@/lib/types';
import { BAR_AREAS } from '@/lib/venue-config';
import BarAreaSection from './BarAreaSection';

interface LineupSheetProps {
  shiftLineup: ShiftLineup;
  onCustomHoursChange: (positionId: string, customHours: { start: string; end: string } | undefined) => void;
  closedBars: Set<string>;
}

function formatHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export default function LineupSheet({ shiftLineup, onCustomHoursChange, closedBars }: LineupSheetProps) {
  const areaPairs = [
    ['old-bar', 'new-bar'],
    ['duffys-bar', 'patio-bar'],
    ['upstairs-bar', 'servers'],
  ];

  const halfShifts: { name: string; start: string; end: string }[] = [];
  for (const area of shiftLineup.areas) {
    if (closedBars.has(area.areaId)) continue;
    for (const a of area.assignments) {
      if (a.customHours && a.employeeId) {
        halfShifts.push({ name: a.employeeName, start: a.customHours.start, end: a.customHours.end });
      }
    }
  }

  const byTime = new Map<string, string[]>();
  for (const hs of halfShifts) {
    const timeKey = `${hs.start}-${hs.end}`;
    if (!byTime.has(timeKey)) byTime.set(timeKey, []);
    byTime.get(timeKey)!.push(hs.name);
  }

  return (
    <div className="space-y-3">
      {areaPairs.map(([leftId, rightId]) => {
        const leftClosed = closedBars.has(leftId);
        const rightClosed = closedBars.has(rightId);

        if (leftClosed && rightClosed) return null;

        const leftArea = BAR_AREAS.find(a => a.id === leftId)!;
        const rightArea = BAR_AREAS.find(a => a.id === rightId)!;
        const leftAssignments = shiftLineup.areas.find(a => a.areaId === leftId)?.assignments || [];
        const rightAssignments = shiftLineup.areas.find(a => a.areaId === rightId)?.assignments || [];

        return (
          <div key={`${leftId}-${rightId}`} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {leftClosed ? (
              <div className="rounded-xl border border-dashed border-border bg-overlay-subtle p-4 flex items-center justify-center">
                <span className="text-sm font-medium text-faint">{leftArea.name} — Closed</span>
              </div>
            ) : (
              <BarAreaSection
                areaId={leftArea.id}
                areaName={leftArea.name}
                positions={leftArea.positions}
                assignments={leftAssignments}
                shiftDefaultHours={shiftLineup.shiftHours}
                onCustomHoursChange={onCustomHoursChange}
              />
            )}
            {rightClosed ? (
              <div className="rounded-xl border border-dashed border-border bg-overlay-subtle p-4 flex items-center justify-center">
                <span className="text-sm font-medium text-faint">{rightArea.name} — Closed</span>
              </div>
            ) : (
              <BarAreaSection
                areaId={rightArea.id}
                areaName={rightArea.name}
                positions={rightArea.positions}
                assignments={rightAssignments}
                shiftDefaultHours={shiftLineup.shiftHours}
                onCustomHoursChange={onCustomHoursChange}
              />
            )}
          </div>
        );
      })}

      {halfShifts.length > 0 && (
        <div className="glass-card rounded-lg px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {[...byTime.entries()].map(([timeKey, names]) => {
              const [start, end] = timeKey.split('-');
              return (
                <span key={timeKey} className="text-sm">
                  <span className="text-red-400 font-bold">**</span>{' '}
                  <span className="font-medium text-secondary">{names.join(', ')}</span>{' '}
                  <span className="text-red-400 font-medium">{formatHour(start)} - {formatHour(end)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
