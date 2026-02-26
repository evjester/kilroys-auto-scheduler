'use client';

import type { WeekConfig, DayOfWeek } from '@/lib/types';
import { DAYS } from '@/lib/mock-config';

interface WeekSetupBarProps {
  weekConfig: WeekConfig;
  onWeekConfigChange: (config: WeekConfig) => void;
  selectedDay: DayOfWeek;
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'M',
  Tuesday: 'T',
  Wednesday: 'W',
  Thursday: 'Th',
  Friday: 'F',
  Saturday: 'Sa',
  Sunday: 'Su',
};

export default function WeekSetupBar({ weekConfig, onWeekConfigChange, selectedDay }: WeekSetupBarProps) {
  const toggleDayOpen = (day: DayOfWeek) => {
    const updated = {
      ...weekConfig,
      templateId: 'custom',
      days: {
        ...weekConfig.days,
        [day]: { ...weekConfig.days[day], open: !weekConfig.days[day].open },
      },
    };
    onWeekConfigChange(updated);
  };

  return (
    <div className="flex items-center gap-4 glass-card rounded-xl px-4 py-2.5">
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-faint mr-1">Days</span>
        {DAYS.map(day => {
          const isOpen = weekConfig.days[day]?.open !== false;
          const isSelected = day === selectedDay;
          return (
            <button
              key={day}
              onClick={() => toggleDayOpen(day)}
              className={`
                w-8 h-7 rounded text-xs font-semibold transition-colors
                ${isOpen
                  ? isSelected
                    ? 'bg-brand-600 text-white'
                    : 'bg-overlay-hover text-secondary hover:bg-overlay-medium'
                  : 'bg-overlay text-faint line-through hover:bg-overlay-hover'
                }
              `}
              title={`${day}: ${isOpen ? 'Open' : 'Closed'} — click to toggle`}
            >
              {DAY_LABELS[day]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
