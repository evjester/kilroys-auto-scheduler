'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DayOfWeek, ShiftPeriod, GenerationConfig, GenerateDayConfig, ShiftConfig, ShiftStaffing, BarStaffing, SavedTemplate } from '@/lib/types';
import { DAYS } from '@/lib/mock-config';
import { BAR_AREAS } from '@/lib/venue-config';
import { SECURITY_ROAM_AREAS } from '@/lib/security-venue-config';
import {
  buildDefaultGenerationConfig,
  loadSavedTemplates,
  saveTemplate,
  deleteTemplate,
  applyTemplateToConfig,
} from '@/lib/template-storage';

interface GeneratePanelProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'day' | 'week';
  selectedDay: DayOfWeek;
  lineupType: 'bartender' | 'security';
  onGenerate: (config: GenerationConfig) => Promise<void>;
  generating: boolean;
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'Th',
  Friday: 'F', Saturday: 'Sa', Sunday: 'Su',
};

const SHIFT_PERIODS: { id: ShiftPeriod; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'happy-hour', label: 'Happy Hour' },
  { id: 'night', label: 'Night' },
];

/** Bar areas (excluding servers — handled separately) */
const STAFFABLE_BARS = BAR_AREAS.filter(a => a.id !== 'servers');

// ============================================================
// 12-hour time helpers
// ============================================================

function to12Hour(hhmm: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour, minute: m, ampm };
}

