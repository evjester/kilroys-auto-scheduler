import { NextResponse } from 'next/server';
import { ingestAllData } from '@/lib/ingest';
import { buildEmployeeProfiles } from '@/lib/metrics';

export async function GET() {
  try {
    const data = ingestAllData();
    const profiles = buildEmployeeProfiles(
      data.employees,
      data.availability,
      data.timeOff,
      data.shifts,
      data.employeeTips,
      data.laborReport
    );

    // Sort by performance score descending
    profiles.sort((a, b) => b.performanceScore - a.performanceScore);

    return NextResponse.json({ employees: profiles });
  } catch (error) {
    console.error('Employee data error:', error);
    return NextResponse.json(
      { error: 'Failed to load employee data', details: String(error) },
      { status: 500 }
    );
  }
}
