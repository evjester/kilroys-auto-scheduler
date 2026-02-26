'use client';

import type { Assignment } from '@/lib/types';
import { DAYS } from '@/lib/mock-config';
import ShiftCard from './ShiftCard';

interface Props {
  assignments: Assignment[];
  weekDates: Record<string, string>;
}

export default function ScheduleGrid({ assignments, weekDates }: Props) {
  // Get unique roles from assignments
  const roles = [...new Set(assignments.map(a => a.shiftSlot.requiredRole))];
  const roleOrder = ['Bartender', 'Barback', 'Server', 'Security', 'Carder'];
  roles.sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-faint w-32">
              Role
            </th>
            {DAYS.map(day => (
              <th key={day} className="border-b border-gray-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-faint min-w-[160px]">
                <div>{day.slice(0, 3)}</div>
                <div className="font-normal text-muted">{weekDates[day]?.slice(5)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map(role => (
            <tr key={role} className="border-b border-gray-100">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 text-sm font-medium text-gray-700 align-top">
                {role}
              </td>
              {DAYS.map(day => {
                const dayAssignments = assignments.filter(
                  a => a.shiftSlot.dayOfWeek === day && a.shiftSlot.requiredRole === role
                );
                // Sort by shift type
                const shiftOrder = ['AM', 'PM', 'Late'];
                dayAssignments.sort((a, b) =>
                  shiftOrder.indexOf(a.shiftSlot.shiftType) - shiftOrder.indexOf(b.shiftSlot.shiftType)
                );

                return (
                  <td key={day} className="px-1.5 py-1.5 align-top">
                    <div className="space-y-1.5">
                      {dayAssignments.length > 0 ? (
                        dayAssignments.map(a => (
                          <ShiftCard key={a.shiftSlot.id} assignment={a} />
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-muted">
                          —
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
