import { describe, expect, it } from 'vitest';
import { BAND_AGE, ageForBand, deckSize, deckSlot, faceFile, faceIdxForAge, faceSheetsExtra3, faceTag } from './faces';
import { newGame } from '../game/state';
import { cabinetOf, giveFaces } from '../game/cabinet';

const bandOf = (p: { country: string; eth?: string; sex: 'm' | 'f'; face?: number }) => deckSlot(faceTag(p.country, p.eth), p.sex, p.face!).band;

describe('얼굴과 나이 맞추기(11-27)', () => {
  it('새 판: 모든 인물 나이가 얼굴 나이대 안', () => {
    for (const cc of ['kr', 'us', 'jp', 'sa', 'pl']) {
      const c = cabinetOf(newGame('t', cc, 0, { seed: 11 }));
      for (const p of c.people) {
        const [lo, hi] = BAND_AGE[bandOf(p)];
        expect(p.age, `${p.title ?? p.group} ${p.age}`).toBeGreaterThanOrEqual(lo);
        expect(p.age).toBeLessThanOrEqual(hi);
      }
    }
  });
  it('정계·관료·공공·군·외국 장관은 모두 50~60대', () => {
    const c = cabinetOf(newGame('t', 'kr', 0, { seed: 12 }));
    const big = c.people.filter((p) => ['정계', '관료', '공공', '군', '외국'].includes(p.group));
    expect(big.length).toBeGreaterThan(60);
    expect(big.every((p) => p.age >= 50)).toBe(true);
  });
  it('옛 저장: 얼굴은 그대로, 나이만 얼굴에 맞춤', () => {
    const c = cabinetOf(newGame('t', 'kr', 0, { seed: 13 }));
    const p = c.people.find((x) => bandOf(x) === '50')!;
    const face = p.face;
    p.age = 41;
    giveFaces(c);
    expect(p.face).toBe(face);
    expect(p.age).toBeGreaterThanOrEqual(50);
    expect(p.age).toBeLessThanOrEqual(53);
    expect(ageForBand(64, '60', 1)).toBe(64);
    expect(ageForBand(75, '60', 0)).toBe(69);
  });
  it('넷째 묶음(40대 얼굴): 번호가 앞 묶음 뒤에 이어 붙고, 켜기 전에는 덱 크기가 그대로', () => {
    expect(deckSize('kr', 'm', true, true, false) + deckSize('kr', 'f', true, true, false)).toBe(142);
    expect(deckSize('kr', 'm') + deckSize('kr', 'f')).toBe(190); // 11-27 그림 들어와 켜짐
    expect(deckSize('tw', 'm') + deckSize('tw', 'f')).toBe(190);
    expect(deckSize('kr', 'm', true, true, true) + deckSize('kr', 'f', true, true, true)).toBe(190);
    expect(faceFile('kr', 'm', 89, true, true, true)).toBe('face-kr-m-40-01');
    expect(faceFile('kr', 'm', 109, true, true, true)).toBe('face-kr-m-50-49');
    expect(faceFile('kr', 'm', 113, true, true, true)).toBe('face-kr-m-60-42');
    // 앞 번호는 바뀌지 않음
    for (let i = 0; i < 89; i++) expect(faceFile('kr', 'm', i, true, true, true)).toBe(faceFile('kr', 'm', i));
    const us = ['us-we', 'us-bl', 'us-hi', 'us-as'];
    expect(us.reduce((a, t) => a + deckSize(t, 'm', true, true, true) + deckSize(t, 'f', true, true, true), 0)).toBe(190);
  });
  it('40대 얼굴 명령문: 18개국 × 4×4 세 장, 파일 이름이 겹치지 않음', () => {
    const sh = faceSheetsExtra3();
    expect(sh.length).toBe(54);
    expect(sh.every((s) => s.grid === 4 && s.cells.length === 16)).toBe(true);
    const files = sh.flatMap((s) => s.cells.map((c) => c.file));
    expect(new Set(files).size).toBe(864);
    expect(files.filter((f) => /-40-/.test(f)).length).toBe(576);
  });
  it('40대 인물은 40대 얼굴을 받음(켜진 나라)', () => {
    const c = cabinetOf(newGame('t', 'kr', 0, { seed: 14 }));
    const young = c.people.filter((p) => p.country === 'kr' && p.age < 50);
    expect(young.length).toBeGreaterThan(0);
    expect(young.every((p) => bandOf(p) === '40')).toBe(true);
  });
  it('시·도지사 얼굴: 나이대에 맞는 얼굴', () => {
    for (let id = 0; id < 30; id++) {
      expect(deckSlot('kr', 'm', faceIdxForAge('kr', 'm', 64, id)).band).toBe('60');
      expect(deckSlot('kr', 'f', faceIdxForAge('kr', 'f', 55, id)).band).toBe('50');
    }
  });
});
