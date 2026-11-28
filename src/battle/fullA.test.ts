import { describe, expect, it } from 'vitest';
import { Rng } from '../game/rng';
import {
  BGROUND, JB, MGROUND, SGROUND, ballisticScore, blastFort, bombScore, coresIn, dropBomb, dropPiece, findPair, jigsawDone, jigsawScore, launch, linkPath, makeFort, newBallistic, newBombRun, newJigsaw, newPairs, newShield, pairsScore, pickPiece, pieceHome, pullVel, shieldScore, shoot, stepBallistic, stepBombRun, stepShield, tryPair,
} from './fullA';

describe('11-28 부품 짝 맞추기', () => {
  it('짝은 짝수로, 언제나 지울 짝이 있음', () => {
    const p = newPairs(7);
    expect(p.total % 2).toBe(0);
    expect(findPair(p)).not.toBeNull();
  });
  it('계속 짝을 지우면 판이 다 비고 높은 점수', () => {
    const p = newPairs(11);
    for (let k = 0; k < 200 && p.left > 0; k++) {
      const pr = findPair(p)!;
      expect(tryPair(p, pr[0], pr[1])).not.toBeNull();
    }
    expect(p.left).toBe(0);
    expect(pairsScore(p, 180)).toBeGreaterThan(0.75);
  });
  it('다른 부품·막힌 길은 안 이어짐, 테두리로 돌아가면 이어짐', () => {
    const p = newPairs(3);
    for (const row of p.b) row.fill(0);
    p.b[1][1] = 5;
    p.b[1][3] = 5;
    p.b[1][2] = 2;
    p.b[2][1] = 2;
    p.b[2][3] = 2;
    // 1행 1·3칸 사이에 막혀 있어도 위 테두리(0행)로 돌아감
    expect(linkPath(p, { r: 1, c: 1 }, { r: 1, c: 3 })?.length).toBe(4);
    expect(linkPath(p, { r: 1, c: 1 }, { r: 1, c: 2 })).toBeNull();
  });
});

describe('11-28 위성 사진 맞추기', () => {
  it('제자리 가까이 놓으면 붙고, 다 붙으면 끝', () => {
    const j = newJigsaw(5);
    expect(j.pieces.length).toBe(12);
    const i = 0;
    const p = j.pieces[i];
    expect(pickPiece(j, p.x + 5, p.y + 5)).toBeGreaterThanOrEqual(0);
    expect(dropPiece(j, i, JB.x + 400, JB.y + 400 + 200)).toBe(p.r === 3 && p.c === 0);
    j.pieces.forEach((q, k) => {
      const h = pieceHome(j, q);
      dropPiece(j, k, h.x + 6, h.y - 5);
    });
    expect(jigsawDone(j)).toBe(true);
    expect(jigsawScore(j, 180)).toBeGreaterThan(0.75);
  });
});

describe('11-28 진지·폭격 투하·탄도 사격', () => {
  it('표적 블록을 맞히면 부서지고 위 블록은 내려앉음', () => {
    const f = makeFort(new Rng(4), 100, 500, 5);
    expect(coresIn(f)).toBe(1);
    const mid = f.cols[2];
    const k = mid.findIndex((b) => b.k === 'c');
    const r = blastFort(f, { x: 100 + 2 * 40 + 20, y: 500 - (k + 1) * 40 + 20 }, 30);
    expect(r.cores).toBe(1);
    expect(coresIn(f)).toBe(0);
  });
  it('폭탄은 한 번 지날 때 2발, 떨어져 터짐', () => {
    const s = newBombRun(9);
    s.px = 600;
    expect(dropBomb(s)).toBe(true);
    expect(dropBomb(s)).toBe(true);
    expect(dropBomb(s)).toBe(false);
    for (let i = 0; i < 400 && s.bombs.length; i++) stepBombRun(s, 1 / 60);
    expect(s.bombs.length).toBe(0);
    expect(s.pass).toBe(1);
    s.alt = 300;
    s.px = 700;
    expect(s.hp).toBeLessThanOrEqual(100);
    expect(BGROUND).toBeGreaterThan(0);
  });
  it('폭격 5번 지나면 끝, 표적 다 부수면 높은 점수', () => {
    const s = newBombRun(2);
    s.alt = 700;
    for (let i = 0; i < 60 * 120 && !s.done; i++) stepBombRun(s, 1 / 30);
    expect(s.done).toBe(true);
    s.cores = s.total;
    expect(bombScore(s)).toBeGreaterThan(0.69);
  });
  it('당겨 쏜 미사일은 날아가 땅에 떨어지고 바람이 바뀜', () => {
    const s = newBallistic(6);
    const v = pullVel(-120, 80, 200);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeLessThan(0);
    expect(launch(s, v)).toBe(true);
    expect(launch(s, v)).toBe(false);
    for (let i = 0; i < 60 * 20 && s.m; i++) stepBallistic(s, 1 / 60);
    expect(s.m).toBeNull();
    expect(s.shots).toBe(6);
    expect(s.last.length).toBeGreaterThan(5);
    s.cores = s.total;
    expect(ballisticScore(s)).toBeGreaterThan(0.9);
    expect(MGROUND).toBe(1100);
  });
});

describe('11-28 하늘의 방패', () => {
  it('요격하지 않으면 도시가 무너지고, 불꽃에 닿은 미사일은 떨어짐', () => {
    const s = newShield(8);
    for (let i = 0; i < 60 * 60 && !s.done && s.wave === 1; i++) stepShield(s, 1 / 30);
    expect(s.cities.some((c) => !c.alive) || s.bats.some((b) => !b.alive)).toBe(true);
    const t = newShield(8);
    t.pause = 0;
    t.inc.push({ x: 800, y: 400, sx: 800, tx: 800, ty: SGROUND, v: 1, split: false, dead: false });
    expect(shoot(t, 800, 400)).toBe(true);
    for (let i = 0; i < 40; i++) stepShield(t, 1 / 60);
    expect(t.kills).toBeGreaterThanOrEqual(1);
    expect(shieldScore(t)).toBeGreaterThan(0);
  });
});
