import { describe, expect, it } from 'vitest';
import { decide, fromB64, gunzip, gzip, infoOf, type CloudMeta } from './cloud';
import { newGame } from './state';
import { parseSave } from './save';

const T0 = Date.UTC(2026, 10, 24);
const game = (name = '김', seed = 7) => ({ ...newGame(name, 'kr', T0, { seed } as never), lastRealTime: T0 + 1000 });
const meta = (p: Partial<CloudMeta> = {}): CloudMeta => ({ rev: null, dirty: false, actAt: 0, ...p });

describe('카카오 서버 저장: 할 일 정하기', () => {
  const g = game();
  const head = (rev: number, actAt: number, other = false) => ({ rev, info: infoOf(other ? game('박', 9) : g, actAt) });

  it('서버가 비었으면 이 기기 저장을 올림(옮기기)', () => {
    expect(decide(g, meta(), { rev: 0 })).toBe('upload');
    expect(decide(null, meta(), { rev: 0 })).toBe('none');
  });
  it('이 기기에 저장이 없으면 서버 것을 받음', () => {
    expect(decide(null, meta(), head(3, T0))).toBe('adopt');
  });
  it('번호가 같으면 직접 한 일이 있을 때만 올림', () => {
    expect(decide(g, meta({ rev: 3 }), head(3, T0))).toBe('none');
    expect(decide(g, meta({ rev: 3, dirty: true, actAt: T0 + 5 }), head(3, T0))).toBe('upload');
  });
  it('다른 기기가 바꿨으면 받아 옴. 단 이 기기에서 더 나중에 한 일이 있으면 이 기기 것', () => {
    expect(decide(g, meta({ rev: 3 }), head(5, T0 + 50))).toBe('adopt');
    expect(decide(g, meta({ rev: 3, dirty: true, actAt: T0 + 10 }), head(5, T0 + 50))).toBe('adopt');
    expect(decide(g, meta({ rev: 3, dirty: true, actAt: T0 + 90 }), head(5, T0 + 50))).toBe('force');
  });
  it('처음 로그인한 기기: 같은 판이면 더 나중 것, 다른 판이면 묻기', () => {
    expect(decide(g, meta(), head(2, T0 + 5000))).toBe('adopt');
    expect(decide(g, meta(), head(2, T0 + 10))).toBe('force');
    expect(decide(g, meta(), head(2, T0 + 5000, true))).toBe('ask');
  });
});

describe('압축', () => {
  it('저장을 압축했다 풀어도 그대로 불러와짐', async () => {
    const g = game();
    const z = await gzip(JSON.stringify(g));
    const b64 = btoa(String.fromCharCode(...z));
    expect(z.length).toBeLessThan(JSON.stringify(g).length / 2);
    const back = parseSave(await gunzip(fromB64(b64)));
    expect(back?.player.name).toBe('김');
    expect(back?.world.seed).toBe(g.world.seed);
  });
});
