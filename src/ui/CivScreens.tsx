// 문명식 운영 화면: 내정 탭(연구 · 체제 · 도시) + 외교 탭(호감·협정 · 분쟁 섬 · 국제 회의).
// 그림(아이콘) 위주, 자세한 내용은 팝업, 설명은 (?) 도움말.
import { HOME_BELT, HOMETOWN_LOYALTY, isHometown } from '../data/krCities';
import { GOV_FACILITIES } from '../data/govFacilities';
import { govFacCity, govFacLevel } from '../game/govFac';
import { CLAIM_INFLUENCE, REAL_ISLANDS, claimsIsland } from '../data/islands';
import { BoostBar } from './BoostBar';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CITIES, cityById, isCoastalCity } from '../data/cities';
import { UNITS } from '../data/catalog';
import {
  AGENDAS,
  AGREES,
  CARDS,
  DISTRICTS,
  ENVOY_COST,
  ERAS,
  GOVS,
  GOV_CHANGE_COST,
  ISLAND_LEAD_MIN,
  ISLAND_RES_PER_HOUR,
  LOYALTY_OK,
  MIL_TECHS,
  SLOT_ICON,
  SOC_TECHS,
  TECHS,
  agendaById,
  agreeById,
  cardById,
  districtById,
  govById,
  govSlots,
  slotCount,
  techById,
  type DistrictId,
  type GovId,
  type Tech,
} from '../data/civ';
import { RES_ICON } from '../data/economy';
import { specialsFor } from '../data/specials';
import { EDGE_DIR, HEX_DIRS, HEX_SIZE, PIONEER_ISLANDS, hexCorners, hexDist, hexKey } from '../data/hexmap';
import { CityView, cityArt, type CityCell, type CityLabel, type CityThing } from './CityView';
import { cityMap } from '../data/cityMap';
import { CITY_STAGES, cityPeopleAtStart, cityStage, stageOfPeople } from '../game/growth';
import { busyProjects, projectById } from '../game/projects';
import { zoneById } from '../game/zones';
import { domOf } from '../game/domestic';
import { cityJobs } from '../game/chains';
import { nightLevel, type DayMode } from './HomeLand';
import { KR_CITY_INFO, MARK_KIND, MARK_MAX, MARK_SCALE, effText, type CityEff } from '../data/krCities';
import { CITY_INST, instById } from '../data/institutions';
import { SIZE_NAME } from '../data/hexmap';
import { smoothPath, type Seg } from './smoothHex';
import { CityLogo } from './CityLogo';
import { CITY_LOGO } from '../data/cityLogos';
import { useDragScroll } from './dragScroll';
import { RING, SKY_ASPECT, SKY_R, eraLabelAt, layoutSky, skyPath } from './techSky';
import { RANKS } from '../data/ranks';
import { COUNTRIES, countryById } from '../data/world';
import * as C from '../game/civ';
import { isAlive } from '../game/world';
import { fmt, RelTag } from './common';
import { FLAG } from './flag';
import { Help, Meter, Modal, Tile } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { Tip } from './InteriorScreen';
import { ArtIcon, IslandIcon, ResIcon, cardArtKey, eraArtKey, govArtKey, iconArt, islandArtUrl, techArtKey } from './iconArt';

const H = 3600e3;
const r1 = (v: number) => Math.round(v * 10) / 10;
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

/* ═════════════ 연구 ═════════════ */