function to24Hour(hour: number, minute: number, ampm: 'AM' | 'PM'): string {
  let h = hour;
  if (ampm === 'AM' && h === 12) h = 0;
  else if (ampm === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTime12(hhmm: string): string {
  const { hour, minute, ampm } = to12Hour(hhmm);
  return `${hour}:${String(minute).padStart(2, '0')} ${ampm}`;
}

// ============================================================
// Sub-components
// ============================================================

function Spinner({ value, onChange, min = 0, label }: {
  value: number; onChange: (v: number) => void; min?: number; label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-6 h-6 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-sm font-bold flex items-center justify-center disabled:opacity-30"
          disabled={value <= min}
        >-</button>
        <span className="w-6 text-center text-sm font-semibold text-foreground">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-6 h-6 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-sm font-bold flex items-center justify-center"
        >+</button>
      </div>
    </div>
  );
}

function TimePicker({ value, onChange, label }: {
  value: string; onChange: (v: string) => void; label: string;
}) {
  const { hour, minute, ampm } = to12Hour(value);

  const setHour = (h: number) => onChange(to24Hour(h, minute, ampm));
  const setMinute = (m: number) => onChange(to24Hour(hour, m, ampm));
  const toggleAmPm = () => onChange(to24Hour(hour, minute, ampm === 'AM' ? 'PM' : 'AM'));

  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-faint w-8">{label}</label>
      <select
        value={hour}
        onChange={e => setHour(Number(e.target.value))}
        className="rounded border border-border px-1.5 py-1 text-xs bg-surface-2 text-foreground"
      >
        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-xs text-faint">:</span>
      <select
        value={minute}
        onChange={e => setMinute(Number(e.target.value))}
        className="rounded border border-border px-1.5 py-1 text-xs bg-surface-2 text-foreground"
      >
        {[0, 15, 30, 45].map(m => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
      <button
        onClick={toggleAmPm}
        className="rounded border border-border px-2 py-1 text-xs font-medium bg-surface-2 text-foreground hover:bg-overlay-medium"
      >
        {ampm}
      </button>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export default function GeneratePanel({
  isOpen, onClose, mode, selectedDay, lineupType, onGenerate, generating,
}: GeneratePanelProps) {
  const [config, setConfig] = useState<GenerationConfig>(() =>
    buildDefaultGenerationConfig(mode, selectedDay)
  );
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [activeDay, setActiveDay] = useState<DayOfWeek>(selectedDay);
  const [expandedShifts, setExpandedShifts] = useState<Set<ShiftPeriod>>(new Set(['morning', 'happy-hour', 'night']));
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateType, setSaveTemplateType] = useState<'week' | 'day'>(mode);
  const prevIsOpenRef = useRef(false);

  // Reset config only when panel transitions from closed → open (not on selectedDay change)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setConfig(buildDefaultGenerationConfig(mode, selectedDay));
      setActiveDay(selectedDay);
      setTemplates(loadSavedTemplates(lineupType));
      setSaveTemplateType(mode);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, mode, selectedDay, lineupType]);

  const toggleShiftExpanded = (period: ShiftPeriod) => {
    setExpandedShifts(prev => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  };

  const updateDayConfig = useCallback((day: DayOfWeek, updates: Partial<GenerateDayConfig>) => {
    setConfig(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: { ...prev.days[day], ...updates },
      },
    }));
  }, []);

  const updateShiftConfig = useCallback((day: DayOfWeek, period: ShiftPeriod, updates: Partial<ShiftConfig>) => {
    setConfig(prev => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: {
          ...prev.days[day],
          shifts: {
            ...prev.days[day].shifts,
            [period]: { ...prev.days[day].shifts[period], ...updates },
          },
        },
      },
    }));
  }, []);

  const updateBarStaffing = useCallback((day: DayOfWeek, period: ShiftPeriod, barId: string, field: keyof BarStaffing, value: number) => {
    setConfig(prev => {
      const shift = prev.days[day].shifts[period];
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day],
            shifts: {
              ...prev.days[day].shifts,
              [period]: {
                ...shift,
                staffing: {
                  ...shift.staffing,
                  bars: {
                    ...shift.staffing.bars,
                    [barId]: {
                      ...shift.staffing.bars[barId],
                      [field]: value,
                    },
                  },
                },
              },
            },
          },
        },
      };
    });
  }, []);

  const updateServerStaffing = useCallback((day: DayOfWeek, period: ShiftPeriod, subField: 'downstairs' | 'upstairs', value: number) => {
    setConfig(prev => {
      const shift = prev.days[day].shifts[period];
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day],
            shifts: {
              ...prev.days[day].shifts,
              [period]: {
                ...shift,
                staffing: {
                  ...shift.staffing,
                  servers: {
                    ...shift.staffing.servers,
                    [subField]: value,
                  },
                },
              },
            },
          },
        },
      };
    });
  }, []);

  const updateSecurityField = useCallback((day: DayOfWeek, period: ShiftPeriod, field: 'carders' | 'exitDoors' | 'fixedPosts', value: number) => {
    setConfig(prev => {
      const shift = prev.days[day].shifts[period];
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day],
            shifts: {
              ...prev.days[day].shifts,
              [period]: {
                ...shift,
                securityStaffing: {
                  ...shift.securityStaffing,
                  [field]: value,
                },
              },
            },
          },
        },
      };
    });
  }, []);

  const updateSecurityBoh = useCallback((day: DayOfWeek, period: ShiftPeriod, subField: 'dish' | 'expo', value: number) => {
    setConfig(prev => {
      const shift = prev.days[day].shifts[period];
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day],
            shifts: {
              ...prev.days[day].shifts,
              [period]: {
                ...shift,
                securityStaffing: {
                  ...shift.securityStaffing,
                  boh: {
                    ...shift.securityStaffing.boh,
                    [subField]: value,
                  },
                },
              },
            },
          },
        },
      };
    });
  }, []);

  const updateSecurityRoam = useCallback((day: DayOfWeek, period: ShiftPeriod, areaId: string, value: number) => {
    setConfig(prev => {
      const shift = prev.days[day].shifts[period];
      return {
        ...prev,
        days: {
          ...prev.days,
          [day]: {
            ...prev.days[day],
            shifts: {
              ...prev.days[day].shifts,
              [period]: {
                ...shift,
                securityStaffing: {
                  ...shift.securityStaffing,
                  roam: {
                    ...shift.securityStaffing.roam,
                    [areaId]: value,
                  },
                },
              },
            },
          },
        },
      };
    });
  }, []);

  const handleLoadTemplate = (template: SavedTemplate) => {
    setConfig(prev => applyTemplateToConfig(template, prev));
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id, lineupType);
    setTemplates(loadSavedTemplates(lineupType));
  };

  const handleSaveTemplate = () => {
    if (!saveTemplateName.trim()) return;

    const template: SavedTemplate = {
      id: `user-${Date.now()}`,
      name: saveTemplateName.trim(),
      type: saveTemplateType,
      lineupType,
    };

    if (saveTemplateType === 'week') {
      template.days = JSON.parse(JSON.stringify(config.days));
    } else {
      template.dayConfig = JSON.parse(JSON.stringify(config.days[activeDay]));
    }

    saveTemplate(template);
    setTemplates(loadSavedTemplates(lineupType));
    setShowSaveDialog(false);
    setSaveTemplateName('');
  };

  const handleGenerate = async () => {
    await onGenerate(config);
  };

  const dayConfig = config.days[activeDay];

  if (!isOpen) return null;

  // Helper: compute totals for a shift (for summary display)
  const getTotalStaff = (staffing: ShiftStaffing) => {
    let bt = 0, bb = 0, oc = 0, halves = 0;
    for (const bar of Object.values(staffing.bars)) {
      bt += bar.bartenders || 0;
      bb += bar.barbacks || 0;
      oc += bar.onCalls || 0;
      halves += bar.halves || 0;
    }
    const totalServers = (staffing.servers.downstairs || 0) + (staffing.servers.upstairs || 0);
    return { bt, bb, oc, halves, servers: totalServers };
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] z-50 flex flex-col border-l border-border bg-backdrop backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {mode === 'week' ? 'Generate Week' : `Generate ${selectedDay}`}
              {' '}
              <span className="text-sm font-medium text-muted">
                — {lineupType === 'bartender' ? 'Bartender' : 'Security'}
              </span>
            </h2>
            <p className="text-xs text-faint">
              {lineupType === 'bartender'
                ? 'Configure per-bar staffing, on-calls, and hours'
                : 'Configure security, carder, and roam staffing'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-overlay-hover text-muted hover:text-foreground"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Templates section */}
          <div className="border-b border-border px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-faint uppercase tracking-wider">Templates</h3>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="text-xs text-brand-500 hover:text-brand-400 font-medium"
              >
                + Save Current
              </button>
            </div>

            {templates.length === 0 ? (
              <p className="text-xs text-faint">No templates saved yet</p>
            ) : (
              <div className="space-y-2">
                {templates.filter(t => t.type === 'week').length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-faint uppercase mb-1">Weekly</p>
                    <div className="flex flex-wrap gap-1.5">
                      {templates.filter(t => t.type === 'week').map(t => (
                        <div key={t.id} className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleLoadTemplate(t)}
                            className="rounded-full px-2.5 py-1 text-xs font-medium bg-overlay-hover text-secondary hover:bg-brand-500/10 hover:text-brand-400 transition-colors"
                          >
                            {t.name}
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="w-4 h-4 rounded-full text-faint hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center text-xs"
                            title="Delete template"
                          >x</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {templates.filter(t => t.type === 'day').length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-faint uppercase mb-1">Per Day</p>
                    <div className="flex flex-wrap gap-1.5">
                      {templates.filter(t => t.type === 'day').map(t => (
                        <div key={t.id} className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleLoadTemplate(t)}
                            className="rounded-full px-2.5 py-1 text-xs font-medium bg-overlay-hover text-secondary hover:bg-brand-500/10 hover:text-brand-400 transition-colors"
                          >
                            {t.name}
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="w-4 h-4 rounded-full text-faint hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center text-xs"
                            title="Delete template"
                          >x</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save Dialog */}
            {showSaveDialog && (
              <div className="mt-2 rounded-lg border border-border bg-overlay-subtle p-3 space-y-2">
                <input
                  type="text"
                  value={saveTemplateName}
                  onChange={e => setSaveTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground placeholder-faint focus:border-brand-400 focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <select
                    value={saveTemplateType}
                    onChange={e => setSaveTemplateType(e.target.value as 'week' | 'day')}
                    className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-foreground"
                  >
                    <option value="week">Full Week</option>
                    <option value="day">Single Day ({activeDay})</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!saveTemplateName.trim()}
                    className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowSaveDialog(false); setSaveTemplateName(''); }}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-muted hover:bg-overlay-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Day Tabs (week mode) */}
          {mode === 'week' && (
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-xs font-bold text-faint uppercase tracking-wider mb-2">Days</h3>
              <div className="flex gap-1">
                {DAYS.map(day => {
                  const isOpen = config.days[day].open;
                  const isActive = day === activeDay;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => setActiveDay(day)}
                        className={`
                          w-9 h-8 rounded-lg text-xs font-semibold transition-colors
                          ${isActive
                            ? 'bg-brand-600 text-white'
                            : isOpen
                              ? 'bg-overlay-hover text-secondary hover:bg-overlay-medium'
                              : 'bg-overlay text-faint line-through'
                          }
                        `}
                      >
                        {DAY_LABELS[day]}
                      </button>
                      <button
                        onClick={() => updateDayConfig(day, { open: !isOpen })}
                        className={`
                          w-5 h-5 rounded-full flex items-center justify-center text-xs transition-colors
                          ${isOpen
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                          }
                        `}
                        title={isOpen ? 'Open - click to close' : 'Closed - click to open'}
                      >
                        {isOpen ? '\u2713' : '\u2715'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-Shift Configuration */}
          {dayConfig.open ? (
            <div className="px-5 py-3 space-y-2">
              <h3 className="text-xs font-bold text-faint uppercase tracking-wider">
                {activeDay} Shifts
              </h3>

              {SHIFT_PERIODS.map(({ id: period, label }) => {
                const shiftCfg = dayConfig.shifts[period];
                const isExpanded = expandedShifts.has(period);
                const totals = getTotalStaff(shiftCfg.staffing);

                return (
                  <div key={period} className="rounded-lg border border-border overflow-hidden">
                    {/* Shift header */}
                    <div className="flex items-center justify-between bg-overlay-subtle px-3 py-2">
                      <button
                        onClick={() => toggleShiftExpanded(period)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <svg
                          className={`w-3.5 h-3.5 text-faint transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                        <span className="text-xs text-faint">
                          {formatTime12(shiftCfg.startTime)} - {formatTime12(shiftCfg.endTime)}
                        </span>
                      </button>
                      {/* Toggle switch */}
                      <button
                        onClick={() => updateShiftConfig(activeDay, period, { enabled: !shiftCfg.enabled })}
                        className={`
                          relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                          ${shiftCfg.enabled ? 'bg-brand-500' : 'bg-overlay-strong'}
                        `}
                        role="switch"
                        aria-checked={shiftCfg.enabled}
                      >
                        <span
                          className={`
                            pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform
                            ${shiftCfg.enabled ? 'translate-x-4' : 'translate-x-0'}
                          `}
                        />
                      </button>
                    </div>

                    {/* Shift details (when expanded and enabled) */}
                    {isExpanded && shiftCfg.enabled && (
                      <div className="px-3 py-2.5 space-y-3">
                        {/* Time inputs — 12-hour format */}
                        <div className="flex items-center gap-4">
                          <TimePicker
                            label="Start"
                            value={shiftCfg.startTime}
                            onChange={v => updateShiftConfig(activeDay, period, { startTime: v })}
                          />
                          <TimePicker
                            label="End"
                            value={shiftCfg.endTime}
                            onChange={v => updateShiftConfig(activeDay, period, { endTime: v })}
                          />
                        </div>

                        {/* === BARTENDER SECTIONS === */}
                        {lineupType === 'bartender' && <>
                        {/* Per-bar staffing */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-faint uppercase tracking-wider">Bars</h4>
                          <div className="space-y-1">
                            {STAFFABLE_BARS.map(area => {
                              const barStaff = shiftCfg.staffing.bars[area.id] || { bartenders: 0, barbacks: 0, onCalls: 0, halves: 0 };
                              return (
                                <div key={area.id} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
                                  <span className="text-xs font-medium text-secondary w-24 truncate" title={area.name}>
                                    {area.name}
                                  </span>
                                  <div className="flex items-center gap-3 flex-1">
                                    {/* Bartenders */}
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-faint w-4">BT</span>
                                      <button
                                        onClick={() => updateBarStaffing(activeDay, period, area.id, 'bartenders', Math.max(0, barStaff.bartenders - 1))}
                                        className="w-5 h-5 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-xs font-bold flex items-center justify-center disabled:opacity-30"
                                        disabled={barStaff.bartenders <= 0}
                                      >-</button>
                                      <span className="w-4 text-center text-xs font-semibold text-foreground">{barStaff.bartenders}</span>
                                      <button
                                        onClick={() => updateBarStaffing(activeDay, period, area.id, 'bartenders', barStaff.bartenders + 1)}
                                        className="w-5 h-5 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-xs font-bold flex items-center justify-center"
                                      >+</button>
                                    </div>
                                    {/* Barbacks */}
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-faint w-4">BB</span>
                                      <button
                                        onClick={() => updateBarStaffing(activeDay, period, area.id, 'barbacks', Math.max(0, barStaff.barbacks - 1))}
                                        className="w-5 h-5 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-xs font-bold flex items-center justify-center disabled:opacity-30"
                                        disabled={barStaff.barbacks <= 0}
                                      >-</button>
                                      <span className="w-4 text-center text-xs font-semibold text-foreground">{barStaff.barbacks}</span>
                                      <button
                                        onClick={() => updateBarStaffing(activeDay, period, area.id, 'barbacks', barStaff.barbacks + 1)}
                                        className="w-5 h-5 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-xs font-bold flex items-center justify-center"
                                      >+</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Totals summary */}
                          <div className="flex items-center gap-3 pt-1 text-[10px] text-faint">
                            <span>Total: {totals.bt} bartenders, {totals.bb} barbacks</span>
                          </div>
                        </div>

                        {/* On Calls */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-faint uppercase tracking-wider">On Calls</h4>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            {STAFFABLE_BARS.map(area => {
                              const barStaff = shiftCfg.staffing.bars[area.id] || { bartenders: 0, barbacks: 0, onCalls: 0, halves: 0 };
                              return (
                                <div key={area.id} className="flex items-center justify-between">
                                  <span className="text-xs text-muted truncate" title={area.name}>
                                    {area.name}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => updateBarStaffing(activeDay, period, area.id, 'onCalls', Math.max(0, (barStaff.onCalls || 0) - 1))}
                                      className="w-5 h-5 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-xs font-bold flex items-center justify-center disabled:opacity-30"
                                      disabled={(barStaff.onCalls || 0) <= 0}
                                    >-</button>
                                    <span className="w-4 text-center text-xs font-semibold text-foreground">{barStaff.onCalls || 0}</span>
                                    <button
                                      onClick={() => updateBarStaffing(activeDay, period, area.id, 'onCalls', (barStaff.onCalls || 0) + 1)}
                                      className="w-5 h-5 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-xs font-bold flex items-center justify-center"
                                    >+</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {totals.oc > 0 && (
                            <div className="text-[10px] text-faint pt-0.5">Total: {totals.oc} on-calls</div>
                          )}
                        </div>

                        {/* Halves */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-faint uppercase tracking-wider">Halves</h4>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                            {STAFFABLE_BARS.map(area => {
                              const barStaff = shiftCfg.staffing.bars[area.id] || { bartenders: 0, barbacks: 0, onCalls: 0, halves: 0 };
                              return (
                                <div key={area.id} className="flex items-center justify-between">
                                  <span className="text-xs text-muted truncate" title={area.name}>
                                    {area.name}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => updateBarStaffing(activeDay, period, area.id, 'halves', Math.max(0, (barStaff.halves || 0) - 1))}
                                      className="w-5 h-5 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-xs font-bold flex items-center justify-center disabled:opacity-30"
                                      disabled={(barStaff.halves || 0) <= 0}
                                    >-</button>
                                    <span className="w-4 text-center text-xs font-semibold text-foreground">{barStaff.halves || 0}</span>
                                    <button
                                      onClick={() => updateBarStaffing(activeDay, period, area.id, 'halves', (barStaff.halves || 0) + 1)}
                                      className="w-5 h-5 rounded bg-overlay-hover text-muted hover:bg-overlay-strong text-xs font-bold flex items-center justify-center"
                                    >+</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {totals.halves > 0 && (
                            <div className="text-[10px] text-faint pt-0.5">Total: {totals.halves} halves</div>
                          )}
                        </div>

                        {/* Servers */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-faint uppercase tracking-wider">Servers</h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <Spinner
                              label="Downstairs"
                              value={shiftCfg.staffing.servers.downstairs || 0}
                              onChange={v => updateServerStaffing(activeDay, period, 'downstairs', v)}
                            />
                            <Spinner
                              label="Upstairs"
                              value={shiftCfg.staffing.servers.upstairs || 0}
                              onChange={v => updateServerStaffing(activeDay, period, 'upstairs', v)}
                            />
                          </div>
                        </div>

                        </>}

                        {/* === SECURITY SECTIONS === */}
                        {lineupType === 'security' && <>
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-faint uppercase tracking-wider">Security</h4>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <Spinner
                              label="Carders"
                              value={shiftCfg.securityStaffing.carders}
                              onChange={v => updateSecurityField(activeDay, period, 'carders', v)}
                            />
                            <Spinner
                              label="Exit Doors"
                              value={shiftCfg.securityStaffing.exitDoors}
                              onChange={v => updateSecurityField(activeDay, period, 'exitDoors', v)}
                            />
                            <Spinner
                              label="Fixed Posts"
                              value={shiftCfg.securityStaffing.fixedPosts}
                              onChange={v => updateSecurityField(activeDay, period, 'fixedPosts', v)}
                            />
                            <Spinner
                              label="Dish"
                              value={shiftCfg.securityStaffing.boh.dish || 0}
                              onChange={v => updateSecurityBoh(activeDay, period, 'dish', v)}
                            />
                            <Spinner
                              label="Expo"
                              value={shiftCfg.securityStaffing.boh.expo || 0}
                              onChange={v => updateSecurityBoh(activeDay, period, 'expo', v)}
                            />
                          </div>
                          <div className="mt-1.5">
                            <p className="text-[10px] font-semibold text-faint uppercase mb-1">Roam</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {SECURITY_ROAM_AREAS.map(area => (
                                <Spinner
                                  key={area.id}
                                  label={area.name}
                                  value={shiftCfg.securityStaffing.roam[area.id] || 0}
                                  onChange={v => updateSecurityRoam(activeDay, period, area.id, v)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        </>}
                      </div>
                    )}

                    {/* Collapsed disabled state */}
                    {isExpanded && !shiftCfg.enabled && (
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-faint">Shift disabled</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-faint">{activeDay} is closed</p>
              <button
                onClick={() => updateDayConfig(activeDay, { open: true })}
                className="mt-2 text-xs text-brand-500 hover:text-brand-400 font-medium"
              >
                Open this day
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-overlay-subtle">
          <button
            onClick={() => setShowSaveDialog(true)}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary hover:bg-overlay-hover transition-colors"
          >
            Save as Template
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {generating && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {generating ? 'Generating...' : mode === 'week' ? `Generate ${lineupType === 'bartender' ? 'Bar' : 'Security'} Week` : `Generate ${lineupType === 'bartender' ? 'Bar' : 'Security'} Day`}
          </button>
        </div>
      </div>
    </>
  );
}
