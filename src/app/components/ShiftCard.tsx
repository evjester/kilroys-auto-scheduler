'use client';

import { useState } from 'react';
import type { Assignment } from '@/lib/types';
import { ROLE_COLORS, PRIME_TIER_COLORS } from '@/lib/mock-config';
import MetricsBadge from './MetricsBadge';
import ReasoningPanel from './ReasoningPanel';

interface Props {
  assignment: Assignment;
}

export default function ShiftCard({ assignment }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { shiftSlot, employee, totalScore } = assignment;
  const tierStyle = PRIME_TIER_COLORS[shiftSlot.primeTier];
  const roleColor = ROLE_COLORS[shiftSlot.requiredRole] || 'bg-gray-100 text-gray-800';

  return (
    <div className={`rounded-lg border ${tierStyle.border} ${tierStyle.bg} p-2.5 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${tierStyle.dot}`} />
            <span className="truncate text-sm font-semibold text-gray-900">
              {employee.name}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${roleColor}`}>
              {employee.role}
            </span>
            <span className="text-xs text-faint">
              {shiftSlot.startTime}–{shiftSlot.endTime}
            </span>
          </div>
        </div>
        <MetricsBadge score={Math.round(totalScore)} size="sm" />
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex w-full items-center gap-1 text-xs text-faint hover:text-gray-700 transition-colors"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {expanded ? 'Hide reasoning' : 'Why this assignment?'}
      </button>

      {expanded && (
        <ReasoningPanel assignment={assignment} />
      )}
    </div>
  );
}
