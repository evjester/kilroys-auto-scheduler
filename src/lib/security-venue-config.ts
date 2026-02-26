import type { BarArea } from './types';

// ============================================================
// Kilroy's on Kirkwood — Security Lineup Layout
// Matches the koksecuritylineup.jpeg sheet format
// ============================================================

export const SECURITY_AREAS: BarArea[] = [
  {
    id: 'carders',
    name: 'CARDERS',
    positions: [
      { id: 'carder-1c', label: '1C', type: 'carder' },
      { id: 'carder-1m', label: '1M', type: 'carder' },
      { id: 'carder-2c', label: '2C', type: 'carder' },
      { id: 'carder-2m', label: '2M', type: 'carder' },
    ],
  },
  {
    id: 'exit-doors',
    name: 'EXIT DOORS',
    positions: [
      { id: 'exit-front',   label: 'Front',   type: 'exit_door' },
      { id: 'exit-side',    label: 'Side',     type: 'exit_door' },
      { id: 'exit-p-north', label: 'P. North', type: 'exit_door' },
      { id: 'exit-p-south', label: 'P. South', type: 'exit_door' },
    ],
  },
  {
    id: 'fixed-posts',
    name: 'FIXED POSTS',
    positions: [
      { id: 'fixed-p-vip', label: 'P. VIP Door', type: 'fixed_post' },
      { id: 'fixed-dj',    label: 'DJ',           type: 'fixed_post' },
    ],
  },
  {
    id: 'roam-new-bar',
    name: 'NEW BAR',
    positions: [
      { id: 'roam-new-bar-1', label: 'Roam', type: 'roam' },
      { id: 'roam-new-bar-2', label: 'Roam', type: 'roam' },
      { id: 'roam-new-bar-3', label: 'Roam', type: 'roam' },
    ],
  },
  {
    id: 'roam-old-bar',
    name: 'OLD BAR',
    positions: [
      { id: 'roam-old-bar-1', label: 'Roam', type: 'roam' },
      { id: 'roam-old-bar-2', label: 'Roam', type: 'roam' },
      { id: 'roam-old-bar-3', label: 'Roam', type: 'roam' },
    ],
  },
  {
    id: 'roam-patio-bar',
    name: 'PATIO BAR',
    positions: [
      { id: 'roam-patio-bar-1', label: 'Roam', type: 'roam' },
      { id: 'roam-patio-bar-2', label: 'Roam', type: 'roam' },
    ],
  },
  {
    id: 'roam-duffys-bar',
    name: "DUFFY'S BAR",
    positions: [
      { id: 'roam-duffys-bar-1', label: 'Roam', type: 'roam' },
      { id: 'roam-duffys-bar-2', label: 'Roam', type: 'roam' },
    ],
  },
  {
    id: 'roam-upstairs-bar',
    name: 'UPSTAIRS BAR',
    positions: [
      { id: 'roam-upstairs-bar-1', label: 'Roam', type: 'roam' },
      { id: 'roam-upstairs-bar-2', label: 'Roam', type: 'roam' },
      { id: 'roam-upstairs-bar-3', label: 'Roam', type: 'roam' },
    ],
  },
  {
    id: 'back-of-house',
    name: 'BACK OF HOUSE',
    positions: [
      { id: 'boh-dish-1', label: 'Dish', type: 'boh' },
      { id: 'boh-dish-2', label: 'Dish', type: 'boh' },
      { id: 'boh-expo',   label: 'Expo', type: 'boh' },
    ],
  },
];

// Which roles can fill each security position type
export const SECURITY_POSITION_ROLES: Record<string, string[]> = {
  carder:     ['Carder'],
  exit_door:  ['Security'],
  fixed_post: ['Security'],
  roam:       ['Security'],
  boh:        ['Security'],
};

// Roam area IDs (for generate panel spinners)
export const SECURITY_ROAM_AREAS = SECURITY_AREAS.filter(a => a.id.startsWith('roam-'));
