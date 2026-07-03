import { getActiveLocale } from '../i18n';

export type BodyView = 'front' | 'back';
export type RegionNode = { key: string; x: number; y: number };

// body-silhouette.png is 1402x1122: the front figure sits on the LEFT, the back
// on the RIGHT (separated by a background gap). Each figure's bounding box is in
// ABSOLUTE image pixels, head-top to feet-bottom (measured by pixel scan). BodyMap
// scales each figure to the view width and centers it, so the source image does
// not need to be a 2:1 two-halves layout.
export const BODY_IMAGE_SIZE = { width: 1402, height: 1122 };
export const FIGURE_BOX: Record<BodyView, { left: number; right: number; top: number; bottom: number }> = {
  front: { left: 137, right: 627, top: 27, bottom: 1053 },
  back: { left: 749, right: 1244, top: 27, bottom: 1042 },
};

// Hotspot positions as FRACTIONS (0-1) WITHIN the figure box: x 0=left edge (hand)
// .. 1=right edge (hand), y 0=head top .. 1=feet. "left"/"right" follow the mirror image.
export const BODY_NODES: Record<BodyView, RegionNode[]> = {
  front: [
    { key: 'neck', x: 0.5, y: 0.11 },
    { key: 'shoulder_left', x: 0.3, y: 0.16 },
    { key: 'shoulder_right', x: 0.7, y: 0.16 },
    { key: 'chest', x: 0.5, y: 0.2 },
    { key: 'ribs', x: 0.5, y: 0.31 },
    { key: 'elbow_left', x: 0.18, y: 0.32 },
    { key: 'elbow_right', x: 0.82, y: 0.32 },
    { key: 'wrist_left', x: 0.07, y: 0.5 },
    { key: 'wrist_right', x: 0.93, y: 0.5 },
    { key: 'hip_left', x: 0.4, y: 0.46 },
    { key: 'hip_right', x: 0.6, y: 0.46 },
    { key: 'knee_left', x: 0.42, y: 0.7 },
    { key: 'knee_right', x: 0.58, y: 0.7 },
    { key: 'ankle_left', x: 0.45, y: 0.95 },
    { key: 'ankle_right', x: 0.55, y: 0.95 },
  ],
  back: [
    { key: 'neck', x: 0.5, y: 0.11 },
    { key: 'shoulder_left', x: 0.3, y: 0.16 },
    { key: 'shoulder_right', x: 0.7, y: 0.16 },
    { key: 'upper_back', x: 0.5, y: 0.2 },
    { key: 'lower_back', x: 0.5, y: 0.33 },
    { key: 'elbow_left', x: 0.18, y: 0.32 },
    { key: 'elbow_right', x: 0.82, y: 0.32 },
    { key: 'hamstring_left', x: 0.42, y: 0.62 },
    { key: 'hamstring_right', x: 0.58, y: 0.62 },
    { key: 'calf_left', x: 0.43, y: 0.8 },
    { key: 'calf_right', x: 0.57, y: 0.8 },
    { key: 'ankle_left', x: 0.45, y: 0.95 },
    { key: 'ankle_right', x: 0.55, y: 0.95 },
  ],
};

// Flat, top-to-bottom ordered list of every region (for the check-in name picker).
export const ALL_REGIONS: string[] = [
  'neck',
  'shoulder_left',
  'shoulder_right',
  'chest',
  'ribs',
  'upper_back',
  'lower_back',
  'elbow_left',
  'elbow_right',
  'wrist_left',
  'wrist_right',
  'hip_left',
  'hip_right',
  'hamstring_left',
  'hamstring_right',
  'knee_left',
  'knee_right',
  'calf_left',
  'calf_right',
  'ankle_left',
  'ankle_right',
];

const LABELS: Record<string, { pt: string; en: string }> = {
  neck: { pt: 'Pescoço', en: 'Neck' },
  shoulder_left: { pt: 'Ombro esq.', en: 'Left shoulder' },
  shoulder_right: { pt: 'Ombro dir.', en: 'Right shoulder' },
  chest: { pt: 'Peito', en: 'Chest' },
  ribs: { pt: 'Costelas', en: 'Ribs' },
  upper_back: { pt: 'Costas (superior)', en: 'Upper back' },
  lower_back: { pt: 'Lombar', en: 'Lower back' },
  elbow_left: { pt: 'Cotovelo esq.', en: 'Left elbow' },
  elbow_right: { pt: 'Cotovelo dir.', en: 'Right elbow' },
  wrist_left: { pt: 'Punho esq.', en: 'Left wrist' },
  wrist_right: { pt: 'Punho dir.', en: 'Right wrist' },
  hip_left: { pt: 'Quadril esq.', en: 'Left hip' },
  hip_right: { pt: 'Quadril dir.', en: 'Right hip' },
  knee_left: { pt: 'Joelho esq.', en: 'Left knee' },
  knee_right: { pt: 'Joelho dir.', en: 'Right knee' },
  ankle_left: { pt: 'Tornozelo esq.', en: 'Left ankle' },
  ankle_right: { pt: 'Tornozelo dir.', en: 'Right ankle' },
  hamstring_left: { pt: 'Posterior esq.', en: 'Left hamstring' },
  hamstring_right: { pt: 'Posterior dir.', en: 'Right hamstring' },
  calf_left: { pt: 'Panturrilha esq.', en: 'Left calf' },
  calf_right: { pt: 'Panturrilha dir.', en: 'Right calf' },
};

export function bodyRegionLabel(key: string): string {
  const l = LABELS[key];
  if (!l) return key;
  return getActiveLocale() === 'en' ? l.en : l.pt;
}

/** Pain heat color: amber → orange → red → deep red as intensity climbs. */
export function intensityColor(intensity: number): string {
  if (intensity >= 9) return '#C2181B';
  if (intensity >= 7) return '#E5484D';
  if (intensity >= 4) return '#F76808';
  if (intensity >= 1) return '#E0A82E';
  return '#52525B';
}
