'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DailyLineup, DayOfWeek, EmployeeProfile, SidebarFilters, ShiftPeriod, ShiftLineup, WeekConfig, GenerationConfig } from '@/lib/types';
import { DEFAULT_SHIFT_TEMPLATES, DEFAULT_SHIFT_CLOSED_BARS } from '@/lib/mock-config';
import { buildWeekConfig } from '@/lib/week-templates';
import { getCurrentWeekStart } from '@/lib/time-utils';
import DaySelector from '../components/DaySelector';
import ShiftSelector from '../components/ShiftSelector';

import RoleHoursSettings from '../components/RoleHoursSettings';
import LineupSheet from '../components/LineupSheet';
import SecurityLineupSheet from '../components/SecurityLineupSheet';
import EmployeeSidebar from '../components/EmployeeSidebar';
import EmployeeChip from '../components/EmployeeChip';
import StatCard from '../components/StatCard';
import GeneratePanel from '../components/GeneratePanel';
import ExportLineupButton from '../components/ExportLineupButton';

const PREFERRED_STORAGE_KEY = 'kilroys-preferred-employees';
const PREFERRED_V2_STORAGE_KEY = 'kilroys-preferred-employees-v2';
const SEC_PREFERRED_V2_STORAGE_KEY = 'kilroys-preferred-security-v2';
const WEEK_CONFIG_STORAGE_KEY = 'kilroys-week-config';

type PreferredMap = Record<string, { positionId?: string }>;

function loadPreferredMap(): PreferredMap {
  try {
    const v2 = localStorage.getItem(PREFERRED_V2_STORAGE_KEY);
    if (v2) return JSON.parse(v2);
    // Migrate from v1 Set<string> format
    const v1 = localStorage.getItem(PREFERRED_STORAGE_KEY);
    if (v1) {
      const ids: string[] = JSON.parse(v1);
      const map: PreferredMap = {};
      for (const id of ids) map[id] = {};
      return map;
    }
  } catch { /* ignore */ }
  return {};
}

function savePreferredMap(map: PreferredMap) {
  try {
    localStorage.setItem(PREFERRED_V2_STORAGE_KEY, JSON.stringify(map));
    localStorage.setItem(PREFERRED_STORAGE_KEY, JSON.stringify(Object.keys(map)));
  } catch { /* ignore */ }
}

