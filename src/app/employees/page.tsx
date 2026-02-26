'use client';

import { useEffect, useState } from 'react';
import type { EmployeeProfile } from '@/lib/types';
import EmployeeTable from '../components/EmployeeTable';
import StatCard from '../components/StatCard';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(data => { setEmployees(data.employees); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-overlay-hover" />
        <div className="h-96 rounded-xl bg-overlay" />
      </div>
    );
  }

  // Only Bartenders and Servers have meaningful performance scores (Toast POS data)
  const barStaff = employees.filter(e => e.primaryRole === 'Bartender' || e.primaryRole === 'Server');
  const avgScore = barStaff.length > 0
    ? Math.round(barStaff.reduce((s, e) => s + e.performanceScore, 0) / barStaff.length)
    : 0;
  const topPerformers = barStaff.filter(e => e.performanceScore >= 75).length;
  const avgReliability = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.reliabilityScore, 0) / employees.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Employee Metrics</h1>
        <p className="text-sm text-muted">
          Performance data from Toast POS — {employees.length} employees
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Staff" value={employees.length.toString()} color="blue" />
        <StatCard label="Avg Bar Score" value={avgScore.toString()} color="purple" subtitle="BT + Server" />
        <StatCard label="Top Performers" value={topPerformers.toString()} color="green" subtitle="Score 75+" />
        <StatCard label="Avg Reliability" value={`${avgReliability}%`} color="indigo" />
      </div>

      <EmployeeTable employees={employees} />
    </div>
  );
}
