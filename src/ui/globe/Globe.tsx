// 입체 지구본(11/27 종합 확장안 세계 1): 세계 지도 칸에서 "지구본" 보기로 열림. three.js 는 여기서만 늦게 받음.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CITIES } from '../../data/cities';
import { KR_OUTLINE } from '../../data/krProvinces';
import { CITY_LONLAT, GEO, GEO_PATH } from '../../data/realmap';
import { COUNTRIES } from '../../data/world';
import { CITY_DEFENSE_MAX } from '../../game/balance';
import { strikes } from '../../game/frontline';
import { isAlive, relationOf, type WorldState } from '../../game/world';
import { useWorldJson } from '../worldSky';
import type { GlobeData, GlobeHandle } from './globeScene';
import { MapMotionButton, useMapMotion } from '../mapMotion';

interface Props {
  world: WorldState;
  playerCountryId: string;
  selectedId: string | null;
  onSelect: (countryId: string) => void;
  colorOf: (countryId: string) => string;
  /** 3D를 열 수 없을 때(평면 지도로 돌아감) */
  onFail?: () => void;
}

const BASE = `${import.meta.env.BASE_URL}globe/`;
const capLL = (id: string): [number, number] => CITY_LONLAT[COUNTRIES.find((c) => c.id === id)!.cities[0]];

export function Globe({ world, playerCountryId: me, selectedId, onSelect, colorOf, onFail }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const G = useRef<GlobeHandle | null>(null);
  const [ready, setReady] = useState(false);
  const pick = useRef<(id: string | null) => void>(() => {});
  pick.current = (id) => {
    if (!id) return;
    const owner = world.owner[id];
    if (owner) onSelect(owner);
  };
  const [moving] = useMapMotion();
  const borders = useWorldJson<{ d: string }>('borders.json', true);

  useEffect(() => {
    let gone = false;
    import('./globeScene')
      .then((m) => {
        if (gone || !ref.current) return;
        const g = m.makeGlobe(ref.current, BASE, (id) => pick.current(id));
        const [lon, lat] = capLL(me);
        g.focus(lon - 8, Math.max(8, lat - 6), 2.7, true);
        G.current = g;
        setReady(true);
      })
      .catch(() => onFail?.());
    return () => {
      gone = true;
      G.current?.dispose();
      G.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 그릴 것: 주인·관계가 바뀔 때만 다시 만듦
  const ownerKey = CITIES.map((c) => world.owner[c.id]).join(',');
  const hotKey = CITIES.filter((c) => (world.defense[c.id] ?? CITY_DEFENSE_MAX) < CITY_DEFENSE_MAX - 2)
    .map((c) => c.id)
    .join(',');
  const relKey = Object.entries(world.pairs)
    .filter(([, p]) => p.rel === '전쟁' || p.rel === '연합')
    .map(([k, p]) => k + p.rel[0])
    .join(',');
  const colorKey = COUNTRIES.map((c) => colorOf(c.id)).join(',');
  const data = useMemo<GlobeData>(() => {
    const hot = new Set(hotKey.split(','));
    const alive = COUNTRIES.filter((c) => isAlive(world, c.id));
    const wars: Array<[string, string]> = [];
    const allies: Array<[string, string]> = [];
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) {
        const [a, b] = [alive[i].id, alive[j].id];
        const r = relationOf(world, a, b);
        if (r === '전쟁') wars.push([a, b]);
        else if (r === '연합' && (a === me || b === me)) allies.push([a, b]);
      }
    const units: GlobeData['units'] = [
      { at: capLL(me), icon: '🚢' },
      { at: capLL(me), icon: '✈️' },
    ];
    for (const [a, b] of wars) {
      units.push({ at: capLL(a), to: capLL(b), icon: '✈️' });
      units.push({ at: capLL(b), to: capLL(a), icon: '✈️' });
    }
    return {
      geo: GEO,
      borders: borders?.d,
      cities: CITIES.filter((c) => c.front).map((c) => {
        const o = world.owner[c.id];
        const [lon, lat] = CITY_LONLAT[c.name];
        return { id: c.id, name: c.name, lon, lat, color: colorOf(o), capital: c.capital, mine: o === me, hot: hot.has(c.id), label: c.capital || o === me };
      }),
      outlines: COUNTRIES.map((c) => ({
        d: c.id === 'kr' ? KR_OUTLINE : GEO_PATH[c.id],
        color: colorOf(world.owner[`${c.id}-0`] ?? c.id),
        bold: c.id === me || c.id === selectedId,
      })).filter((o) => !!o.d),
      arcs: [
        ...wars.map(([a, b]) => ({ a: capLL(a), b: capLL(b), kind: 'war' as const })),
        ...allies.map(([a, b]) => ({ a: capLL(a), b: capLL(b), kind: 'ally' as const })),
        // 전선 지도: 공격받는 도시로 가는 짧은 주황 곡선
        ...strikes(world).map((k) => ({ a: CITY_LONLAT[k.from.name], b: CITY_LONLAT[k.to.name], kind: 'strike' as const })),
      ],
      units,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey, hotKey, relKey, colorKey, me, selectedId, borders]);
  useEffect(() => {
    if (ready) G.current?.set(data);
  }, [ready, data]);
  useEffect(() => {
    if (ready) G.current?.motion(moving);
  }, [ready, moving]);
  // 나라를 고르면 그 나라 수도로 돌림
  const first = useRef(true);
  useEffect(() => {
    if (!ready || !selectedId) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const [lon, lat] = capLL(selectedId);
    G.current?.focus(lon, lat);
  }, [ready, selectedId]);

  return (
    <div className="wm-wrap gl-wrap" ref={ref}>
      {!ready && <div className="gl-wait">🌐 지구본 준비 중…</div>}
      <div className="map-zoom wm-zoom">
        <button aria-label="확대" onClick={() => G.current?.zoom(0.66)}>
          ＋
        </button>
        <button aria-label="축소" onClick={() => G.current?.zoom(1.5)}>
          －
        </button>
        <button
          aria-label="내 나라로"
          onClick={() => {
            const [lon, lat] = capLL(me);
            G.current?.focus(lon, lat, 2.4);
          }}
        >
          🎯
        </button>
        <MapMotionButton />
      </div>
      <p className="gl-credit">위성 사진: NASA Blue Marble · Black Marble</p>
    </div>
  );
}
