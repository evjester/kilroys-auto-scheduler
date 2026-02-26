import { NextRequest, NextResponse } from 'next/server';
import { runScheduler } from '@/lib/scheduler';
import { getCurrentWeekStart } from '@/lib/time-utils';

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get('weekStart') || getCurrentWeekStart();

  try {
    const result = runScheduler(weekStart);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Schedule generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate schedule', details: String(error) },
      { status: 500 }
    );
  }
}
