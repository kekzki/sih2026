import { describe, expect, it } from 'vitest';
import { gradeFromWind } from './grade';

describe('gradeFromWind - IMD threshold boundaries', () => {
  const cases: [number, string][] = [
    [0, 'LOW'],
    [16, 'LOW'],
    [17, 'D'],
    [27, 'D'],
    [28, 'DD'],
    [33, 'DD'],
    [34, 'CS'],
    [47, 'CS'],
    [48, 'SCS'],
    [63, 'SCS'],
    [64, 'VSCS'],
    [89, 'VSCS'],
    [90, 'ESCS'],
    [119, 'ESCS'],
    [120, 'SuCS'],
    [180, 'SuCS'],
  ];
  it.each(cases)('%d kt -> %s', (kt, grade) => {
    expect(gradeFromWind(kt)).toBe(grade);
  });

  it('95 kt is ESCS, never SCS', () => {
    expect(gradeFromWind(95)).toBe('ESCS');
  });

  it('rounds to nearest kt before classifying', () => {
    expect(gradeFromWind(33.4)).toBe('DD');
    expect(gradeFromWind(33.5)).toBe('CS');
    expect(gradeFromWind(16.5)).toBe('D');
    expect(gradeFromWind(16.4)).toBe('LOW');
    expect(gradeFromWind(119.5)).toBe('SuCS');
  });

  it('handles non-finite input', () => {
    expect(gradeFromWind(NaN)).toBe('LOW');
  });
});
