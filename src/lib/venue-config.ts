import type { BarArea, DayOfWeek } from './types';

// ============================================================
// Kilroy's on Kirkwood — Physical Bar Layout
// Matches the lineup.jpeg sheet format
// ============================================================

export const BAR_AREAS: BarArea[] = [
  {
    id: 'old-bar',
    name: 'OLD BAR',
    positions: [
      { id: 'old-bar-wu',   label: 'WU',   type: 'speed',    speedRank: 1 },
      { id: 'old-bar-b1',   label: 'B1',   type: 'speed',    speedRank: 2 },
      { id: 'old-bar-1',    label: '1',     type: 'standard' },
      { id: 'old-bar-2',    label: '2',     type: 'standard' },
      { id: 'old-bar-3',    label: '3',     type: 'standard' },
      { id: 'old-bar-4',    label: '4',     type: 'standard' },
      { id: 'old-bar-b4',   label: 'B4',    type: 'standard' },
      { id: 'old-bar-cove', label: 'COVE',  type: 'standard' },
      { id: 'old-bar-bb',   label: 'BB',    type: 'barback' },
      { id: 'old-bar-oc1',  label: 'OC',    type: 'on_call' },
      { id: 'old-bar-oc2',  label: 'OC',    type: 'on_call' },
    ],
  },
  {
    id: 'new-bar',
    name: 'NEW BAR',
    positions: [
      { id: 'new-bar-1',    label: '1',    type: 'speed',    speedRank: 3 },
      { id: 'new-bar-2',    label: '2',    type: 'standard' },
      { id: 'new-bar-3',    label: '3',    type: 'standard' },
      { id: 'new-bar-4',    label: '4',    type: 'standard' },
      { id: 'new-bar-5',    label: '5',    type: 'standard' },
      { id: 'new-bar-6',    label: '6',    type: 'standard' },
      { id: 'new-bar-oc1',  label: 'OC',   type: 'on_call' },
      { id: 'new-bar-oc2',  label: 'OC',   type: 'on_call' },
      { id: 'new-bar-bb',   label: 'BB',   type: 'barback' },
    ],
  },
  {
    id: 'duffys-bar',
    name: "DUFFY'S BAR",
    positions: [
      { id: 'duffys-bar-up',   label: 'UP',   type: 'standard' },
      { id: 'duffys-bar-down', label: 'DOWN', type: 'standard' },
      { id: 'duffys-bar-bb',   label: 'BB',   type: 'barback' },
      { id: 'duffys-bar-oc1',  label: 'OC',   type: 'on_call' },
      { id: 'duffys-bar-oc2',  label: 'OC',   type: 'on_call' },
    ],
  },
  {
    id: 'patio-bar',
    name: 'PATIO BAR',
    positions: [
      { id: 'patio-bar-1',  label: '1',  type: 'standard' },
      { id: 'patio-bar-2',  label: '2',  type: 'standard' },
      { id: 'patio-bar-3',  label: '3',  type: 'standard' },
      { id: 'patio-bar-4',  label: '4',  type: 'standard' },
      { id: 'patio-bar-bb', label: 'BB', type: 'barback' },
      { id: 'patio-bar-oc1', label: 'OC', type: 'on_call' },
      { id: 'patio-bar-oc2', label: 'OC', type: 'on_call' },
    ],
  },
  {
    id: 'upstairs-bar',
    name: 'UPSTAIRS BAR',
    positions: [
      { id: 'upstairs-bar-1',  label: '1',  type: 'standard' },
      { id: 'upstairs-bar-2',  label: '2',  type: 'standard' },
      { id: 'upstairs-bar-3',  label: '3',  type: 'standard' },
      { id: 'upstairs-bar-4',  label: '4',  type: 'standard' },
      { id: 'upstairs-bar-5',  label: '5',  type: 'standard' },
      { id: 'upstairs-bar-6',  label: '6',  type: 'standard' },
      { id: 'upstairs-bar-bb', label: 'BB', type: 'barback' },
      { id: 'upstairs-bar-oc1', label: 'OC', type: 'on_call' },
      { id: 'upstairs-bar-oc2', label: 'OC', type: 'on_call' },
    ],
  },
  {
    id: 'servers',
    name: 'SERVERS',
    positions: [
      { id: 'servers-downstairs-1', label: 'Down 1', type: 'server' },
      { id: 'servers-downstairs-2', label: 'Down 2', type: 'server' },
      { id: 'servers-downstairs-3', label: 'Down 3', type: 'server' },
      { id: 'servers-upstairs-1',   label: 'Up 1',   type: 'server' },
    ],
  },
];

export const DEFAULT_OPERATING_HOURS: Record<DayOfWeek, { open: string; close: string }> = {
  Monday:    { open: '11:00', close: '02:00' },
  Tuesday:   { open: '11:00', close: '02:00' },
  Wednesday: { open: '11:00', close: '02:00' },
  Thursday:  { open: '11:00', close: '02:00' },
  Friday:    { open: '11:00', close: '02:00' },
  Saturday:  { open: '11:00', close: '02:00' },
  Sunday:    { open: '11:00', close: '22:00' },
};

// Roles that can be assigned to each position type
export const POSITION_ELIGIBLE_ROLES: Record<string, string[]> = {
  speed:    ['Bartender'],
  standard: ['Bartender'],
  barback:  ['Barback'],
  on_call:  ['Bartender'],
  server:   ['Server'],
};
