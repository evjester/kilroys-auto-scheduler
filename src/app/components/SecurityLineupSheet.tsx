'use client';

import type { ShiftLineup } from '@/lib/types';
import { SECURITY_AREAS } from '@/lib/security-venue-config';
import BarAreaSection from './BarAreaSection';

interface SecurityLineupSheetProps {
  shiftLineup: ShiftLineup;
  onCustomHoursChange: (positionId: string, customHours: { start: string; end: string } | undefined) => void;
}

export default function SecurityLineupSheet({ shiftLineup, onCustomHoursChange }: SecurityLineupSheetProps) {
  // Pair security areas into 2-column rows
  const areaPairs: [string, string | null][] = [
    ['carders', 'exit-doors'],
    ['fixed-posts', 'back-of-house'],
    ['roam-old-bar', 'roam-new-bar'],
    ['roam-duffys-bar', 'roam-patio-bar'],
    ['roam-upstairs-bar', null],
  ];

  return (
    <div className="space-y-3">
      {areaPairs.map(([leftId, rightId]) => {
        const leftArea = SECURITY_AREAS.find(a => a.id === leftId);
        const rightArea = rightId ? SECURITY_AREAS.find(a => a.id === rightId) : null;
        if (!leftArea) return null;

        const leftAssignments = shiftLineup.areas.find(a => a.areaId === leftId)?.assignments || [];
        const rightAssignments = rightId ? shiftLineup.areas.find(a => a.areaId === rightId)?.assignments || [] : [];

        return (
          <div key={`${leftId}-${rightId}`} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BarAreaSection
              areaId={leftArea.id}
              areaName={leftArea.name}
              positions={leftArea.positions}
              assignments={leftAssignments}
              shiftDefaultHours={shiftLineup.shiftHours}
              onCustomHoursChange={onCustomHoursChange}
            />
            {rightArea ? (
              <BarAreaSection
                areaId={rightArea.id}
                areaName={rightArea.name}
                positions={rightArea.positions}
                assignments={rightAssignments}
                shiftDefaultHours={shiftLineup.shiftHours}
                onCustomHoursChange={onCustomHoursChange}
              />
            ) : (
              <div />
            )}
          </div>
        );
      })}
    </div>
  );
}