function loadWeekConfig(): WeekConfig | null {
  try {
    const raw = localStorage.getItem(WEEK_CONFIG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveWeekConfig(config: WeekConfig) {
  try {
    localStorage.setItem(WEEK_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

export default function SchedulePage() {
  const [lineups, setLineups] = useState<DailyLineup[]>([]);
  const [securityLineups, setSecurityLineups] = useState<DailyLineup[]>([]);
  const [activeLineupType, setActiveLineupType] = useState<'bartender' | 'security'>('bartender');
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Saturday');
  const [selectedShift, setSelectedShift] = useState<ShiftPeriod>('night');
  const [weekConfig, setWeekConfig] = useState<WeekConfig>(() => buildWeekConfig('normal', DEFAULT_SHIFT_TEMPLATES));
  const [preferredMap, setPreferredMap] = useState<PreferredMap>({});
  const [secPreferredMap, setSecPreferredMap] = useState<PreferredMap>({});
  const [filters, setFilters] = useState<SidebarFilters>({
    available: false,
    topPerformers: false,
    managementPreferred: false,
    unavailable: false,
  });
  const preferredIds = useMemo(() => new Set(Object.keys(preferredMap)), [preferredMap]);
  const secPreferredIds = useMemo(() => new Set(Object.keys(secPreferredMap)), [secPreferredMap]);
  const [postMessage, setPostMessage] = useState<string | null>(null);
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [generateMode, setGenerateMode] = useState<'day' | 'week'>('week');
  const clearMenuRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  const [activeDrag, setActiveDrag] = useState<{
    employeeId: string;
    employeeName: string;
    performanceScore: number;
    role: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Derive values from weekConfig
  const shiftTemplates = weekConfig.shiftTemplates;
  const dayConfig = weekConfig.days[selectedDay];
  const disabledShifts = new Set<ShiftPeriod>(dayConfig?.disabledShifts || []);
  const closedBars = new Set(
    dayConfig?.closedBars?.[selectedShift] ?? DEFAULT_SHIFT_CLOSED_BARS[selectedShift] ?? []
  );

  // Load saved data from localStorage on mount
  useEffect(() => {
    setPreferredMap(loadPreferredMap());
    try {
      const secRaw = localStorage.getItem(SEC_PREFERRED_V2_STORAGE_KEY);
      if (secRaw) setSecPreferredMap(JSON.parse(secRaw));
    } catch { /* ignore */ }
    const saved = loadWeekConfig();
    if (saved) setWeekConfig(saved);
    initialLoadDone.current = true;
  }, []);

  // Persist preferred list whenever it changes
  useEffect(() => {
    if (initialLoadDone.current) savePreferredMap(preferredMap);
  }, [preferredMap]);

  // Persist security preferred list
  useEffect(() => {
    if (initialLoadDone.current) {
      try { localStorage.setItem(SEC_PREFERRED_V2_STORAGE_KEY, JSON.stringify(secPreferredMap)); } catch { /* ignore */ }
    }
  }, [secPreferredMap]);

  // Persist weekConfig whenever it changes
  useEffect(() => {
    if (initialLoadDone.current) saveWeekConfig(weekConfig);
  }, [weekConfig]);

  // Close clear menu on outside click
  useEffect(() => {
    if (!showClearMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (clearMenuRef.current && !clearMenuRef.current.contains(e.target as Node)) {
        setShowClearMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showClearMenu]);

  useEffect(() => {
    Promise.all([
      fetch('/api/lineup').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ]).then(([lineupData, empData]) => {
      setLineups(lineupData.lineups);
      if (lineupData.securityLineups) setSecurityLineups(lineupData.securityLineups);
      setEmployees(empData.employees);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Two-level navigation: day -> shift
  const currentDay = lineups.find(l => l.dayOfWeek === selectedDay);
  const currentShiftLineup = currentDay?.shifts.find(s => s.shiftPeriod === selectedShift);

  const currentSecDay = securityLineups.find(l => l.dayOfWeek === selectedDay);
  const currentSecShiftLineup = currentSecDay?.shifts.find(s => s.shiftPeriod === selectedShift);

  // Active lineup and preferences based on toggle
  const activePreferredMap = activeLineupType === 'bartender' ? preferredMap : secPreferredMap;
  const activePreferredIds = activeLineupType === 'bartender' ? preferredIds : secPreferredIds;

  // Employees placed in the current shift (dimmed in sidebar)
  const placedEmployeeIds = new Set<string>();
  const activeShiftLineup = activeLineupType === 'bartender' ? currentShiftLineup : currentSecShiftLineup;
  if (activeShiftLineup) {
    for (const area of activeShiftLineup.areas) {
      if (activeLineupType === 'bartender' && closedBars.has(area.areaId)) continue;
      for (const a of area.assignments) {
        if (a.employeeId) placedEmployeeIds.add(a.employeeId);
      }
    }
  }

  // Employees placed in other shifts today (shown with double indicator)
  const placedInOtherShifts = new Set<string>();
  const activeDay = activeLineupType === 'bartender' ? currentDay : currentSecDay;
  if (activeDay) {
    for (const shift of activeDay.shifts) {
      if (shift.shiftPeriod === selectedShift) continue;
      for (const area of shift.areas) {
        for (const a of area.assignments) {
          if (a.employeeId) placedInOtherShifts.add(a.employeeId);
        }
      }
    }
  }

  // Filter employees for sidebar based on active lineup type
  const BAR_ROLES = new Set(['Bartender', 'Barback', 'Server', 'Bar Manager', 'Lead Bartender']);
  const SEC_ROLES = new Set(['Security', 'Carder']);
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (activeLineupType === 'bartender') {
        return e.roles.some(r => BAR_ROLES.has(r));
      }
      return e.roles.some(r => SEC_ROLES.has(r));
    });
  }, [employees, activeLineupType]);

  // Stats from current shift (based on active lineup)
  const openAreas = activeLineupType === 'bartender'
    ? (currentShiftLineup?.areas.filter(a => !closedBars.has(a.areaId)) || [])
    : (currentSecShiftLineup?.areas || []);
  const filledCount = openAreas.reduce((sum, a) => sum + a.assignments.filter(x => x.employeeId).length, 0);
  const totalPositions = openAreas.reduce((sum, a) => sum + a.assignments.length, 0);
  const avgScore = (() => {
    const scores = openAreas.flatMap(a => a.assignments.filter(x => x.employeeId).map(x => x.performanceScore));
    return scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10 : 0;
  })();

  const dates: Record<string, string> = {};
  for (const l of lineups) {
    dates[l.dayOfWeek] = l.date;
  }

  // Handle custom hours override on a specific position in the current shift
  const handleCustomHoursChange = useCallback((positionId: string, customHours: { start: string; end: string } | undefined) => {
    setLineups(prev => prev.map(l => {
      if (l.dayOfWeek !== selectedDay) return l;
      return {
        ...l,
        shifts: l.shifts.map(s => {
          if (s.shiftPeriod !== selectedShift) return s;
          return {
            ...s,
            areas: s.areas.map(a => ({
              ...a,
              assignments: a.assignments.map(assign =>
                assign.positionId === positionId ? { ...assign, customHours } : assign
              ),
            })),
          };
        }),
      };
    }));
  }, [selectedDay, selectedShift]);

  const handlePanelGenerate = useCallback(async (config: GenerationConfig) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: getCurrentWeekStart(),
          generationConfig: config,
          lineupType: activeLineupType,
          preferredEmployeeIds: [...preferredIds],
          wellPreferences: Object.entries(preferredMap)
            .filter(([, e]) => e.positionId)
            .map(([empId, e]) => ({ employeeId: empId, positionId: e.positionId! })),
          securityPreferredEmployeeIds: [...secPreferredIds],
          securityWellPreferences: Object.entries(secPreferredMap)
            .filter(([, e]) => e.positionId)
            .map(([empId, e]) => ({ employeeId: empId, positionId: e.positionId! })),
        }),
      });
      const data = await res.json();

      if (config.mode === 'day' && config.targetDay) {
        if (activeLineupType === 'bartender' && data.lineups) {
          const freshDay = data.lineups.find((l: DailyLineup) => l.dayOfWeek === config.targetDay);
          if (freshDay) {
            const hours = currentDay?.operatingHours;
            const withHours = hours ? { ...freshDay, operatingHours: hours } : freshDay;
            setLineups(prev => prev.map(l => l.dayOfWeek === config.targetDay ? withHours : l));
          }
        }
        if (activeLineupType === 'security' && data.securityLineups) {
          const freshSecDay = data.securityLineups.find((l: DailyLineup) => l.dayOfWeek === config.targetDay);
          if (freshSecDay) {
            const hours = currentDay?.operatingHours;
            const withHours = hours ? { ...freshSecDay, operatingHours: hours } : freshSecDay;
            setSecurityLineups(prev => prev.map(l => l.dayOfWeek === config.targetDay ? withHours : l));
          }
        }
      } else {
        if (activeLineupType === 'bartender' && data.lineups) {
          const hoursMap = new Map(lineups.map(l => [l.dayOfWeek, l.operatingHours]));
          const refreshed = data.lineups.map((l: DailyLineup) => ({
            ...l,
            operatingHours: hoursMap.get(l.dayOfWeek) || l.operatingHours,
          }));
          setLineups(refreshed);
        }
        if (activeLineupType === 'security' && data.securityLineups) {
          const hoursMap = new Map(securityLineups.map(l => [l.dayOfWeek, l.operatingHours]));
          const refreshed = data.securityLineups.map((l: DailyLineup) => ({
            ...l,
            operatingHours: hoursMap.get(l.dayOfWeek) || l.operatingHours,
          }));
          setSecurityLineups(refreshed);
        }
      }

      setShowGeneratePanel(false);
    } catch { /* error */ } finally {
      setGenerating(false);
    }
  }, [lineups, securityLineups, preferredIds, preferredMap, secPreferredIds, secPreferredMap, currentDay, activeLineupType]);

  const handlePostSchedule = useCallback(() => {
    setPostMessage('Schedule ready to publish to 7shifts! (Integration coming soon)');
    setTimeout(() => setPostMessage(null), 4000);
  }, []);

  /** Clear all employee assignments from a shift lineup, keeping position structure intact */
  const clearShiftLineup = (shift: ShiftLineup): ShiftLineup => ({
    ...shift,
    areas: shift.areas.map(a => ({
      ...a,
      assignments: a.assignments.map(assign => ({
        ...assign,
        employeeId: null,
        employeeName: '',
        performanceScore: 0,
        role: '',
        customHours: undefined,
        isPinned: undefined,
        note: undefined,
      })),
    })),
    unassigned: [],
  });

  const handleClearShift = useCallback(() => {
    const setter = activeLineupType === 'bartender' ? setLineups : setSecurityLineups;
    setter(prev => prev.map(l => {
      if (l.dayOfWeek !== selectedDay) return l;
      return {
        ...l,
        shifts: l.shifts.map(s => s.shiftPeriod === selectedShift ? clearShiftLineup(s) : s),
      };
    }));
  }, [selectedDay, selectedShift, activeLineupType]);

  const handleClearDay = useCallback(() => {
    const setter = activeLineupType === 'bartender' ? setLineups : setSecurityLineups;
    setter(prev => prev.map(l => {
      if (l.dayOfWeek !== selectedDay) return l;
      return { ...l, shifts: l.shifts.map(s => clearShiftLineup(s)) };
    }));
  }, [selectedDay, activeLineupType]);

  const handleClearWeek = useCallback(() => {
    const setter = activeLineupType === 'bartender' ? setLineups : setSecurityLineups;
    setter(prev => prev.map(l => ({
      ...l,
      shifts: l.shifts.map(s => clearShiftLineup(s)),
    })));
  }, [activeLineupType]);

  const handleOperatingHoursChange = useCallback((hours: { open: string; close: string }) => {
    setLineups(prev => prev.map(l =>
      l.dayOfWeek === selectedDay ? { ...l, operatingHours: hours } : l
    ));
  }, [selectedDay]);

  const handleClosedBarsChange = useCallback((bars: Set<string>) => {
    setWeekConfig(prev => ({
      ...prev,
      templateId: 'custom',
      days: {
        ...prev.days,
        [selectedDay]: {
          ...prev.days[selectedDay],
          closedBars: {
            ...prev.days[selectedDay].closedBars,
            [selectedShift]: [...bars],
          },
        },
      },
    }));
  }, [selectedDay, selectedShift]);

  const handleToggleShift = useCallback((shift: ShiftPeriod) => {
    setWeekConfig(prev => {
      const dayConf = prev.days[selectedDay];
      const current = new Set<ShiftPeriod>(dayConf.disabledShifts);
      if (current.has(shift)) {
        current.delete(shift);
      } else {
        current.add(shift);
      }
      return {
        ...prev,
        templateId: 'custom',
        days: {
          ...prev.days,
          [selectedDay]: { ...dayConf, disabledShifts: [...current] },
        },
      };
    });
  }, [selectedDay]);

  const handleShiftTemplatesChange = useCallback((templates: typeof shiftTemplates) => {
    setWeekConfig(prev => ({
      ...prev,
      templateId: 'custom',
      shiftTemplates: templates,
    }));
  }, []);

  const handleTogglePreferred = useCallback((employeeId: string) => {
    const setter = activeLineupType === 'bartender' ? setPreferredMap : setSecPreferredMap;
    setter(prev => {
      const next = { ...prev };
      if (next[employeeId]) delete next[employeeId];
      else next[employeeId] = {};
      return next;
    });
  }, [activeLineupType]);

  const handleSetWellPreference = useCallback((employeeId: string, positionId: string | undefined) => {
    const setter = activeLineupType === 'bartender' ? setPreferredMap : setSecPreferredMap;
    setter(prev => ({
      ...prev,
      [employeeId]: positionId ? { positionId } : {},
    }));
  }, [activeLineupType]);

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data) {
      setActiveDrag({
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        performanceScore: data.performanceScore,
        role: data.role,
      });
    }
  };

  /** Helper to write an updated ShiftLineup back into the nested state */
  const commitShiftLineup = (updated: ShiftLineup) => {
    const setter = activeLineupType === 'bartender' ? setLineups : setSecurityLineups;
    setter(prev => prev.map(l => {
      if (l.dayOfWeek !== selectedDay) return l;
      return {
        ...l,
        shifts: l.shifts.map(s => s.shiftPeriod === selectedShift ? updated : s),
      };
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    const activeSL = activeLineupType === 'bartender' ? currentShiftLineup : currentSecShiftLineup;
    if (!over || !active.data.current || !activeSL) return;

    const draggedId = active.data.current.employeeId as string;
    const draggedName = active.data.current.employeeName as string;
    const draggedScore = active.data.current.performanceScore as number;
    const draggedRole = active.data.current.role as string;
    const targetId = over.id as string;

    // Deep clone the current shift lineup
    const updated: ShiftLineup = {
      ...activeSL,
      areas: activeSL.areas.map(a => ({
        ...a,
        assignments: a.assignments.map(x => ({ ...x })),
      })),
      unassigned: [...activeSL.unassigned.map(u => ({ ...u }))],
    };

    let sourceType: 'position' | 'sidebar' = 'sidebar';
    let sourcePositionId: string | null = null;

    for (const area of updated.areas) {
      const existing = area.assignments.find(a => a.employeeId === draggedId);
      if (existing) {
        sourceType = 'position';
        sourcePositionId = existing.positionId;
        break;
      }
    }

    const clearAssignment = () => ({
      employeeId: null as string | null,
      employeeName: '',
      performanceScore: 0,
      role: '',
      customHours: undefined,
      isPinned: undefined,
      note: undefined,
    });

    // Drop back to sidebar
    if (targetId === 'employee-sidebar') {
      if (sourceType === 'position' && sourcePositionId) {
        for (const area of updated.areas) {
          const idx = area.assignments.findIndex(a => a.positionId === sourcePositionId);
          if (idx !== -1 && area.assignments[idx].employeeId === draggedId) {
            area.assignments[idx] = { ...area.assignments[idx], ...clearAssignment() };
            break;
          }
        }
      }
      commitShiftLineup(updated);
      return;
    }

    // Find target occupant
    let targetOccupant: { employeeId: string; employeeName: string; performanceScore: number; role: string } | null = null;
    for (const area of updated.areas) {
      const t = area.assignments.find(a => a.positionId === targetId);
      if (t && t.employeeId) {
        targetOccupant = { employeeId: t.employeeId, employeeName: t.employeeName, performanceScore: t.performanceScore, role: t.role };
        break;
      }
    }

    // Clear source
    if (sourceType === 'position' && sourcePositionId) {
      for (const area of updated.areas) {
        const idx = area.assignments.findIndex(a => a.positionId === sourcePositionId);
        if (idx !== -1 && area.assignments[idx].employeeId === draggedId) {
          area.assignments[idx] = { ...area.assignments[idx], ...clearAssignment() };
          break;
        }
      }
    }

    // Place in target
    for (const area of updated.areas) {
      const idx = area.assignments.findIndex(a => a.positionId === targetId);
      if (idx !== -1) {
        area.assignments[idx] = {
          ...area.assignments[idx],
          employeeId: draggedId, employeeName: draggedName, performanceScore: draggedScore,
          role: draggedRole, isPinned: undefined,
        };
        break;
      }
    }

    // Handle displaced occupant (swap or move to unassigned)
    if (targetOccupant && sourceType === 'position' && sourcePositionId) {
      for (const area of updated.areas) {
        const idx = area.assignments.findIndex(a => a.positionId === sourcePositionId);
        if (idx !== -1) {
          area.assignments[idx] = {
            ...area.assignments[idx],
            employeeId: targetOccupant.employeeId, employeeName: targetOccupant.employeeName,
            performanceScore: targetOccupant.performanceScore, role: targetOccupant.role,
          };
          break;
        }
      }
    } else if (targetOccupant && sourceType === 'sidebar') {
      updated.unassigned.push({
        employeeId: targetOccupant.employeeId,
        employeeName: targetOccupant.employeeName,
        performanceScore: targetOccupant.performanceScore,
        role: targetOccupant.role,
      });
    }

    // Remove dragged employee from unassigned if they were there
    if (sourceType === 'sidebar') {
      updated.unassigned = updated.unassigned.filter(u => u.employeeId !== draggedId);
    }

    commitShiftLineup(updated);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-overlay-hover" />
        <div className="h-12 rounded-lg bg-overlay" />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-overlay" />)}
          </div>
          <div className="h-96 rounded-xl bg-overlay" />
        </div>
      </div>
    );
  }

  // Check if the selected day is closed
  const isDayClosed = dayConfig && !dayConfig.open;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
            <p className="text-sm text-muted">
              Drag employees into positions — {filledCount}/{totalPositions} filled
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setGenerateMode('day'); setShowGeneratePanel(true); }}
              disabled={generating}
              className="glass rounded-lg px-3 py-1.5 text-sm font-medium text-secondary hover:bg-overlay-hover disabled:opacity-50 transition-colors"
            >
              Generate Day
            </button>
            <button
              onClick={() => { setGenerateMode('week'); setShowGeneratePanel(true); }}
              disabled={generating}
              className="glass rounded-lg px-3 py-1.5 text-sm font-medium text-secondary hover:bg-overlay-hover disabled:opacity-50 transition-colors"
            >
              Generate Week
            </button>
            <div className="relative" ref={clearMenuRef}>
              <button
                onClick={() => setShowClearMenu(prev => !prev)}
                className="glass rounded-lg px-3 py-1.5 text-sm font-medium text-secondary hover:bg-overlay-hover transition-colors"
              >
                Clear
              </button>
              {showClearMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border-strong bg-elevated shadow-xl shadow-black/60 py-1">
                  <button
                    onClick={() => { handleClearShift(); setShowClearMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-sm text-secondary hover:bg-overlay-hover"
                  >
                    Clear Shift
                  </button>
                  <button
                    onClick={() => { handleClearDay(); setShowClearMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-sm text-secondary hover:bg-overlay-hover"
                  >
                    Clear Day
                  </button>
                  <button
                    onClick={() => { handleClearWeek(); setShowClearMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10"
                  >
                    Clear Week
                  </button>
                </div>
              )}
            </div>
            <ExportLineupButton
              shiftLineup={activeLineupType === 'bartender' ? currentShiftLineup : currentSecShiftLineup}
              selectedDay={selectedDay}
              selectedShift={selectedShift}
              date={dates[selectedDay] || ''}
              closedBars={closedBars}
              lineupType={activeLineupType}
            />
            <button
              onClick={handlePostSchedule}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Post Schedule
            </button>
          </div>
        </div>

        {postMessage && (
          <div className="glass-card rounded-lg border-green-500/30 px-4 py-2 text-sm text-green-400 font-medium">
            {postMessage}
          </div>
        )}

        <DaySelector selectedDay={selectedDay} onSelectDay={setSelectedDay} dates={dates} />
        <ShiftSelector selectedShift={selectedShift} onSelectShift={setSelectedShift} shiftTemplates={shiftTemplates} disabledShifts={disabledShifts} onToggleShift={handleToggleShift} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3 min-w-0">
            {isDayClosed ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-overlay-subtle py-16">
                <svg className="h-10 w-10 text-faint mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-sm font-medium text-faint">
                  {selectedDay} is closed
                </p>
                <p className="text-xs text-faint mt-1">
                  Toggle the day open in the setup bar above
                </p>
              </div>
            ) : disabledShifts.has(selectedShift) ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-overlay-subtle py-16">
                <svg className="h-10 w-10 text-faint mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-faint">
                  {shiftTemplates.find(t => t.id === selectedShift)?.label || selectedShift} shift is off for {selectedDay}
                </p>
                <button
                  onClick={() => handleToggleShift(selectedShift)}
                  className="mt-3 glass rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-overlay-hover transition-colors"
                >
                  Enable this shift
                </button>
              </div>
            ) : (currentDay || currentSecDay) && (
              <>
                {/* Bartender / Security lineup toggle */}
                <div className="flex items-center gap-1 rounded-lg glass p-1 w-fit">
                  <button
                    onClick={() => setActiveLineupType('bartender')}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeLineupType === 'bartender'
                        ? 'bg-overlay-medium text-foreground shadow-sm'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Bartender Lineup
                  </button>
                  <button
                    onClick={() => setActiveLineupType('security')}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeLineupType === 'security'
                        ? 'bg-overlay-medium text-foreground shadow-sm'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Security Lineup
                  </button>
                </div>

                {activeLineupType === 'bartender' && currentDay && currentShiftLineup && (
                  <>
                    <RoleHoursSettings
                      operatingHours={currentDay.operatingHours}
                      onOperatingHoursChange={handleOperatingHoursChange}
                      shiftTemplates={shiftTemplates}
                      onShiftTemplatesChange={handleShiftTemplatesChange}
                      closedBars={closedBars}
                      onClosedBarsChange={handleClosedBarsChange}
                    />
                    <LineupSheet
                      shiftLineup={currentShiftLineup}
                      onCustomHoursChange={handleCustomHoursChange}
                      closedBars={closedBars}
                    />
                  </>
                )}

                {activeLineupType === 'security' && currentSecShiftLineup && (
                  <SecurityLineupSheet
                    shiftLineup={currentSecShiftLineup}
                    onCustomHoursChange={handleCustomHoursChange}
                  />
                )}
              </>
            )}

            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Filled" value={`${filledCount}/${totalPositions}`} color={filledCount > 0 ? 'green' : 'blue'} />
              <StatCard label="Avg Score" value={avgScore.toString()} color="purple" />
              <StatCard label="Unfilled" value={(totalPositions - filledCount).toString()} color={totalPositions - filledCount > 20 ? 'red' : 'amber'} />
            </div>
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
            <EmployeeSidebar
              employees={filteredEmployees}
              selectedDay={selectedDay}
              placedEmployeeIds={placedEmployeeIds}
              placedInOtherShifts={placedInOtherShifts}
              preferredIds={activePreferredIds}
              preferredMap={activePreferredMap}
              lineupType={activeLineupType}
              filters={filters}
              onFiltersChange={setFilters}
              onTogglePreferred={handleTogglePreferred}
              onSetWellPreference={handleSetWellPreference}
            />
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDrag && (
          <EmployeeChip
            employeeId={activeDrag.employeeId}
            employeeName={activeDrag.employeeName}
            performanceScore={activeDrag.performanceScore}
            role={activeDrag.role}
          />
        )}
      </DragOverlay>

      <GeneratePanel
        isOpen={showGeneratePanel}
        onClose={() => setShowGeneratePanel(false)}
        mode={generateMode}
        selectedDay={selectedDay}
        lineupType={activeLineupType}
        onGenerate={handlePanelGenerate}
        generating={generating}
      />
    </DndContext>
  );
}
