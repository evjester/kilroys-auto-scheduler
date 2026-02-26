import { NextRequest, NextResponse } from 'next/server';
import { runScheduler } from '@/lib/scheduler';
import { getCurrentWeekStart } from '@/lib/time-utils';

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get('weekStart') || getCurrentWeekStart();

  try {
    const result = runScheduler(weekStart);

    // Build CSV
    const headers = ['Day', 'Date', 'Shift', 'Role', 'Start', 'End', 'Employee', 'Score', 'Prime Tier'];
    const rows = result.assignments.map(a => [
      a.shiftSlot.dayOfWeek,
      a.shiftSlot.date,
      a.shiftSlot.shiftType,
      a.shiftSlot.requiredRole,
      a.shiftSlot.startTime,
      a.shiftSlot.endTime,
      a.employee.name,
      a.totalScore.toString(),
      `Tier ${a.shiftSlot.primeTier}`,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="schedule-${weekStart}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export schedule' },
      { status: 500 }
    );
  }
}
