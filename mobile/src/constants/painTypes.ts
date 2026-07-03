import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

import { t, type TranslationKey } from '../i18n';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type PainTypeKey = 'STAB' | 'PRESSURE' | 'BURNING' | 'THROBBING' | 'TINGLING' | 'HEAVY' | 'OTHER';

/** The pain "qualities" the user picks per area (icon + accent for the chips). */
export const PAIN_TYPES: { key: PainTypeKey; icon: IconName; color: string }[] = [
  { key: 'STAB', icon: 'flash', color: '#E0A82E' },
  { key: 'PRESSURE', icon: 'circle-slice-8', color: '#8E4EC6' },
  { key: 'BURNING', icon: 'fire', color: '#F76808' },
  { key: 'THROBBING', icon: 'pulse', color: '#3E63DD' },
  { key: 'TINGLING', icon: 'dots-grid', color: '#2DB6A3' },
  { key: 'HEAVY', icon: 'weight', color: '#9CA3AF' },
  { key: 'OTHER', icon: 'plus', color: '#E5484D' },
];

export function painTypeMeta(key?: string | null) {
  return PAIN_TYPES.find((p) => p.key === key);
}
export function painTypeLabel(key?: string | null): string {
  return key ? t(`pain.type.${key}` as TranslationKey) : '';
}
export function painTypeDesc(key: PainTypeKey): string {
  return t(`pain.type.${key}.desc` as TranslationKey);
}

export type TrendKey = 'BETTER' | 'SAME' | 'WORSE';
export const TRENDS: TrendKey[] = ['BETTER', 'SAME', 'WORSE'];
export function trendLabel(key?: string | null): string {
  return key ? t(`pain.trend.${key}` as TranslationKey) : '';
}
/** Trend color: green = improving, amber = same, red = worse. */
export function trendColor(key?: string | null): string {
  return key === 'BETTER' ? '#16A34A' : key === 'WORSE' ? '#E5484D' : '#E0A82E';
}

export type FrequencyKey = 'CONSTANT' | 'INTERMITTENT' | 'ON_MOVEMENT' | 'AT_REST' | 'MORNING' | 'NIGHT';
export const FREQUENCIES: FrequencyKey[] = ['CONSTANT', 'INTERMITTENT', 'ON_MOVEMENT', 'AT_REST', 'MORNING', 'NIGHT'];
export function frequencyLabel(key?: string | null): string {
  return key ? t(`pain.freq.${key}` as TranslationKey) : '';
}
