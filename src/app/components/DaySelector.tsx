'use client';

import type { DayOfWeek } from '@/lib/types';
import { DAYS } from '@/lib/mock-config';

interface DaySelectorProps {
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  dates?: Record<string, string>;
}

export default function DaySelector({ selectedDay, onSelectDay, dates }: DaySelectorProps) {
  return (
    <div className="flex gap-1 glass rounded-lg p-1">
      {DAYS.map(day => {
        const isSelected = day === selectedDay;
        const dateStr = dates?.[day];
        return (
          <button
            key={day}
            onClick={() => onSelectDay(day)}
            className={`
              flex flex-col items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors
              ${isSelected
                ? 'bg-overlay-medium text-brand-500 shadow-sm'
                : 'text-muted hover:text-foreground hover:bg-overlay'
              }
            `}
          >
            <span>{day.slice(0, 3)}</span>
            {dateStr && (
              <span className="text-xs text-faint">{dateStr.slice(5)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
