import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

import { t, type TranslationKey } from '../i18n';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type MartialArtKey =
  | 'BJJ'
  | 'NOGI'
  | 'JUDO'
  | 'WRESTLING'
  | 'MUAY_THAI'
  | 'MMA'
  | 'BOXING'
  | 'KARATE'
  | 'OTHER';

export const MARTIAL_ARTS: { key: MartialArtKey; icon: IconName }[] = [
  { key: 'BJJ', icon: 'karate' },
  { key: 'NOGI', icon: 'hand-back-right' },
  { key: 'JUDO', icon: 'human-handsup' },
  { key: 'WRESTLING', icon: 'arm-flex' },
  { key: 'MUAY_THAI', icon: 'boxing-glove' },
  { key: 'MMA', icon: 'mixed-martial-arts' },
  { key: 'BOXING', icon: 'boxing-glove' },
  { key: 'KARATE', icon: 'karate' },
  { key: 'OTHER', icon: 'dots-horizontal' },
];

export function martialArtLabel(key?: string | null): string {
  return key ? t(`art.${key}` as TranslationKey) : '';
}
export function martialArtIcon(key?: string | null): IconName {
  return MARTIAL_ARTS.find((a) => a.key === key)?.icon ?? 'karate';
}

export type GenderKey = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export const GENDERS: GenderKey[] = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'];
export function genderLabel(key?: string | null): string {
  return key ? t(`gender.${key}` as TranslationKey) : '';
}
