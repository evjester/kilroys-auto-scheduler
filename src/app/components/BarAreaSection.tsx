'use client';

import type { LineupAssignment, WellPosition } from '@/lib/types';
import WellSlot from './WellSlot';

interface BarAreaSectionProps {
  areaId: string;
  areaName: string;
  positions: WellPosition[];
  assignments: LineupAssignment[];
  shiftDefaultHours: { start: string; end: string };
  onCustomHoursChange: (positionId: string, customHours: { start: string; end: string } | undefined) => void;
}

export default function BarAreaSection({
  areaName,
  positions,
  assignments,
  shiftDefaultHours,
  onCustomHoursChange,
}: BarAreaSectionProps) {
  return (
    <div className="rounded-xl glass-card overflow-hidden">
      <div className="bg-overlay-hover px-4 py-2 border-b border-border">
        <h3 className="text-sm font-bold text-foreground tracking-wide">{areaName}</h3>
      </div>
      <div className="p-2 space-y-1">
        {positions.map(pos => {
          const assignment = assignments.find(a => a.positionId === pos.id);
          return (
            <WellSlot
              key={pos.id}
              positionId={pos.id}
              label={pos.label}
              type={pos.type}
              assignment={assignment}
              shiftDefaultHours={shiftDefaultHours}
              onCustomHoursChange={onCustomHoursChange}
            />
          );
        })}
      </div>
    </div>
  );
}
