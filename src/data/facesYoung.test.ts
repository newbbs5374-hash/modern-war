import { describe, expect, it } from 'vitest';
import { EXTRA2_READY, YOUNG_PLAN, YOUNG_READY, allFaceFiles, allYoungFiles, deckSize, faceFile, faceTag, isYoungFace, youngFile } from './faces';
import { SECRETARY } from './secretary';
import { COUNTRIES } from './world';
import { newGame } from '../game/state';
import { cabinetOf } from '../game/cabinet';
import { aideCandidates, migrateYoungAides } from '../game/aidePick';

const have = new Set(Object.keys(import.meta.glob('../assets/portraits/*.webp')).map((k) => k.replace(/^.*\//, '').replace(/\.webp$/, '')));

describe('젊은 부관 얼굴·수행비서(11-24)', () => {
  it('젊은 얼굴 계획: 나라마다 32장(한국 36), 들어 있다고 한 그림은 모두 있음', () => {
    expect(allYoungFiles().length).toBe(12 * 32 + 36);
    for (const [tag, n] of Object.entries(YOUNG_READY))
      for (const sex of ['m', 'f'] as const) {
        expect(n[sex]).toBeLessThanOrEqual(YOUNG_PLAN[tag][sex]);
        for (let i = 0; i < n[sex]; i++) expect(have.has(youngFile(tag, sex, i))).toBe(true);
      }
    expect(isYoungFace('face-kr-f-30-02')).toBe(true);
    expect(isYoungFace('face-kr-f-50-02')).toBe(false);
  });
  it('한국 부관 후보·첫 부관: 젊은 얼굴, 서로 안 겹치고 장관 얼굴과도 안 겹침', () => {
    const s = newGame('t', 'kr', 0, { seed: 5 });
    const cand = aideCandidates(s);
    const keys = [...s.officer.aides.map((a) => a.faceKey!), ...cand.map((c) => c.faceKey)];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter(isYoungFace).length).toBeGreaterThanOrEqual(19);
    const cab = new Set(cabinetOf(s).people.map((p) => faceFile(faceTag(p.country, p.eth), p.sex, p.face!)));
    for (const k of keys.filter(isYoungFace)) expect(cab.has(k)).toBe(false);
    for (const c of cand.filter((x) => isYoungFace(x.faceKey))) expect(c.age).toBeLessThanOrEqual(36);
  });
  it('옛 저장: 중년 얼굴 부관은 젊은 얼굴로, 이름 부관은 원래 그림 번호로', () => {
    const s = newGame('t', 'kr', 0, { seed: 5 });
    s.officer.aides = [
      { ...s.officer.aides[0], id: 901, name: '강하린', faceKey: undefined, sex: undefined },
      { ...s.officer.aides[0], id: 902, name: '홍길순', faceKey: 'face-kr-f-50-03', sex: 'f', age: 52 },
    ];
    migrateYoungAides(s);
    expect(s.officer.aides[0].faceKey).toBe('face-kr-f-30-01');
    expect(isYoungFace(s.officer.aides[1].faceKey)).toBe(true);
    expect(s.officer.aides[1].faceKey).not.toBe('face-kr-f-30-01');
    expect(s.officer.aides[1].age!).toBeLessThanOrEqual(36);
  });
  it('수행비서: 나라마다 한 명, 20대', () => {
    for (const c of COUNTRIES) {
      const x = SECRETARY[c.id];
      expect(x).toBeTruthy();
      expect(x.age).toBeGreaterThanOrEqual(20);
      expect(x.age).toBeLessThanOrEqual(29);
    }
  });
});

describe('셋째 얼굴 묶음(나라별 80장 더)', () => {
  it('켜진 나라(그림 옴)는 142장 그림이 모두 있음, 안 켜진 나라는 그대로 62장', () => {
    for (const c of EXTRA2_READY) {
      expect(deckSize(c, 'm') + deckSize(c, 'f')).toBe(142);
      for (const sex of ['m', 'f'] as const) for (let i = 0; i < deckSize(c, sex); i++) expect(have.has(faceFile(c, sex, i))).toBe(true);
    }
    expect(EXTRA2_READY.includes('ir')).toBe(false);
    expect(deckSize('ir', 'm') + deckSize('ir', 'f')).toBe(62);
  });
  it('켜면 142장이고 번호는 이어 붙음', () => {
    expect(deckSize('kr', 'm', true, true) + deckSize('kr', 'f', true, true)).toBe(142);
    const us = ['us-we', 'us-bl', 'us-hi', 'us-as'];
    expect(us.reduce((a, t) => a + deckSize(t, 'm', true, true) + deckSize(t, 'f', true, true), 0)).toBe(142);
    for (let i = 0; i < 39; i++) expect(faceFile('kr', 'm', i, true, true)).toBe(faceFile('kr', 'm', i, true, false));
    expect(faceFile('kr', 'm', 39, true, true)).toBe('face-kr-m-50-22');
    expect(faceFile('kr', 'm', 39 + 27, true, true)).toBe('face-kr-m-60-19');
    const all = allFaceFiles(true, true);
    expect(all.length).toBe(13 * 142);
    expect(new Set(all).size).toBe(all.length);
  });
});
