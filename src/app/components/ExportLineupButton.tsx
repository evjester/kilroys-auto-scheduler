'use client';

import { useState } from 'react';
import type { ShiftLineup, DayOfWeek, ShiftPeriod } from '@/lib/types';
import { renderLineupImage } from '@/lib/lineup-image-renderer';

interface ExportLineupButtonProps {
  shiftLineup: ShiftLineup | undefined;
  selectedDay: DayOfWeek;
  selectedShift: ShiftPeriod;
  date: string;
  closedBars: Set<string>;
  lineupType: 'bartender' | 'security';
}

const SHIFT_ABBR: Record<ShiftPeriod, string> = {
  'morning': 'AM',
  'happy-hour': 'HH',
  'night': 'CL',
};

export default function ExportLineupButton({
  shiftLineup,
  selectedDay,
  selectedShift,
  date,
  closedBars,
  lineupType,
}: ExportLineupButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    if (!shiftLineup) return;
    setDownloading(true);

    try {
      const blob = await renderLineupImage({
        shiftLineup,
        selectedDay,
        selectedShift,
        date,
        closedBars,
        lineupType,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const prefix = lineupType === 'security' ? 'security-lineup' : 'lineup';
      const abbr = SHIFT_ABBR[selectedShift];
      a.href = url;
      a.download = `${prefix}-${selectedDay}-${abbr}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={!shiftLineup || downloading}
      className={`
        glass rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
        text-secondary hover:text-foreground hover:bg-overlay-hover
        disabled:opacity-40 disabled:cursor-not-allowed
      `}
    >
      {downloading ? 'Exporting...' : 'Export Lineup'}
    </button>
  );
}
