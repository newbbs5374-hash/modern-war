import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CityView, type CityCell, type CityThing } from './CityView';

const THINGS: CityThing[] = ['center', 'industry', 'harbor', 'airfield', 'lab', 'housing', 'mine', 'suburb', 'mountain', 'ruins', 'forest'];

describe('도시 모습', () => {
  it('모든 건물·자연물을 임시 그림으로 그릴 수 있다', () => {
    const cells: CityCell[] = THINGS.map((t, i) => ({ key: `${i},0`, x: i * 9, y: (i % 3) * 8, ground: '평지', thing: t, building: i === 1 }));
    cells.push({ key: 'd', x: 0, y: 30, ground: '바닷가', thing: null, deposit: '🛢️' });
    const html = renderToStaticMarkup(createElement(CityView, { cells, coast: 'M0,0L10,0L10,10Z', sel: '0,0', onPick: () => {}, uid: 't' }));
    expect(html).toContain('<svg');
    expect(html).toContain('🛢️');
    expect(html).toContain('🏗️');
  });
});
