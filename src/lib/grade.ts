import type { Grade, GradeOrLow } from '../types';
import { GRADES, LOW_GRADE } from './constants';

/**
 * The ONLY wind-to-grade conversion in the app (BRIEF §2).
 * Non-integer winds are rounded to the nearest kt first (A5).
 * Below 17 kt returns "LOW".
 */
export function gradeFromWind(kt: number): GradeOrLow {
  if (!Number.isFinite(kt)) return 'LOW';
  const w = Math.round(kt);
  if (w < 17) return 'LOW';
  for (let i = GRADES.length - 1; i >= 0; i--) {
    if (w >= GRADES[i].minKt) return GRADES[i].code;
  }
  return 'LOW';
}

export function gradeInfo(code: GradeOrLow): { code: GradeOrLow; name: string; color: string } {
  if (code === 'LOW') return LOW_GRADE;
  const g = GRADES.find((x) => x.code === code)!;
  return { code: g.code, name: g.name, color: g.color };
}

export function isGrade(code: GradeOrLow): code is Grade {
  return code !== 'LOW';
}
