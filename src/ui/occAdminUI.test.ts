import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CITIES } from '../data/cities';
import { newGame, type GameState } from '../game/state';
import { annexTick } from '../game/annex';
import { occAdminTick } from '../game/occAdmin';
import { noteCapture } from '../game/territory';
import { OccAdminCard, OccAdminCityBox } from './OccAdminUI';

describe('점령지 관리청 화면', () => {
  it('보고 카드와 도시 상자가 그려짐', () => {
    const fk = CITIES.find((c) => c.name === '후쿠오카')!.id;
    let s: GameState = newGame('t', 'kr', 0, { seed: 3 });
    const w = { ...s.world, owner: { ...s.world.owner } };
    noteCapture(w, fk, 'kr');
    w.owner[fk] = 'kr';
    s = occAdminTick(annexTick({ ...s, world: w }));
    const card = renderToStaticMarkup(createElement(OccAdminCard, { state: s, apply: () => {} }));
    expect(card).toContain('점령지 관리청');
    expect(card).toContain('제1관리단');
    const box = renderToStaticMarkup(createElement(OccAdminCityBox, { state: s, id: fk, apply: () => {} }));
    expect(box).toContain('승인');
  });
});
