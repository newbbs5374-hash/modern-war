import { describe, expect, it } from 'vitest';
import { EXTRA2_READY, FACE_PLAN, allFaceFiles, assignFaces, deckSize, faceFile, faceTag } from './faces';
import { ethOfName, makeNameEth } from './names';
import { Rng } from '../game/rng';
import { newGame } from '../game/state';
import { cabinetOf } from '../game/cabinet';

describe('나라별 얼굴 40장(11-24)', () => {
  it('나라마다 40장, 모두 520장, 파일 이름이 겹치지 않음', () => {
    const files = allFaceFiles(false);
    expect(files.length).toBe(520);
    expect(new Set(files).size).toBe(520);
    const us = Object.keys(FACE_PLAN).filter((t) => t.startsWith('us-'));
    expect(us.reduce((a, t) => a + deckSize(t, 'm', false) + deckSize(t, 'f', false), 0)).toBe(40);
    expect(deckSize('kr', 'm', false) + deckSize('kr', 'f', false)).toBe(40);
    expect(faceFile('kr', 'm', 0)).toBe('face-kr-m-50-01');
    expect(faceFile('kr', 'm', 14)).toBe('face-kr-m-60-01');
    expect(faceFile('us-bl', 'f', 2)).toBe('face-us-bl-f-60-01');
  });
  it('추가 얼굴(11-24) 켜짐: 나라마다 62장, 모두 806장, 그림 파일이 모두 있음', () => {
    const have = new Set(Object.keys(import.meta.glob('../assets/portraits/face-*.webp')).map((k) => k.replace(/^.*\//, '').replace(/\.webp$/, '')));
    expect(allFaceFiles(true, false).length).toBe(806);
    expect(deckSize('kr', 'm', true, false) + deckSize('kr', 'f', true, false)).toBe(62);
    // 셋째 묶음이 켜진 나라(EXTRA2_READY)는 80장씩 더(11-25)
    const files = allFaceFiles(true);
    expect(files.length).toBe(806 + 80 * EXTRA2_READY.length);
    expect(new Set(files).size).toBe(files.length);
    const missing = files.filter((f) => !have.has(f));
    expect(missing).toEqual([]);
  });
  it('미국 이름은 갈래에 맞는 이름표에서 나오고, 이름으로 갈래를 다시 알 수 있음', () => {
    const rng = new Rng(7);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const n = makeNameEth('us', i % 2 ? 'm' : 'f', rng);
      seen.add(n.eth!);
      expect(ethOfName('us', n.name)).toBe(n.eth);
    }
    expect(seen.size).toBe(4);
    expect(faceTag('kr')).toBe('kr');
    expect(faceTag('us', 'hi')).toBe('us-hi');
  });
  it('얼굴이 남아 있으면 겹치지 않고, 앉은 사람이 먼저 겹치지 않는 얼굴을 받음', () => {
    const ppl = Array.from({ length: 30 }, (_, i) => ({ id: i, sex: 'm' as const, age: 50 + (i % 20), country: 'kr', rank: i === 29 ? 100 : 0 }));
    const m = assignFaces(ppl);
    const first26 = ppl.slice(0, 26).map((p) => m.get(p.id));
    // 26장 중 앉은 사람(29번) + 앞 25명이 겹치지 않음
    expect(new Set([...first26.slice(0, 25), m.get(29)]).size).toBe(26);
    // 이미 받은 얼굴은 그대로
    const again = assignFaces(ppl.map((p) => ({ ...p, face: m.get(p.id) })));
    expect(again.get(29)).toBe(m.get(29));
    expect(again.get(3)).toBe(m.get(3));
  });
  it('새 판 내각: 자리에 앉은 사람·정계 인물은 얼굴이 겹치지 않음', () => {
    const c = cabinetOf(newGame('t', 'kr', 0, { seed: 3 }));
    expect(c.people.every((p) => p.face !== undefined)).toBe(true);
    const home = c.people.filter((p) => p.country === 'kr' && p.group !== '인재');
    for (const sex of ['m', 'f'] as const) {
      const g = home.filter((p) => p.sex === sex).slice(0, deckSize('kr', sex));
      expect(new Set(g.map((p) => p.face)).size).toBe(g.length);
    }
  });
});

describe('얼굴 그림 장(3×3)', () => {
  it('나라마다 5장(9·9·9·9·4), 모든 얼굴이 딱 한 번씩', async () => {
    const { faceSheets } = await import('./faces');
    const sh = faceSheets();
    expect(sh.length).toBe(65);
    const files = sh.flatMap((s) => s.cells.map((c) => c.file));
    expect(files.length).toBe(520);
    expect(new Set(files).size).toBe(520);
    expect(sh.every((s) => s.cells.length === s.grid * s.grid)).toBe(true);
  });
});

describe('추가 얼굴 22장(11-24)', () => {
  it('나라마다 22장 더(9·9·4 = 3장), 기존 번호와 안 겹치고 기존 얼굴 번호는 그대로', async () => {
    const F = await import('./faces');
    const sh = F.faceSheetsExtra();
    expect(sh.length).toBe(39);
    const files = sh.flatMap((s) => s.cells.map((c) => c.file));
    expect(files.length).toBe(286);
    expect(new Set(files).size).toBe(286);
    const base = new Set(F.allFaceFiles(false));
    expect(files.some((f) => base.has(f))).toBe(false);
    expect(F.allFaceFiles(true, false).length).toBe(806);
    for (let i = 0; i < 26; i++) expect(F.faceFile('kr', 'm', i, true)).toBe(F.faceFile('kr', 'm', i, false));
    expect(F.faceFile('kr', 'm', 26, true)).toBe('face-kr-m-50-15');
    expect(F.faceFile('kr', 'm', 33, true)).toBe('face-kr-m-60-13');
    expect(sh[0].sheet).toBe('sheet-kr-6');
    expect(sh.every((s) => s.cells.length === s.grid * s.grid)).toBe(true);
  });
});