/** 연구 칸. fixed를 주면 그 줄만(국방 = 군사 기술, 사회 = 사회 제도) */
export function ResearchPanel(props: ScreenProps & { fixed?: 'mil' | 'soc' }) {
  const { state, actions, fixed } = props;
  const c = C.civOf(state);
  const [lineSel, setLine] = useState<'mil' | 'soc'>(fixed ?? 'mil');
  const line = fixed ?? lineSel;
  const [pick, setPick] = useState<Tech | null>(null);
  const rate = C.researchRate(state);
  const list = line === 'mil' ? MIL_TECHS : SOC_TECHS;
  const cur = (l: 'mil' | 'soc') => {
    const id = c.cur[l];
    const t = id ? techById(id)! : null;
    const cost = t ? C.techCost(state, t) : 0;
    const got = t ? (c.progress[t.id] ?? 0) : 0;
    const st = t ? C.techStage(state, t.id) : 0;
    const allDone = !t && (l === 'mil' ? MIL_TECHS : SOC_TECHS).every((x) => c.done.includes(x.id));
    return (
      <div className="civ-cur-wrap">
      <button className={`civ-cur ${t || allDone ? '' : 'idle'}`} onClick={() => (setLine(l), t && setPick(t))}>
        <span className="civ-cur-ico">{t ? <ArtIcon k={techArtKey(t.id)} emoji={t.icon} alt={t.name} /> : l === 'mil' ? '⚙️' : '📜'}</span>
        <span className="civ-cur-main">
          <small className="muted">{l === 'mil' ? '군사 기술' : '사회 제도'}</small>
          <b>
            {t ? t.name : allDone ? '모든 연구 끝' : '고르는 중…'}
            {t && <StagePips n={st} cur />}
          </b>
          {t ? (
            <>
              <Meter value={got} max={cost} tone={l === 'mil' ? 'blue' : 'gold'} />
              <small className="muted">
                {st + 1}/{C.TECH_STAGES}단계 · 이 단계 {timeLeft(((cost - got) / Math.max(0.01, rate)) * H)} · 전체 {timeLeft((C.techLeft(state, t) / Math.max(0.01, rate)) * H)} 남음{c.eureka.includes(t.id) ? ' · 💡' : ''}
              </small>
            </>
          ) : allDone ? (
            <small className="ok">✓ 이 줄 연구를 모두 끝냈어요</small>
          ) : (
            <small className="warn">아래에서 연구를 골라 주세요{c.bank[l] > 0.05 ? ` (모인 점수 ${r1(c.bank[l])})` : ''}</small>
          )}
        </span>
      </button>
      {t && <BoostBar state={state} apply={actions.apply} target={{ kind: 'research', line: l }} compact />}
      </div>
    );
  };
  return (
    <>
      <section className="card">
        <div className="row">
          <span className="civ-era">
            <ArtIcon k={eraArtKey(c.era)} emoji={ERAS[c.era].icon} cls="inline" /> <b>{ERAS[c.era].name}</b> <small className="muted">· 끝낸 연구 {c.done.length}/{MIL_TECHS.length + SOC_TECHS.length}</small>
          </span>
          <Tip label={`🔬 ×${r1(rate)}`} title="연구 속도(실제 1시간에)" rows={C.researchBreakdown(state).map(([k, v]) => [k, `+${r1(v)}`])} total={`${r1(rate)}`} />
          <Help title="연구">
            <p>
              <b>3단계 연구</b>: 기술 하나는 1단계 → 2단계 → 3단계로 나눠 연구해요. 3단계를 모두 끝내야 기술이 완성되고 병과·카드·구역이 열려요. 다른 연구로 바꿔도 끝낸 단계와 쌓인 점수는 그대로 남아요.
            </p>
            <p>
              <b>성좌판</b>: 가운데 별에서 바깥으로 갈수록 다음 시대 연구예요. 선으로 이어진 안쪽 별이 "먼저 해야 하는 연구"예요. 청록 선은 끝남, 주황 선은 지금 열 수 있음, 흐린 점선은 아직 멀었음. 두 손가락으로 벌리거나 ＋ 버튼으로 크게 보고, 밀어서 옮겨요. 별을 누르면 자세히 보여요.
            </p>
            <p>연구는 두 줄이에요. <b>군사 기술</b>은 병과와 무기 강화를, <b>사회 제도</b>는 정책 카드·협정·도시 구역을 열어요. 두 줄은 동시에 하나씩 진행돼요.</p>
            <p>
              <b>병과 열기</b>: 지도자 호칭(부대 크기)과 연구(무기 종류)가 둘 다 있어야 해요. 보병·특수부대는 처음부터 열려 있어요.
            </p>
            <p>
              <b>💡 번뜩임</b>: 훈련·임무·대화·구역 짓기 같은 일을 해내면 관련 연구가 절반으로 줄어요. 연구를 누르면 무엇을 하면 되는지 보여요.
            </p>
            <p>
              <b>시대</b>: 도약기 → 항로기 → 제공기 → 대양기. 한 시대 연구를 4개 끝내면 다음 시대로 가고, 맞수 나라들이 조금 긴장해요.
            </p>
            <p>연구 속도는 도시 인구·🔬연구소 구역·연구 협력 협정·카드로 빨라져요. 고르지 않은 동안 모인 점수는 12시간치까지 다음 연구에 쓰여요.</p>
          </Help>
        </div>
        {fixed ? (
          cur(fixed)
        ) : (
          <div className="grid2">
            {cur('mil')}
            {cur('soc')}
          </div>
        )}
      </section>
      {!fixed && <div className="seg branch-tabs">
        <button className={line === 'mil' ? 'on' : ''} onClick={() => setLine('mil')}>
          ⚙️ 군사 기술 <small>{c.done.filter((id) => id.startsWith('m-')).length}/{MIL_TECHS.length}</small>
        </button>
        <button className={line === 'soc' ? 'on' : ''} onClick={() => setLine('soc')}>
          📜 사회 제도 <small>{c.done.filter((id) => id.startsWith('s-')).length}/{SOC_TECHS.length}</small>
        </button>
      </div>}
      <TechTree {...props} list={list} onPick={setPick} />
      {c.log.length > 0 && (
        <section className="card">
          <small className="stat-group-name">📰 최근 소식</small>
          <ul className="events">
            {c.log.slice(0, 4).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
      {pick && <TechModal {...props} t={pick} onClose={() => setPick(null)} onGo={(id) => actions.apply((s) => C.startResearch(s, id))} />}
    </>
  );
}

/** 단계 점 ●●○ */
function StagePips({ n, cur }: { n: number; cur?: boolean }) {
  return (
    <span className="stage-pips" aria-label={`${n}/${C.TECH_STAGES}단계`}>
      {Array.from({ length: C.TECH_STAGES }, (_, i) => (
        <i key={i} className={i < n ? 'on' : cur && i === n ? 'cur' : ''} />
      ))}
    </span>
  );
}

/** 연구 성좌판: 가운데 시작 별 → 시대 고리 1~4로 뻗는 별자리(용흔 성좌 판 참고). 선은 미리 겹치지 않게 배치(techSky.ts). */
const SKY_PAD = 40;
const SKY_W = (SKY_R + SKY_PAD) * 2;
const SKY_H = (SKY_R * SKY_ASPECT + SKY_PAD) * 2;
const SKY_DUST = (() => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 90 }, () => [r() * SKY_W - SKY_W / 2, r() * SKY_H - SKY_H / 2, 0.4 + r() * 1.1, 0.25 + r() * 0.5]);
})();
function TechTree({ state, list, onPick }: ScreenProps & { list: Tech[]; onPick: (t: Tech) => void }) {
  const c = C.civOf(state);
  const L = useMemo(() => layoutSky(list), [list]);
  const line = list[0]?.line ?? 'mil';
  const box = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<{ s: number; x: number; y: number } | null>(null);
  const fit = useRef(1);
  const drag = useRef<{ pts: Map<number, [number, number]>; moved: number; start?: { s: number; x: number; y: number; d: number; mx: number; my: number } }>({ pts: new Map(), moved: 0 });
  // 처음 열 때·창 크기가 바뀔 때 판 전체가 보이게
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const go = () => {
      const f = Math.min(el.clientWidth / SKY_W, el.clientHeight / SKY_H);
      fit.current = f;
      setCam((v) => (v && Math.abs(v.s - f) > 1e-3 && v.s !== fit.current ? v : { s: f, x: 0, y: 0 }));
    };
    go();
    const ro = new ResizeObserver(go);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => setCam({ s: fit.current, x: 0, y: 0 }), [line]);
  const clamp = (v: { s: number; x: number; y: number }) => {
    const s = Math.max(fit.current, Math.min(fit.current * 3.2, v.s));
    const mx = (SKY_W * s) / 2, my = (SKY_H * s) / 2;
    return { s, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) };
  };
  const zoomAt = (k: number, px = 0, py = 0) =>
    setCam((v) => {
      if (!v) return v;
      const n = clamp({ ...v, s: v.s * k });
      const r = n.s / v.s;
      return clamp({ s: n.s, x: px - (px - v.x) * r, y: py - (py - v.y) * r });
    });
  const rel = (e: { clientX: number; clientY: number }): [number, number] => {
    const b = box.current!.getBoundingClientRect();
    return [e.clientX - b.left - b.width / 2, e.clientY - b.top - b.height / 2];
  };
  const down = (e: React.PointerEvent) => {
    const d = drag.current;
    d.pts.set(e.pointerId, rel(e));
    if (d.pts.size === 1) d.moved = 0;
    const ps = [...d.pts.values()];
    const mx = ps.reduce((a, p) => a + p[0], 0) / ps.length, my = ps.reduce((a, p) => a + p[1], 0) / ps.length;
    const dd = ps.length > 1 ? Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]) : 0;
    if (cam) d.start = { ...cam, d: dd, mx, my };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.pts.has(e.pointerId) || !d.start) return;
    const p = rel(e);
    const old = d.pts.get(e.pointerId)!;
    d.moved += Math.hypot(p[0] - old[0], p[1] - old[1]);
    d.pts.set(e.pointerId, p);
    if (d.moved > 6) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const ps = [...d.pts.values()];
    const mx = ps.reduce((a, q) => a + q[0], 0) / ps.length, my = ps.reduce((a, q) => a + q[1], 0) / ps.length;
    const st = d.start;
    let s = st.s;
    if (ps.length > 1 && st.d > 0) s = st.s * (Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]) / st.d);
    const n = clamp({ s, x: 0, y: 0 });
    const r = n.s / st.s;
    setCam(clamp({ s: n.s, x: mx - (st.mx - st.x) * r, y: my - (st.my - st.y) * r }));
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    d.pts.delete(e.pointerId);
    const ps = [...d.pts.values()];
    if (ps.length && cam) d.start = { ...cam, d: 0, mx: ps[0][0], my: ps[0][1] };
  };
  const tap = (t: Tech) => {
    if (drag.current.moved > 6) return;
    onPick(t);
  };
  const v = cam ?? { s: fit.current, x: 0, y: 0 };
  const z = v.s / fit.current; // 1 = 전체 보기
  const stateOf = (t: Tech) => {
    if (C.hasTech(state, t.id)) return 'done';
    if (c.cur[t.line] === t.id) return 'now';
    const why = C.canResearch(state, t.id);
    return why && why.startsWith('먼저') ? 'far' : 'open';
  };
  const st: Record<string, string> = Object.fromEntries(list.map((t) => [t.id, stateOf(t)]));
  const lineCls = (from: string, to: string) => {
    const a = from ? st[from] === 'done' : true;
    const b = st[to];
    return b === 'done' ? 'done' : b === 'now' && a ? 'now' : a ? 'open' : 'far';
  };
  const order = { far: 0, open: 1, done: 2, now: 3 } as Record<string, number>;
  const edges = [...L.edges].map((e) => ({ ...e, cls: lineCls(e.from, e.to) })).sort((a, b) => order[a.cls] - order[b.cls]);
  // 글씨: 화면에서 늘 9.5px. 겹치면 덜 중요한 별 글씨는 숨김(연구 중 → 열 수 있음 → 끝남 → 아직 순), 확대할수록 더 보임
  const shown = useMemo(() => {
    const f = 9.5 / Math.max(v.s, 0.45); // 판 좌표로 본 글씨 크기
    const pri = { now: 0, open: 1, done: 2, far: 3 } as Record<string, number>;
    const boxes: Array<[number, number, number, number]> = Object.values(L.nodes).map((n) => [n.x - 19, n.y - 19, n.x + 19, n.y + 19]);
    const ok = new Map<string, boolean>(); // 별 id → 글씨를 위에 둘지
    for (const t of [...list].sort((a, b) => pri[st[a.id]] - pri[st[b.id]])) {
      const n = L.nodes[t.id];
      if (!n) continue;
      const w = (t.name.length + (st[t.id] === 'now' ? 3 : 0)) * f * 0.92;
      const hit = (b: number[]) => boxes.some((o) => b[0] < o[2] && o[0] < b[2] && b[1] < o[3] && o[1] < b[3]);
      const below: [number, number, number, number] = [n.x - w / 2, n.y + 22, n.x + w / 2, n.y + 22 + f * 1.15];
      const above: [number, number, number, number] = [n.x - w / 2, n.y - 22 - f * 1.15, n.x + w / 2, n.y - 22];
      const b = !hit(below) ? below : !hit(above) ? above : st[t.id] === 'now' ? below : null;
      if (!b) continue;
      boxes.push(b);
      ok.set(t.id, b === above);
    }
    return ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, Math.round(v.s * 20), list.map((t) => st[t.id]).join()]);
  const showLab = (t: Tech) => shown.has(t.id);
  const doneN = list.filter((t) => st[t.id] === 'done').length;
  return (
    <section className="card sky-card">
      <div className="sky-box" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, ...rel(e))}>
        <div className="sky-board" style={{ width: SKY_W, height: SKY_H, transform: `translate(-50%,-50%) translate(${v.x}px,${v.y}px) scale(${v.s})`, ['--z' as string]: z, ['--s' as string]: v.s }}>
          <svg className="sky-lines" width={SKY_W} height={SKY_H} viewBox={`${-SKY_W / 2} ${-SKY_H / 2} ${SKY_W} ${SKY_H}`} aria-hidden>
            {SKY_DUST.map(([x, y, r, o], i) => (
              <circle key={i} cx={x} cy={y} r={r} className="sky-dust" opacity={o} />
            ))}
            {([1, 2, 3, 4] as const).map((era) => (
              <g key={era} className="sky-ring">
                <ellipse cx={0} cy={0} rx={RING[era]} ry={RING[era] * SKY_ASPECT} />
              </g>
            ))}
            {edges.map((e) => (
              <path key={`${e.from}>${e.to}`} d={skyPath(e.pts)} className={e.cls} />
            ))}
          </svg>
          {([1, 2, 3, 4] as const).map((era) => {
            const [x, y] = eraLabelAt(L, era);
            return (
              <span key={era} className="sky-era" style={{ left: x + SKY_W / 2, top: y + SKY_H / 2 }}>
                {ERAS[era].icon} {ERAS[era].name}
              </span>
            );
          })}
          <span className="sky-root" style={{ left: SKY_W / 2, top: SKY_H / 2 }}>
            <i>{line === 'mil' ? '⚙️' : '📜'}</i>
            <b>{line === 'mil' ? '군사 기술' : '사회 제도'}</b>
            <small>
              {doneN}/{list.length}
            </small>
          </span>
          {list.map((t) => {
            const n = L.nodes[t.id];
            if (!n) return null;
            const s = st[t.id];
            const stage = C.techStage(state, t.id);
            const prog = s === 'now' ? C.techProgress(state, t) : 0;
            return (
              <button
                key={t.id}
                className={`sky-star s-${s} ${shown.get(t.id) ? 'lab-up' : ''}`}
                data-tech={t.id}
                style={{ left: n.x + SKY_W / 2, top: n.y + SKY_H / 2 }}
                onClick={() => tap(t)}
                aria-label={t.name}
              >
                <span className="sky-orb">
                  <ArtIcon k={techArtKey(t.id)} emoji={t.icon} alt={t.name} />
                  {s !== 'done' && c.eureka.includes(t.id) && <i className="sky-eu">💡</i>}
                </span>
                {s !== 'done' && (stage > 0 || s === 'now') && <StagePips n={stage} cur={s === 'now'} />}
                {showLab(t) && (
                  <span className="sky-lab">
                    {t.name}
                    {s === 'now' && <small> {Math.round(prog * 100)}%</small>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="sky-zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => zoomAt(1.4)} aria-label="크게">＋</button>
          <button onClick={() => zoomAt(1 / 1.4)} aria-label="작게">－</button>
          <button onClick={() => setCam({ s: fit.current, x: 0, y: 0 })} aria-label="전체 보기">⤢</button>
        </div>
        <div className="sky-legend">
          <span className="lg-done">● 끝남</span> <span className="lg-now">● 연구 중</span> <span className="lg-open">● 열 수 있음</span> <span className="lg-far">● 아직</span>
        </div>
      </div>
    </section>
  );
}

function TechModal({ state, actions, t, onClose, onGo }: ScreenProps & { t: Tech; onClose: () => void; onGo: (id: string) => void }) {
  const c = C.civOf(state);
  const done = C.hasTech(state, t.id);
  const now = c.cur[t.line] === t.id;
  const why = C.canResearch(state, t.id);
  const me = state.player.countryId;
  const unlocks: string[] = [
    ...(t.units ?? []).flatMap((u) => [`🪖 ${u}`, ...specialsFor(me, u).map((d) => `🌟 ${d.name}`)]),
    ...(t.cards ?? []).map((k) => cardById(k)).filter(Boolean).map((k) => `🃏 ${k!.name}`),
    ...(t.districts ?? []).map((d) => `${districtById(d).icon} ${districtById(d).name}`),
    ...DISTRICTS.filter((d) => d.tech === t.id).map((d) => `${d.icon} ${d.name}(군사 연구시설)`),
    ...(t.agree ?? []).map((a) => `${agreeById(a).icon} ${agreeById(a).name} 협정`),
  ];
  const switching = !done && !now && c.cur[t.line];
  return (
    <Modal
      title={t.name}
      icon={<ArtIcon k={techArtKey(t.id)} emoji={t.icon} alt={t.name} />}
      onClose={onClose}
      footer={
        done ? (
          <span className="good">✓ 끝낸 연구</span>
        ) : now ? (
          <span className="tech-now">
            <span className="muted">연구 중이에요</span>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'research', line: t.line }} />
          </span>
        ) : (
          <button className="primary wide" disabled={!!why} onClick={() => (onGo(t.id), onClose())}>
            {why ?? (switching ? `이걸로 바꾸기(하던 연구는 그대로 남아요)` : `🔬 ${C.techStage(state, t.id) ? '이어서 연구' : '연구 시작'} · ${C.TECH_STAGES}단계 ${r1(C.techLeft(state, t))}시간`)}
          </button>
        )
      }
    >
      {iconArt(techArtKey(t.id)) && (
        <div className="fac-hero">
          <img className="fac-art big contain" src={iconArt(techArtKey(t.id))!} alt={t.name} draggable={false} />
        </div>
      )}
      <p>
        <span className="tag">{t.line === 'mil' ? '⚙️ 군사 기술' : '📜 사회 제도'}</span> <span className="tag">{ERAS[t.era].icon} {ERAS[t.era].name}</span>
      </p>
      <p>{t.text}</p>
      <div className="tech-stages">
        {Array.from({ length: C.TECH_STAGES }, (_, i) => {
          const st = C.techStage(state, t.id);
          const on = i < st;
          const curSt = !on && i === st && now;
          const part = curSt ? (c.progress[t.id] ?? 0) / C.techCost(state, t) : on ? 1 : 0;
          return (
            <div key={i} className={`tech-stage ${on ? 'on' : ''} ${curSt ? 'cur' : ''}`}>
              <small>{i + 1}단계 {i === C.TECH_STAGES - 1 ? '· 완성' : ''}</small>
              <Meter value={part} max={1} tone={on ? 'green' : 'gold'} />
              <small className="muted">{on ? '✓ 끝' : `${r1(C.techCost(state, t))}시간`}</small>
            </div>
          );
        })}
      </div>
      {unlocks.length > 0 && (
        <div className="chips civ-unlocks">
          {unlocks.map((u) => (
            <span key={u} className="mini-chip">
              {u}
            </span>
          ))}
        </div>
      )}
      {t.units?.length ? (
        <p className="small muted">
          병과는 호칭도 필요해요:{' '}
          {t.units
            .map((u) => {
              const r = unitRankOf(u);
              return `${u} ${RANKS[r].name}부터`;
            })
            .join(' · ')}
        </p>
      ) : null}
      {t.needs.length > 0 && <p className="small">⬆️ 먼저 할 연구: {t.needs.map((n) => `${techById(n)!.icon} ${techById(n)!.name}${C.hasTech(state, n) ? ' ✓' : ''}`).join(', ')}</p>}
      {(() => {
        const next = TECHS.filter((x) => x.needs.includes(t.id));
        return next.length > 0 ? <p className="small">⬇️ 이어지는 연구: {next.map((x) => `${x.icon} ${x.name}${C.hasTech(state, x.id) ? ' ✓' : ''}`).join(', ')}</p> : null;
      })()}
      {t.eureka && (
        <div className={`civ-eureka ${c.eureka.includes(t.id) ? 'on' : ''}`}>
          💡 <b>번뜩임</b>: {t.eureka.text} → 연구 절반
          {c.eureka.includes(t.id) ? <b className="good"> · 이미 받았어요!</b> : null}
        </div>
      )}
    </Modal>
  );
}
const unitRankOf = (u: string) => UNITS.find((x) => x.name === u)?.rank ?? 0;

/* ═════════════ 체제 · 정책 카드 ═════════════ */

export function GovPanel(props: ScreenProps) {
  const { state, actions } = props;
  const c = C.civOf(state);
  const [choose, setChoose] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const rank = state.player.rankIndex;
  const gov = c.gov ? govById(c.gov) : null;
  const slots = gov ? govSlots(gov, rank) : [];
  const all = gov ? [...gov.slots, '자유', '자유', '자유'] : [];
  const free = C.swapCost(state) === 0;
  return (
    <>
      <section className="card">
        <div className="row">
          {gov ? (
            <span className="civ-gov">
              <span className="civ-gov-ico"><ArtIcon k={govArtKey(gov.id)} emoji={gov.icon} alt={gov.name} /></span>
              <span>
                <b>{gov.name}</b>
                <small className="muted">{gov.text}</small>
              </span>
            </span>
          ) : (
            <b>🏛️ 나라 체제를 골라 주세요</b>
          )}
          <Help title="체제와 정책 카드">
            <p>체제를 고르면 정책 카드 칸이 정해져요(⚔️군사 · 💰경제 · 🕊️외교 · ⭐자유). 자유 칸에는 아무 카드나 끼워요.</p>
            <p>칸은 지도자 호칭이 오를수록 늘어요: 처음 2칸 → 전설의 지도자 8칸.</p>
            <p>카드 바꾸기는 실제 하루 1번 무료, 그 밖엔 국방예산이 들어요. 체제 바꾸기는 국가 헌장 연구 뒤, 예산 {fmt(GOV_CHANGE_COST)}과 하루 혼란(생산·연구 −20%)이 있어요. 처음 고르는 건 무료예요.</p>
            <p>다른 나라도 체제가 있어요. 같은 체제면 호감 +5, 다르면 −3이고, 다른 체제의 맞수와는 긴장이 조금씩 올라요.</p>
          </Help>
        </div>
        {gov && (
          <div className="row">
            <small className="muted">
              카드 칸 {slots.length}/8 · 바꾸기 {free ? '오늘 무료' : `${fmt(C.swapCost(state))}`}
              {C.chaos(state) ? ` · ⚠️ 혼란 ${timeLeft(c.chaosUntil - state.worldMs)}` : ''}
            </small>
            <button onClick={() => setChoose(true)}>체제 바꾸기</button>
          </div>
        )}
      </section>
      {!gov && <GovChooser {...props} onDone={() => undefined} />}
      {gov && (
        <section className="card">
          <small className="stat-group-name">🃏 정책 카드 칸</small>
          <div className="tiles c4">
            {all.map((k, i) => {
              const open = i < slots.length;
              const card = open && c.cards[i] ? cardById(c.cards[i]!) : null;
              const needRank = RANKS.findIndex((_, r) => slotCount(r) > i);
              return (
                <Tile
                  key={i}
                  icon={card ? <ArtIcon k={cardArtKey(card.id)} emoji={card.icon} alt={card.name} /> : SLOT_ICON[k as keyof typeof SLOT_ICON]}
                  label={card ? card.name : `${k} 칸`}
                  sub={open ? (card ? card.text : '비어 있음 · 누르기') : `${RANKS[needRank]?.name ?? ''}부터`}
                  locked={!open}
                  tone={card ? 'gold' : undefined}
                  onClick={() => open && setSlot(i)}
                />
              );
            })}
          </div>
          <p className="small muted">쓸 수 있는 카드 {C.unlockedCards(state).length}/{CARDS.length} · 사회 제도 연구로 더 열려요</p>
        </section>
      )}
      {gov && (
        <section className="card">
          <small className="stat-group-name">🌐 다른 나라의 체제</small>
          <div className="civ-govs">
            {COUNTRIES.filter((x) => x.id !== state.player.countryId && isAlive(state.world, x.id)).map((x) => (
              <span key={x.id} className={`mini-chip ${c.aiGov[x.id] === c.gov ? 'same' : ''}`} title={x.name}>
                {FLAG[x.id]} {govById(c.aiGov[x.id]).icon}
              </span>
            ))}
          </div>
        </section>
      )}
      {choose && (
        <Modal title="체제 바꾸기" icon="🏛️" onClose={() => setChoose(false)}>
          <GovChooser {...props} onDone={() => setChoose(false)} />
        </Modal>
      )}
      {slot !== null && gov && (
        <Modal title={`${slots[slot]} 칸 카드`} icon={SLOT_ICON[slots[slot]]} onClose={() => setSlot(null)}>
          {c.cards[slot] && (
            <button className="wide" onClick={() => (actions.apply((s) => C.putCard(s, slot, null)), setSlot(null))}>
              카드 빼기
            </button>
          )}
          {CARDS.filter((k) => slots[slot] === '자유' || k.kind === slots[slot]).map((k) => {
            const why = C.canPutCard(state, slot, k.id);
            const unlocked = C.unlockedCards(state).includes(k.id);
            const from = SOC_TECHS.find((t) => t.cards?.includes(k.id)) ?? MIL_TECHS.find((t) => t.cards?.includes(k.id));
            return (
              <div key={k.id} className={`list-row ${unlocked ? '' : 'is-locked'}`}>
                <span>
                  <ArtIcon k={cardArtKey(k.id)} emoji={k.icon} alt={k.name} cls="inline" /> <b>{k.name}</b> <span className="tag">{k.kind}</span>
                  <br />
                  <small className="muted">{unlocked ? k.text : `🔒 ${from?.name ?? ''} 연구로 열림 · ${k.text}`}</small>
                </span>
                <button className="primary" disabled={!!why || c.cards[slot] === k.id} title={why ?? ''} onClick={() => (actions.apply((s) => C.putCard(s, slot, k.id)), setSlot(null))}>
                  {c.cards[slot] === k.id ? '끼움' : c.cards[slot] && !free ? `바꾸기 ${fmt(C.swapCost(state))}` : '끼우기'}
                </button>
              </div>
            );
          })}
        </Modal>
      )}
    </>
  );
}

function GovChooser({ state, actions, onDone }: ScreenProps & { onDone: () => void }) {
  const c = C.civOf(state);
  return (
    <div className="civ-gov-pick">
      {GOVS.map((g) => {
        const why = C.canSetGov(state, g.id as GovId);
        return (
          <button
            key={g.id}
            className={`civ-gov-card ${c.gov === g.id ? 'on' : ''}`}
            disabled={!!why}
            onClick={() => {
              if (c.gov && !window.confirm(`${g.name}로 바꿀까요? 국방예산 ${fmt(GOV_CHANGE_COST)} · 하루 혼란`)) return;
              actions.apply((s) => C.setGov(s, g.id));
              onDone();
            }}
          >
            <span className="civ-gov-ico"><ArtIcon k={govArtKey(g.id)} emoji={g.icon} alt={g.name} /></span>
            <b>{g.name}</b>
            <small>{g.slots.map((k) => SLOT_ICON[k]).join(' ')}</small>
            <small>{g.text}</small>
            <small className="muted">어울림: {g.play}</small>
            {g.needs && !C.hasTech(state, g.needs) && <small className="warn">🔒 {techById(g.needs)?.name} 연구로 열림</small>}
            {why && c.gov && !(g.needs && !C.hasTech(state, g.needs)) && <small className="warn">{why}</small>}
          </button>
        );
      })}
    </div>
  );
}

/* ═════════════ 도시: 구역 · 민심 · 인구 ═════════════ */

const loyaltyFace = (v: number) => (v >= 75 ? '😊' : v >= LOYALTY_OK ? '🙂' : v >= 30 ? '😟' : '😠');

export function CityPanel(props: ScreenProps) {
  const { state } = props;
  const me = state.player.countryId;
  const [pick, setPick] = useState<string | null>(null);
  const mine = CITIES.filter((c) => state.world.owner[c.id] === me);
  const t = C.cityTotals(state);
  return (
    <>
      <section className="card">
        <div className="row">
          <div className="ichips">
            <span className="ichip">
              <span>{loyaltyFace(t.avgLoyalty)}</span>
              <b>{Math.round(t.avgLoyalty)}</b>
              <small>민심</small>
            </span>
            <span className="ichip">
              <span>👪</span>
              <b>{t.pop}</b>
              <small>인구</small>
            </span>
            <span className="ichip">
              <span>🏛️</span>
              <b>×{r1(C.civBudgetMult(state))}</b>
              <small>수입</small>
            </span>
          </div>
          <Help title="도시">
            <p>도시마다 육각 칸이 있어요(소도시 169 · 중도시 271 · 대도시 397칸). 칸에 <b>구역</b>을 지어요: 소도시 3 · 중도시 5 · 대도시 7개.</p>
            <p>🇰🇷 대한민국 10개 도시는 실제 행정구역 모양 그대로예요. 구·군 경계, 강, 실제 시설(대통령실·국방과학연구소·해군작전사령부 등)이 실제 자리에 있고, 시설마다 발전 단계(1~{MARK_MAX})를 올릴 수 있어요.</p>
            <p>
              <b>도시 특성·실제 시설·군사 연구시설</b>은 나라 전체 예산·자원·연구·모집·전투력·임무에 더해져요. 그 도시 민심이 낮으면 줄고, 점령지는 절반만 받아요.
            </p>
            <ul>
              {DISTRICTS.map((d) => (
                <li key={d.id}>
                  {d.icon} <b>{d.name}</b>({d.where}): {d.text}. {d.adj}
                </li>
              ))}
            </ul>
            <p>
              <b>민심</b>(0~100): 전쟁 피로·점령·자원 부족이면 내려가고, 주거 구역·복지 연구·평화 협정이면 올라요. {LOYALTY_OK}보다 낮으면 그 도시 생산이 줄어요. 아주 낮아도 도시를 잃지는 않아요.
            </p>
            <p>
              <b>인구</b>(1~10): 민심 60 이상이면 자라요. 처음보다 자란 인구만큼 국방예산과 연구가 늘어요.
            </p>
          </Help>
        </div>
      </section>
      <div className="civ-cities">
        {mine.map((city) => {
          const cc = C.cityCiv(state, city.id);
          const building = cc.districts.filter((d) => d.doneMs > state.worldMs).length;
          const stg = cityStage(state, city.id);
          return (
            <button key={city.id} className={`civ-city ${cc.loyalty < LOYALTY_OK ? 'low' : ''}`} onClick={() => setPick(city.id)}>
              <CityLogo name={city.name} country={city.home} capital={city.capital} />
              <span className="civ-city-body">
                <span className="civ-city-top">
                  <b>
                    {city.capital ? '👑 ' : ''}
                    {isHometown(city.name) ? '🏡 ' : ''}
                    {city.name}
                  </b>
                  <span title={`민심 ${Math.round(cc.loyalty)}`}>
                    {loyaltyFace(cc.loyalty)}
                    <small>{Math.round(cc.loyalty)}</small>
                  </span>
                </span>
                <small className="civ-city-nick">
                  {KR_CITY_INFO[city.name] ? `${KR_CITY_INFO[city.name].trait.icon} ${KR_CITY_INFO[city.name].nick}` : `${SIZE_NAME[city.size]} · ${countryById(city.home).name}`}
                  {city.home !== me ? ' · 점령지' : ''}
                </small>
                <Meter value={cc.loyalty} max={100} tone={cc.loyalty >= LOYALTY_OK ? 'green' : 'red'} />
                <span className="civ-city-facts">
                  <span title="도시 단계">
                    {stg.stage.icon}
                    {stg.stage.name}
                  </span>
                  <span title="인구">👪{people(C.cityPeople(state, city.id))}</span>
                  <span title="구역">
                    🏗️{cc.districts.length}/{C.districtSlots(state, city.id)}
                    {building ? '⏳' : ''}
                  </span>
                  {cityMarkCount(city.id) > 0 && <span title="실제 시설">🏛️{cityMarkCount(city.id)}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {pick && <CityModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

const cityMarkCount = (id: string) => C.cityMarks(id).length;

/** 도시 칸 바깥 테두리 → 굽이진 해안선 */
function cityCoast(tiles: Array<{ q: number; r: number; x: number; y: number }>): string {
  const has = new Set(tiles.map((t) => hexKey(t.q, t.r)));
  const segs: Seg[] = [];
  for (const t of tiles) {
    const cs = hexCorners(t.x, t.y);
    cs.forEach((p, i) => {
      const dir = HEX_DIRS[EDGE_DIR[i]];
      if (!has.has(hexKey(t.q + dir.q, t.r + dir.r))) segs.push([p, cs[(i + 1) % 6]]);
    });
  }
  return smoothPath(segs, { relax: 70, wiggle: HEX_SIZE * 0.6 });
}

const TERRAIN_COLOR: Record<C.Terrain, string> = { 평지: '#4d7c3a', 산: '#78716c', 유적: '#a78b4f', 바닷가: '#c2a86b' };

const people = (v: number) => (v >= 10000 ? `${Math.round(v / 1000) / 10}천만` : `${v.toLocaleString()}만`);
const MARK_COLOR: Record<string, string> = {
  gov: '#c9b98f', intel: '#64748b', army: '#6b7a4f', navy: '#3b6e9c', air: '#7d93ad', lab: '#d8dee6', univ: '#b98a6b', bank: '#8fa4b8', industry: '#9a8f86',
  port: '#7c8ea0', airport: '#a3b3c2', culture: '#b8754f', tourism: '#4fa3a5', nature: '#5f8f4a', energy: '#a8a29e', shipyard: '#71839a',
};

/** 구·군이 다른 이웃 칸 사이 선 */
function guBorders(tiles: Array<{ q: number; r: number; x: number; y: number; gu?: number }>): string {
  const at = new Map(tiles.map((t) => [hexKey(t.q, t.r), t]));
  let d = '';
  for (const t of tiles) {
    if (t.gu === undefined) continue;
    const cs = hexCorners(t.x, t.y);
    cs.forEach((p, i) => {
      const dir = HEX_DIRS[EDGE_DIR[i]];
      const o = at.get(hexKey(t.q + dir.q, t.r + dir.r));
      if (o && o.gu !== undefined && o.gu > t.gu!) {
        const q2 = cs[(i + 1) % 6];
        d += `M${p[0].toFixed(2)},${p[1].toFixed(2)}L${q2[0].toFixed(2)},${q2[1].toFixed(2)}`;
      }
    });
  }
  return d;
}

/** 효과에 몫(민심·점령)을 곱해 한 줄로 */
const scaled = (e: CityEff, k: number): CityEff => Object.fromEntries(Object.entries(e).map(([key, v]) => [key, key === 'loyalty' ? v : (v as number) * k])) as CityEff;

function CityModal({ state, actions, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const city = cityById(id);
  const cc = C.cityCiv(state, id);
  const map = cityMap(id);
  const tiles = map.tiles;
  const info = KR_CITY_INFO[city.name] ?? null;
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [zoom, setZoom] = useState(1);
  const [open, setOpen] = useState(false);
  // 그때와 지금: 취임 첫날 모습으로 잠깐 되돌려 보기
  const [then, setThen] = useState(false);
  const [dayMode, setDayMode] = useState<DayMode>('자동');
  const scrollRef = useRef<HTMLDivElement>(null);
  useDragScroll(scrollRef, zoom > 1);
  // 확대하면 도심이 가운데 오게
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || zoom === 1) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom]);
  const distAt = (k: string) => cc.districts.find((d) => d.tile === k);
  const mineAt = (k: string) => (cc.mines ?? []).find((m) => m.tile === k);
  const selTile = sel ? tiles.find((t) => hexKey(t.q, t.r) === sel) : null;
  const dep = sel ? C.depositAt(id, sel) : null;
  const selMark = sel ? C.markAt(id, sel) : null;
  const target = C.loyaltyTarget(state, id);
  const marks = C.cityMarks(id);
  const coast = useMemo(() => cityCoast(tiles), [id]);
  const around = useMemo(() => {
    if (!map.outLand.size) return undefined;
    const pts = [...map.outLand].map((k) => {
      const [q, r] = k.split(',').map(Number);
      return { q, r, x: HEX_SIZE * Math.sqrt(3) * (q + r / 2), y: HEX_SIZE * 1.5 * r };
    });
    return cityCoast(pts);
  }, [id]);
  const borders = useMemo(() => (map.gu && map.gu.length > 1 ? guBorders(tiles) : undefined), [id]);
  const rivers = useMemo(
    () =>
      info?.rivers && map.geo
        ? info.rivers.map((r) => ({ w: r.w, d: 'M' + r.pts.map((p) => map.geo!(...p)).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L') }))
        : undefined,
    [id],
  );
  const now = state.worldMs;
  const markLv = (mid: string) => (then ? (marks.find((m) => m.id === mid)?.lv ?? 0) : C.markLevel(state, id, mid));
  const view = then ? { ...cc, pop: city.size - 1, districts: [], mines: [], marks: undefined } : cc;
  const peopleNow = C.cityPeople(state, id);
  const stg = then ? stageOfPeople(cityPeopleAtStart(state, id)) : cityStage(state, id);
  const night = nightLevel(dayMode);
  const myProjects = then ? [] : busyProjects(state).filter(([, p]) => p.cityId === id);
  const zone = then ? undefined : zoneById(domOf(state).zones[id] ?? '');
  const cells = useMemo((): CityCell[] => {
    const cc = view;
    const base = tiles.map((t) => {
      const k = hexKey(t.q, t.r);
      const ground = C.terrainOf(id, t.q, t.r);
      const d = cc.districts.find((x) => x.tile === k);
      const m = (cc.mines ?? []).find((x) => x.tile === k);
      const mk = marks.find((x) => x.tile === k);
      const dp = C.depositAt(id, k);
      let thing = null as CityThing | null;
      if (t.center) thing = 'center';
      else if (mk) thing = 'mark';
      else if (d) thing = d.id as CityThing;
      else if (m) thing = 'mine';
      else if (dp) thing = null;
      else if (ground === '산') thing = 'mountain';
      else if (ground === '유적') thing = 'ruins';
      const st = mk ? cc.marks?.[mk.id] : undefined;
      return {
        key: k,
        x: t.x,
        y: t.y,
        ground,
        thing,
        building: (d && d.doneMs > now) || (m && m.doneMs > now) || (st && st.doneMs > now) || false,
        deposit: dp && !d ? RES_ICON[dp] : null,
        mined: !!m,
        mark: mk ? { icon: MARK_KIND[mk.kind].icon, lv: markLv(mk.id), color: MARK_COLOR[mk.kind], nature: mk.kind === 'nature' && !mk.home, home: !!mk.home, art: markLv(mk.id) > 0 ? cityArt(`city-mark-${id}-${mk.id}`) : null } : undefined,
        dist: hexDist(t, { q: 0, r: 0 }),
      };
    });
    // 빈 땅: 인구가 늘수록 도심에서 시가지가 퍼짐(가까운 곳은 아파트 단지, 바깥은 주택가), 멀리엔 숲
    const empty = base.filter((c) => !c.thing && !c.deposit && c.ground !== '바닷가').sort((a, b) => a.dist - b.dist || a.y - b.y);
    const built = cc.districts.length + marks.length;
    const urban = Math.min(empty.length, Math.round(cc.pop * 9 + built * 2));
    const dense = Math.round(urban * Math.min(0.5, cc.pop / 16));
    empty.slice(0, dense).forEach((c) => (c.thing = 'apt'));
    empty.slice(dense, urban).forEach((c) => (c.thing = 'suburb'));
    empty.slice(urban).forEach((c) => {
      const h = (Math.abs(Math.round(c.x * 7 + c.y * 13)) * 2654435761) % 97;
      if (h % 3 === 0) c.thing = 'forest';
    });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, then, cc.districts, cc.mines, cc.marks, cc.pop, Math.floor(now / 60000)]);
  // 대형 사업 공사 중: 도심 가까운 시가지에 크레인
  const cranes = useMemo(() => {
    if (!myProjects.length) return [];
    return cells
      .filter((c) => c.thing === 'apt' || c.thing === 'suburb')
      .sort((a, b) => (a as CityCell & { dist: number }).dist - (b as CityCell & { dist: number }).dist)
      .slice(0, myProjects.length * 2)
      .filter((_, i) => i % 2 === 0)
      .map((c) => c.key);
  }, [cells, myProjects.length]);
  const labels = useMemo((): CityLabel[] => {
    const out: CityLabel[] = [];
    if (map.gu && map.gu.length > 1) {
      map.gu.forEach((name, gi) => {
        const ts = tiles.filter((t) => t.gu === gi);
        if (!ts.length) return;
        const cx = ts.reduce((a, t) => a + t.x, 0) / ts.length;
        const cy = ts.reduce((a, t) => a + t.y, 0) / ts.length;
        // 가운데에 가장 가까운 칸 위에
        const t = ts.reduce((b, x) => (Math.hypot(x.x - cx, x.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? x : b));
        out.push({ x: t.x, y: t.y, text: name, kind: 'gu' });
      });
    }
    if (zoom >= 2)
      for (const mk of marks) {
        const t = map.at.get(mk.tile)!;
        out.push({ x: t.x, y: t.y, text: mk.name, kind: 'mark' });
      }
    return out;
  }, [id, zoom]);
  const parts = C.cityParts(state, id);
  const share = C.cityShare(state, id);
  const milDefs = DISTRICTS.filter((d) => d.mil);
  const baseDefs = DISTRICTS.filter((d) => !d.mil);
  const buildTile = (d: (typeof DISTRICTS)[number]) => {
    const why = C.canDistrict(state, id, sel!, d.id as DistrictId);
    const adj = C.adjCount(id, sel!, d.id, cc);
    return (
      <Tile
        key={d.id}
        icon={d.icon}
        label={d.name}
        sub={why ? why.replace(' 필요', '') : `${fmt(d.cost)} · 이웃+${adj}`}
        locked={!!why}
        onClick={() => {
          if (why) return setMsg(`${d.name}: ${why}`);
          actions.apply((s) => C.buildDistrict(s, id, sel!, d.id));
          setMsg(`${d.icon} ${d.name} 공사 시작! ${r1(C.districtHours(state, d.id))}시간 뒤 완공 · ${d.text}`);
          setSel(null);
        }}
      />
    );
  };
  return (
    <Modal title={isHometown(city.name) ? `${city.name} · 고향` : city.name} icon={city.capital ? '👑' : isHometown(city.name) ? '🏡' : '🏙️'} onClose={onClose}>
      <div className="row">
        <span>
          {loyaltyFace(cc.loyalty)} 민심 <b>{Math.round(cc.loyalty)}</b> <small className="muted">→ {Math.round(target)}</small>
        </span>
        <span>
          👪 <b>{people(C.cityPeople(state, id))}</b> <small className="muted">(발전 {cc.pop}/{C.popCap(state, id)})</small>
        </span>
        <Tip label="이유" title="민심 목표" rows={C.loyaltyReasons(state, id).map(([k, v]) => [k, signed(Math.round(v))])} total={`${Math.round(target)}`} />
      </div>
      <div className="city-stage">
        <span className="city-stage-badge">
          {stg.stage.icon} <b>{stg.stage.name}</b>
          <small> {stg.stage.lv + 1}/{CITY_STAGES.length}단계</small>
        </span>
        {stg.next ? (
          <span className="city-stage-bar" title={`${stg.next.name}까지 ${people(Math.max(0, stg.next.min - (then ? cityPeopleAtStart(state, id) : peopleNow)))} 명`}>
            <i style={{ width: `${Math.round(stg.frac * 100)}%` }} />
            <small>
              {stg.next.icon} {stg.next.name}까지 {Math.round(stg.frac * 100)}%
            </small>
          </span>
        ) : (
          <small className="muted">가장 높은 단계예요</small>
        )}
        {zone && (
          <span className="city-stage-tag" title={zone.text}>
            {zone.icon} {zone.name}
          </span>
        )}
        {!then && state.world.owner[id] === state.player.countryId && (() => {
          const j = cityJobs(state, id);
          return (
            <span className={`city-stage-tag ${j.loyalty < 0 ? 'bad' : ''}`} title={`일자리 ${j.jobs} · 일손 ${j.workers} → 민심 ${signed(j.loyalty)}. 실제 시설 단계·구역·특구·대형 사업이 일자리를 만들어요.`}>
              💼 {j.label} {signed(j.loyalty)}
            </span>
          );
        })()}
        {myProjects.map(([pid, p]) => (
          <span key={pid} className="city-stage-tag" title={`${p.stage + 1}/3단계 공사 중`}>
            🏗️ {projectById(pid).icon} {projectById(pid).name}
          </span>
        ))}
      </div>
      {cc.loyalty < LOYALTY_OK && <p className="small warn">민심이 낮아 이 도시 생산 ×{r1(C.loyaltyMult(cc.loyalty))} (도시는 잃지 않아요)</p>}
      <div className="city-info">
        <button className="city-info-top" onClick={() => setOpen(!open)}>
          <span className="city-info-name">
            <CityLogo name={city.name} country={city.home} capital={city.capital} size={36} />
            {info ? `${info.trait.icon} ${info.nick}` : `${SIZE_NAME[city.size]} · ${tiles.length}칸`}
          </span>
          <small>{open ? '접기 ▲' : '도시 정보 ▼'}</small>
        </button>
        {info && (
          <p className="small">
            <b>{info.trait.icon} {info.trait.name}</b>: {info.trait.text}
          </p>
        )}
        {(() => {
          const gf = GOV_FACILITIES.filter((f) => govFacCity(state, f) === id);
          return gf.length ? (
            <p className="small">
              🏛️ 정부 시설: {gf.map((f) => `${f.icon}${f.name} ${govFacLevel(state, f.id) ? '★'.repeat(govFacLevel(state, f.id)) : '(미착공)'}`).join(' · ')}
              <span className="muted"> · 부처 창에서 지어요</span>
            </p>
          ) : null;
        })()}
        {isHometown(city.name) && (
          <p className="small good">
            🏡 대장의 고향: 민심 +{HOMETOWN_LOYALTY} · 고향 전용 시설 {info?.landmarks.filter((m) => m.home).length ?? 0}가지(🏗️ 빈 터를 눌러 짓기)
            <br />
            {C.ownsHomeBelt(state) ? '✅' : '⬜'} 전라 고향 벨트(익산·여수·순천 모두 우리 땅): {effText(HOME_BELT)}
          </p>
        )}
        {open && (
          <div className="city-info-body small">
            {info ? (
              <>
                <p>
                  실제 인구 약 <b>{people(info.pop)}</b> 명 · 면적 {info.area.toLocaleString()}km² · {info.admin}
                </p>
                <p>주요 산업: {info.industry.join(' · ')}</p>
                {map.gu && map.gu.length > 1 && <p className="muted">행정구역: {map.gu.join(' · ')}</p>}
              </>
            ) : (
              <p>
                {SIZE_NAME[city.size]} · 칸 {tiles.length} · 인구 약 {people(C.cityPeople(state, id))} · 기관{' '}
                {(CITY_INST[city.name] ?? []).map((i) => `${instById(i).icon}${instById(i).name}`).join(' · ') || '없음'}
              </p>
            )}
            {CITY_LOGO[city.name]?.file && (
              <p className="muted">
                상징: {CITY_LOGO[city.name].kind} · 위키미디어 공용 「{CITY_LOGO[city.name].file}」 ({CITY_LOGO[city.name].lic === 'PD' ? '공공 저작물' : CITY_LOGO[city.name].lic}{CITY_LOGO[city.name].by ? ` · 만든 이 ${CITY_LOGO[city.name].by}` : ''})
              </p>
            )}
            <p className="stat-group-name">이 도시가 나라에 주는 힘 (민심·점령 반영 ×{r1(share)})</p>
            <ul className="city-eff">
              {info && <li>⭐ 도시 특성: {effText(scaled(parts.trait, share)) || '없음'}</li>}
              {marks.length > 0 && <li>🏛️ 실제 시설 {marks.length}곳: {effText(scaled(parts.marks, share)) || '없음'}</li>}
              <li>
                🧪 군사 연구시설:{' '}
                {effText(scaled(parts.mil, share)) || '없음'}
                {parts.mil.pDom && (['육', '해', '공'] as const).filter((d) => parts.mil.pDom![d]).map((d) => ` · ${d}군 전투력 +${r1(parts.mil.pDom![d] * share * 100)}%`).join('')}
              </li>
            </ul>
            {marks.length > 0 && (
              <div className="city-marks">
                {marks.map((mk) => (
                  <button key={mk.id} className={`city-mark ${sel === mk.tile ? 'on' : ''}`} onClick={() => (setSel(mk.tile), setMsg(''))}>
                    {MARK_KIND[mk.kind].icon} {mk.name} <b>{markLv(mk.id)}단계</b>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="city-zoom-bar">
        {[1, 2, 3].map((z) => (
          <button key={z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>
            {z === 1 ? '전체' : `${z}배`}
          </button>
        ))}
        <button className={`city-dn ${night > 0.5 ? 'on' : ''}`} title={`낮·밤: ${dayMode}`} onClick={() => setDayMode(dayMode === '자동' ? (night > 0.5 ? '낮' : '밤') : dayMode === '낮' ? '밤' : '낮')}>
          {night > 0.5 ? '🌙' : '☀️'}
        </button>
        <button className={`city-then ${then ? 'on' : ''}`} onClick={() => setThen(!then)}>
          {then ? '📅 취임 첫날' : '📅 그때와 지금'}
        </button>
      </div>
      <small className="muted city-zoom-hint">
        {then ? `취임 첫날 모습(인구 약 ${people(cityPeopleAtStart(state, id))}). 다시 누르면 지금 모습.` : zoom > 1 ? '마우스로 잡고 끌거나 손가락으로 밀어서 둘러보기 · 시설 이름 보임' : '2배·3배로 확대하면 잡고 끌어서 둘러볼 수 있어요'}
      </small>
      <div ref={scrollRef} className={`city-scroll ${zoom > 1 ? 'zoomed' : ''}`}>
        <CityView
          cells={cells}
          coast={coast}
          sel={sel}
          onPick={(k) => (setSel(k), setMsg(''))}
          uid={id}
          inland={!isCoastalCity(id)}
          around={around}
          borders={borders}
          rivers={rivers}
          labels={labels}
          zoom={zoom}
          stage={stg.stage.lv}
          night={night}
          cranes={cranes}
          traffic
        />
      </div>
      <div className="legend small muted">
        <span>
          <i style={{ background: TERRAIN_COLOR.평지 }} /> 평지
        </span>
        <span>
          <i style={{ background: TERRAIN_COLOR.바닷가 }} /> 바닷가
        </span>
        <span>⛰️ 산</span>
        <span>🏺 유적</span>
        <span>🏛️ 도심</span>
        {marks.length > 0 && <span>🔵 실제 시설(점 = 단계)</span>}
        <span>◌ 매장지 · ⛏️ 채굴장</span>
      </div>
      <p className="small muted">{isCoastalCity(id) ? '🌊 바다에 닿은 도시 · 가장자리 바닷가 칸에 ⚓항만·🛳️군 조선소를 지을 수 있어요' : '🏞️ 내륙 도시 · ⚓항만·🛳️조선소는 못 지어요(🛫비행장은 돼요)'}</p>
      <p className="small">
        구역 {cc.districts.length}/{C.districtSlots(state, id)} ·{' '}
        {cc.districts.map((d) => `${districtById(d.id).icon}${d.doneMs > state.worldMs ? `(${timeLeft(d.doneMs - state.worldMs)})` : ''}`).join(' ') || '아직 없음'}
      </p>
      {cc.districts
        .filter((d) => d.doneMs > state.worldMs)
        .map((d) => (
          <div key={d.tile} className="list-row small">
            <span>
              🏗️ {districtById(d.id).icon} {districtById(d.id).name} 공사 중
            </span>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'district', city: id, tile: d.tile }} compact />
          </div>
        ))}
      {(cc.mines ?? [])
        .filter((m) => m.doneMs > state.worldMs)
        .map((m) => (
          <div key={m.tile} className="list-row small">
            <span>⛏️ {m.res} 채굴장 공사 중</span>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'mine', city: id, tile: m.tile }} compact />
          </div>
        ))}
      {selTile && selMark ? (
        (() => {
          const lv = markLv(selMark.id);
          const st = cc.marks?.[selMark.id];
          const upWhy = C.canUpgradeMark(state, id, selMark.id);
          const cost = C.markCostOf(id, selMark.id, lv);
          const max = C.markMax(id, selMark.id);
          const home = selMark.home;
          return (
            <div className="civ-build">
              <div className="line-item">
                <span className="li-ico">{MARK_KIND[selMark.kind].icon}</span>
                <span className="li-main">
                  <b>
                    {home && '🏡 '}
                    {selMark.name} · {lv === 0 ? '빈 터' : `${lv}단계`}/{max}
                  </b>
                  <small>
                    {home ? '고향 전용 시설' : `${MARK_KIND[selMark.kind].name} 시설`}
                    {selMark.note ? ` · ${selMark.note.replace('고향 전용 · ', '')}` : ''}
                    <br />
                    {lv === 0 && home
                      ? `지으면(1단계마다): ${effText(home.eff)}`
                      : `지금 효과: ${effText(scaled(Object.fromEntries(Object.entries(MARK_KIND[selMark.kind].per).map(([k, v]) => [k, (v as number) * lv * MARK_SCALE + ((home?.eff as Record<string, number> | undefined)?.[k] ?? 0) * lv])) as CityEff, share))}`}
                    <br />
                    {st && st.doneMs > state.worldMs
                      ? `${st.lv}단계로 발전 공사 중 · ${timeLeft(st.doneMs - state.worldMs)}`
                      : lv < max
                        ? `${lv === 0 ? '짓기' : '다음 단계'}: 💰${fmt(cost.cost)} 🔩${cost.res.강철} · ${cost.hours}시간`
                        : '가장 높은 단계'}
                  </small>
                </span>
                {lv < max && !(st && st.doneMs > state.worldMs) && (
                  <button
                    className="primary"
                    disabled={!!upWhy}
                    title={upWhy ?? ''}
                    onClick={() => {
                      actions.apply((s) => C.upgradeMark(s, id, selMark.id));
                      setMsg(`🏗️ ${selMark.name} ${lv === 0 ? '짓기' : `${lv + 1}단계 발전`} 공사 시작! ${cost.hours}시간 뒤 완공`);
                    }}
                  >
                    {lv === 0 ? '🏗️ 짓기' : '⬆️ 발전'}
                  </button>
                )}
              </div>
            </div>
          );
        })()
      ) : selTile ? (
        <div className="civ-build">
          <small className="stat-group-name">
            고른 칸: {selTile.center ? '도심' : C.terrainOf(id, selTile.q, selTile.r)}
            {C.terrainOf(id, selTile.q, selTile.r) === '바닷가' ? ` · 옆 바다 ${C.seaAround(id, selTile.q, selTile.r)}칸` : ''}
            {map.gu && selTile.gu !== undefined ? ` · ${map.gu[selTile.gu]}` : ''}
          </small>
          {dep && !distAt(sel!) && (
            <div className="line-item">
              <span className="li-ico">{mineAt(sel!) ? '⛏️' : <ResIcon res={dep} />}</span>
              <span className="li-main">
                <b>
                  <ResIcon res={dep} inline /> {dep} 매장지
                </b>
                <small>
                  {mineAt(sel!)
                    ? mineAt(sel!)!.doneMs > state.worldMs
                      ? `채굴장 공사 중 · ${timeLeft(mineAt(sel!)!.doneMs - state.worldMs)}`
                      : `채굴장 가동 중 · ${dep} 시간당 +${C.MINE_PER_HOUR}`
                    : `채굴장을 지으면 ${dep} 시간당 +${C.MINE_PER_HOUR} · 💰${fmt(C.MINE_COST)} 🔩2 · ${C.MINE_HOURS}시간 (구역 칸 수와 따로)`}
                </small>
              </span>
              {!mineAt(sel!) && (
                <button
                  className="primary"
                  disabled={!!C.canMine(state, id, sel!)}
                  title={C.canMine(state, id, sel!) ?? ''}
                  onClick={() => {
                    actions.apply((s) => C.buildMine(s, id, sel!));
                    setMsg(`⛏️ ${dep} 채굴장 공사 시작! ${C.MINE_HOURS}시간 뒤 완공`);
                  }}
                >
                  ⛏️ 짓기
                </button>
              )}
            </div>
          )}
          {mineAt(sel!) ? null : distAt(sel!) ? (
            <p className="small">
              {districtById(distAt(sel!)!.id).icon} {districtById(distAt(sel!)!.id).name} · {districtById(distAt(sel!)!.id).text} · 이웃 보너스 {C.adjCount(id, sel!, distAt(sel!)!.id, cc)}개
            </p>
          ) : (
            <>
              <small className="stat-group-name">기본 구역</small>
              <div className="tiles c5">{baseDefs.map(buildTile)}</div>
              <small className="stat-group-name">🧪 군사 연구시설 (도시마다 1개씩)</small>
              <div className="tiles c4">{milDefs.map(buildTile)}</div>
            </>
          )}
        </div>
      ) : (
        <p className="small muted">
          칸을 누르면 지을 수 있는 구역이 나와요. {marks.length ? '🔵 실제 시설을 누르면 발전 단계를 올릴 수 있어요. ' : ''}매장지
          {C.deposits(id).length ? ` ${C.deposits(id).map((x) => RES_ICON[x.res]).join('')}` : ''}에는 채굴장을 지을 수 있어요.
        </p>
      )}
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

/* ═════════════ 외교: 호감 · 협정 ═════════════ */

export function FavorBox({ state, id }: { state: ScreenProps['state']; id: string }) {
  if (id === state.player.countryId) return null;
  const v = C.favorOf(state, id);
  const f = C.favorName(v);
  const rows = C.favorReasons(state, id);
  return (
    <div className="civ-favor">
      <div className="row">
        <span>
          {f.icon} 나에 대한 호감 <b className={v >= 0 ? 'good' : 'warn'}>{signed(v)}</b> <small className="muted">{f.name}</small>
        </span>
        <span className="small">
          {C.activeAgreements(state, id)
            .map((a) => agreeById(a.kind).icon)
            .join(' ')}
        </span>
      </div>
      <div className="civ-reasons">
        {rows.map(([k, x], i) => (
          <span key={i} className={`mini-chip ${x >= 0 ? 'pos' : 'neg'}`}>
            {k} {signed(Math.round(x))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgreePanel(props: ScreenProps) {
  const { state } = props;
  const me = state.player.countryId;
  const [pick, setPick] = useState<string | null>(null);
  const others = COUNTRIES.filter((c) => c.id !== me && isAlive(state.world, c.id)).sort((a, b) => C.favorOf(state, b.id) - C.favorOf(state, a.id));
  const c = C.civOf(state);
  return (
    <>
      <section className="card">
        <div className="row">
          <b>🤝 호감과 협정</b>
          <small className="muted">맺은 협정 {C.activeAgreements(state).length}</small>
          <Help title="호감·협정·불만 장부">
            <p>
              나라마다 나를 얼마나 좋아하는지(−100~+100)와 그 <b>이유</b>가 보여요. 대화에서 고른 태도, 같은 체제·신앙, 협정, 회의 투표가 쌓여요.
            </p>
            <p>
              <b>협정 5가지</b>(실제 1~3일): {AGREES.map((a) => `${a.icon}${a.name}`).join(' · ')}. 상대 호감이 충분해야 받아 줘요. 사회 제도 연구로 열려요.
            </p>
            <p>
              <b>😠 불만 장부</b>: 기습 침공(호감이 좋았거나 협정 중이던 나라에 선전포고), 협정 깨기, 성지 휴전 어기기는 오래 남고 이웃 나라도 함께 미워해요. 실제 하루에 10%씩 천천히 줄어요.
            </p>
          </Help>
        </div>
      </section>
      <div className="civ-nations">
        {others.map((x) => {
          const v = C.favorOf(state, x.id);
          const g = c.grievance[x.id] ?? 0;
          return (
            <button key={x.id} className="civ-nation" onClick={() => setPick(x.id)}>
              <span className="civ-nation-flag">{FLAG[x.id]}</span>
              <span className="civ-nation-main">
                <b>{x.name}</b>
                <small>
                  <RelTag state={state} id={x.id} /> {govById(c.aiGov[x.id]).icon} {C.activeAgreements(state, x.id).map((a) => agreeById(a.kind).icon).join('')}
                  {g >= 1 ? ` 😠${Math.round(g)}` : ''}
                </small>
              </span>
              <span className={`civ-favor-num ${v >= 0 ? 'good' : 'warn'}`}>
                {C.favorName(v).icon}
                <b>{signed(v)}</b>
              </span>
            </button>
          );
        })}
      </div>
      {pick && <AgreeModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function AgreeModal({ state, actions, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const act = C.activeAgreements(state, id);
  return (
    <Modal title={countryById(id).name} icon={FLAG[id]} onClose={onClose}>
      <FavorBox state={state} id={id} />
      <small className="stat-group-name">📜 협정</small>
      {AGREES.map((a) => {
        const on = act.find((x) => x.kind === a.id);
        const why = C.canAgree(state, id, a.id);
        return (
          <div key={a.id} className={`list-row ${why && !on ? 'is-locked' : ''}`}>
            <span>
              {a.icon} <b>{a.name}</b> <small className="muted">· {a.hours}시간 · 호감 {a.favorNeed} 이상</small>
              <br />
              <small className="muted">{a.text}</small>
            </span>
            {on ? (
              <span className="tag">남은 {timeLeft(on.untilMs - state.worldMs)}</span>
            ) : (
              <button
                className="primary"
                disabled={!!why}
                title={why ?? ''}
                onClick={() => {
                  actions.apply((s) => C.makeAgreement(s, id, a.id));
                  setMsg(`${a.icon} ${a.name} 협정을 맺었어요!`);
                }}
              >
                {why ? why.replace('국방예산 ', '💰') : `맺기 ${fmt(a.cost)}`}
              </button>
            )}
          </div>
        );
      })}
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

/* ═════════════ 분쟁 섬 영향력 ═════════════ */

export function IslandPanel(props: ScreenProps) {
  const { state } = props;
  const me = state.player.countryId;
  const [pick, setPick] = useState<string | null>(null);
  const c = C.civOf(state);
  const ready = state.worldMs >= c.envoyReadyMs;
  return (
    <>
      <section className="card">
        <div className="row">
          <span>
            🏝️ 1등인 섬 <b>{C.myIslands(state).length}</b>/12
          </span>
          <small className={ready ? 'good' : 'muted'}>🕊️ 사절 {ready ? '준비됨' : timeLeft(c.envoyReadyMs - state.worldMs)}</small>
          <Help title="분쟁 섬 영향력">
            <p>여러 나라가 실제로 다투는 섬 12곳마다 주민 대표가 있어요. 그 섬을 실제로 다투는 나라는 영향력이 20% 더 쌓이고, 남이 1등을 하면 그 나라와 긴장이 조금씩 올라요.</p>
            <p> 사절을 보내거나(예산 {fmt(ENVOY_COST)}) 섬 부탁(자원 보내기)을 들어주면 영향력이 쌓여요.</p>
            <p>
              영향력 1등이면서 {ISLAND_LEAD_MIN} 이상이면 그 섬 자원을 시간당 {ISLAND_RES_PER_HOUR}개 받고, 국제 회의 표가 1장 늘어요. 다른 나라도 가까운 섬에 영향력을 쌓아요.
            </p>
            <p>국민 의회 체제·사절단 연구·상주 사절 카드로 영향력이 더 많이 쌓여요.</p>
          </Help>
        </div>
      </section>
      <div className="tiles c3 isle-tiles">
        {PIONEER_ISLANDS.map((p) => {
          const lead = C.islandLeader(state, p.id);
          const mineV = c.influence[p.id]?.[me] ?? 0;
          return (
            <Tile
              key={p.id}
              icon={<IslandIcon id={p.id} badge={lead.id ? FLAG[lead.id] : p.res === '항구' ? '⚓' : <ResIcon res={p.res} inline />} />}
              label={`${p.name}${claimsIsland(p.id, me) ? ' ★' : ''}`}
              sub={`나 ${Math.round(mineV)} · ${lead.id ? (lead.id === me ? '1등!' : countryById(lead.id).name.slice(0, 4)) : '주인 없음'}`}
              tone={lead.id === me ? 'gold' : undefined}
              onClick={() => setPick(p.id)}
            />
          );
        })}
      </div>
      {pick && <IslandModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function IslandModal({ state, actions, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const p = PIONEER_ISLANDS.find((x) => x.id === id)!;
  const me = state.player.countryId;
  const real = REAL_ISLANDS[id];
  const inf = C.civOf(state).influence[id] ?? {};
  const top = Object.entries(inf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const max = Math.max(ISLAND_LEAD_MIN, ...top.map(([, v]) => v));
  const req = C.islandRequest(state, id);
  const ev = C.canEnvoy(state, id);
  const fu = C.canFulfill(state, id);
  const [msg, setMsg] = useState('');
  return (
    <Modal title={p.name} icon={islandArtUrl(p.id) ? undefined : '🏝️'} onClose={onClose}>
      <div className={islandArtUrl(p.id) ? 'unit-hero' : ''}>
        {islandArtUrl(p.id) && (
          <div className="unit-photo island-photo">
            <IslandIcon id={p.id} />
          </div>
        )}
        {real && (
          <div className="small isle-real">
            {real.alt && <div className="muted">다른 이름: {real.alt}</div>}
            <div>
              ⚔️ 다투는 나라: {real.sides.map((x) => `${FLAG[x]} ${countryById(x).name}`).join(' · ')}
              {real.others.length > 0 && <span className="muted"> · {real.others.join(' · ')}</span>}
            </div>
            <div className="muted">📜 {real.story}</div>
            {claimsIsland(id, me) && <div className="good">★ 우리가 다투는 섬: 영향력 +{Math.round(CLAIM_INFLUENCE * 100)}%</div>}
          </div>
        )}
        <p className="small">
          나는 자원:{' '}
          {p.res === '항구' ? (
            '⚓ 큰 항구(국방예산 +3%)'
          ) : (
            <>
              <ResIcon res={p.res} inline /> {p.res} 시간당 {ISLAND_RES_PER_HOUR}개
            </>
          )}
          <br />1등이 되려면 영향력 {ISLAND_LEAD_MIN} 이상
        </p>
      </div>
      <small className="stat-group-name">📊 영향력</small>
      {top.length === 0 && <p className="small muted">아직 아무도 사절을 보내지 않았어요.</p>}
      {top.map(([who, v]) => (
        <div key={who} className="civ-inf">
          <span>
            {FLAG[who]} {who === me ? <b>우리</b> : countryById(who).name}
          </span>
          <Meter value={v} max={max} tone={who === me ? 'gold' : 'blue'} />
          <b>{Math.round(v)}</b>
        </div>
      ))}
      <div className="grid2" style={{ marginTop: 8 }}>
        <button
          className="primary"
          disabled={!!ev}
          onClick={() => {
            actions.apply((s) => C.sendEnvoy(s, id));
            setMsg('🕊️ 사절을 보냈어요!');
          }}
        >
          🕊️ 사절 보내기
          <br />
          <small>{ev ?? `${fmt(ENVOY_COST)} · 영향력 +${Math.round(10 * C.influenceMult(state, id))}`}</small>
        </button>
        <button
          className="gold"
          disabled={!!fu}
          onClick={() => {
            actions.apply((s) => C.fulfillRequest(s, id));
            setMsg('📦 부탁을 들어줬어요!');
          }}
        >
          📦 섬 부탁
          <br />
          <small>{req.done ? '들어줬어요(12시간마다 바뀜)' : `${RES_ICON[req.res]} ${req.res} ${req.qty}개 보내기${fu ? ` · ${fu}` : ''}`}</small>
        </button>
      </div>
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}

/* ═════════════ 국제 회의 ═════════════ */

export function CouncilPanel(props: ScreenProps) {
  const { state, actions } = props;
  const c = C.civOf(state);
  const o = c.council.open;
  const me = state.player.countryId;
  const active = c.council.active.filter((a) => a.untilMs > state.worldMs);
  return (
    <>
      <section className="card civ-council">
        <div className="row">
          <b>🏛️ 고대 성지 · 국제 회의</b>
          <Help title="국제 회의">
            <p>고대 성지에서 실제 하루마다 회의가 열려요. 안건에 나라들이 표를 던지고, 통과하면 하루 동안 효과가 있어요.</p>
            <ul>
              {AGENDAS.map((a) => (
                <li key={a.id}>
                  {a.icon} <b>{a.name}</b>: {a.text}
                </li>
              ))}
            </ul>
            <p>표 = 1 + 1등인 분쟁 섬 수 + 체제·연구·카드. 나를 좋아하는 나라는 내 표를 따라오기도 해요. 6시간 안에 투표하지 않으면 부관이 체제 성향대로 골라요.</p>
            <p>설정에서 회의를 끌 수 있어요.</p>
          </Help>
        </div>
        {!c.council.on ? (
          <p className="small muted">회의가 꺼져 있어요. 설정에서 켤 수 있어요.</p>
        ) : o ? (
          <div className="civ-agenda">
            <span className="civ-agenda-ico">{agendaById(o.agenda).icon}</span>
            <div>
              <b>
                {agendaById(o.agenda).name}
                {o.target ? ` → ${countryById(o.target).name}` : ''}
              </b>
              <small className="muted">{agendaById(o.agenda).text}</small>
              <small>
                ⏳ 투표 마감 {timeLeft(o.untilMs - state.worldMs)} · 내 표 {C.councilVotes(state, me)}장
              </small>
            </div>
          </div>
        ) : (
          <p className="small muted">다음 회의까지 {timeLeft(c.council.nextMs - state.worldMs)}</p>
        )}
        {o && c.council.on && (
          <div className="grid2">
            <button className={`primary ${o.vote === true ? 'on' : ''}`} disabled={o.vote !== null} onClick={() => actions.apply((s) => C.voteCouncil(s, true))}>
              👍 찬성
            </button>
            <button className={`danger ${o.vote === false ? 'on' : ''}`} style={{ marginTop: 0 }} disabled={o.vote !== null} onClick={() => actions.apply((s) => C.voteCouncil(s, false))}>
              👎 반대
            </button>
          </div>
        )}
        {o?.vote !== null && o && <p className="small good">투표했어요: {o.vote ? '찬성' : '반대'}. 마감 때 결과가 나와요.</p>}
      </section>
      {c.council.on && (
        <section className="card">
          <small className="stat-group-name">🗳️ 나라별 표</small>
          <div className="civ-govs">
            {COUNTRIES.filter((x) => isAlive(state.world, x.id)).map((x) => (
              <span key={x.id} className={`mini-chip ${x.id === me ? 'same' : ''}`}>
                {FLAG[x.id]} {C.councilVotes(state, x.id)}
              </span>
            ))}
          </div>
        </section>
      )}
      {(active.length > 0 || c.council.last) && (
        <section className="card">
          {active.map((a, i) => (
            <p key={i} className="small">
              ✅ {agendaById(a.agenda).icon} {agendaById(a.agenda).name}
              {a.target ? `(${countryById(a.target).name})` : ''} · 남은 {timeLeft(a.untilMs - state.worldMs)}
            </p>
          ))}
          {c.council.last && <p className="small muted">지난 회의: {c.council.last}</p>}
        </section>
      )}
    </>
  );
}

