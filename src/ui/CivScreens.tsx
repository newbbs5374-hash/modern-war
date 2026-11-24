// 문명식 운영 화면: 내정 탭(연구 · 체제 · 도시) + 외교 탭(호감·협정 · 분쟁 섬 · 국제 회의).
// 그림(아이콘) 위주, 자세한 내용은 팝업, 설명은 (?) 도움말.
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
import { CityView, type CityCell, type CityThing } from './CityView';
import { smoothPath, type Seg } from './smoothHex';
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
              <b>선</b>: 위 기술에서 아래 기술로 이어진 선은 "먼저 해야 하는 연구"예요. 청록 선은 끝남, 주황 선은 지금 열 수 있음, 흐린 점선은 아직 멀었음.
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

const TREE_COLS = 5;
/** 시대마다 5칸×2줄에 놓기: 선행 기술 바로 아래 칸을 먼저 잡아 선이 덜 꼬이게 */
export function layoutTree(list: Tech[]): Record<string, { era: number; col: number; row: number }> {
  const pos: Record<string, { era: number; col: number; row: number }> = {};
  for (const era of [1, 2, 3, 4]) {
    const here = list.filter((t) => t.era === era);
    const ids = new Set(here.map((t) => t.id));
    const rows = Math.max(1, Math.ceil(here.length / TREE_COLS));
    const free = new Set<string>();
    for (let r = 0; r < rows; r++) for (let col = 0; col < TREE_COLS; col++) free.add(`${col},${r}`);
    const put = (t: Tech, want: number | null, rowPref: number) => {
      let best: string | null = null;
      let bestScore = Infinity;
      for (const k of free) {
        const [col, r] = k.split(',').map(Number);
        const score = (want == null ? col * 0.01 : Math.abs(col - want)) + Math.abs(r - rowPref) * 0.6;
        if (score < bestScore) (bestScore = score), (best = k);
      }
      if (!best) return;
      free.delete(best);
      const [col, row] = best.split(',').map(Number);
      pos[t.id] = { era, col, row };
    };
    const want = (t: Tech) => {
      const ps = t.needs.map((n) => pos[n]).filter(Boolean);
      return ps.length ? ps.reduce((a, p) => a + p.col, 0) / ps.length : null;
    };
    const outer = here.filter((t) => t.needs.length && t.needs.every((n) => !ids.has(n)));
    const inner = here.filter((t) => t.needs.some((n) => ids.has(n)));
    const roots = here.filter((t) => !t.needs.length);
    const rootsWithKids = roots.filter((t) => inner.some((x) => x.needs.includes(t.id)));
    for (const t of [...outer].sort((a, b) => (want(a) ?? 0) - (want(b) ?? 0))) put(t, want(t), 0);
    for (const t of rootsWithKids) put(t, null, 0);
    for (const t of inner) put(t, want(t), rows - 1);
    for (const t of roots.filter((x) => !rootsWithKids.includes(x))) put(t, null, 0);
  }
  return pos;
}

/** 선 길: 바로 아래 줄이면 부드러운 곡선, 사이에 다른 칸이 있으면 칸 사이 틈(골목)으로 돌아감 */
function treePath(from: DOMRect, to: DOMRect, b: DOMRect, lanes: Record<string, number>): string {
  const x1 = from.left + from.width / 2 - b.left;
  const y1 = from.bottom - b.top;
  const x2 = to.left + to.width / 2 - b.left;
  const y2 = to.top - b.top;
  if (y2 <= y1 + 2) return `M${x1},${from.top + from.height / 2 - b.top} L${x2},${to.top + to.height / 2 - b.top}`;
  if (y2 - y1 < from.height * 0.7) {
    const my = (y1 + y2) / 2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }
  // 칸 사이 세로 골목: 후속 쪽 옆 틈
  const right = x2 >= x1;
  const gx = Math.round(right ? from.right - b.left + 3 : from.left - b.left - 3);
  const lane = (lanes[gx] = (lanes[gx] ?? -1) + 1);
  const off = ((lane % 3) - 1) * 2;
  const gxx = gx + off;
  const ya = y1 + 6 + (lane % 3) * 2;
  const yb = y2 - 6 - (lane % 3) * 2;
  return roundPath(
    [
      [x1, y1],
      [x1, ya],
      [gxx, ya],
      [gxx, yb],
      [x2, yb],
      [x2, y2],
    ],
    5,
  );
}
function roundPath(pts: Array<[number, number]>, r: number): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    if (!(k > 0.5)) {
      d += ` L${x},${y}`;
      continue;
    }
    d += ` L${x - ((x - px) / l1) * k},${y - ((y - py) / l1) * k} Q${x},${y} ${x + ((nx - x) / l2) * k},${y + ((ny - y) / l2) * k}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx},${ly}`;
}

/** 연구 나무: 시대별 칸 + 선행 → 후속을 잇는 선 */
function TechTree({ state, list, onPick }: ScreenProps & { list: Tech[]; onPick: (t: Tech) => void }) {
  const c = C.civOf(state);
  const pos = useMemo(() => layoutTree(list), [list]);
  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Array<{ key: string; d: string; cls: string }>>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sig = `${c.done.join()}|${c.cur.mil}|${c.cur.soc}`;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const draw = () => {
      const b = el.getBoundingClientRect();
      const at: Record<string, DOMRect> = {};
      el.querySelectorAll<HTMLElement>('[data-tech]').forEach((n) => (at[n.dataset.tech!] = n.getBoundingClientRect()));
      const out: Array<{ key: string; d: string; cls: string }> = [];
      const lanes: Record<string, number> = {};
      for (const t of list) {
        const to = at[t.id];
        if (!to) continue;
        for (const n of t.needs) {
          const from = at[n];
          if (!from) continue;
          const d = treePath(from, to, b, lanes);
          const pd = c.done.includes(n);
          const cd = c.done.includes(t.id);
          const now = c.cur[t.line] === t.id;
          const cls = cd ? 'done' : now ? 'now' : pd ? 'open' : 'far';
          out.push({ key: `${n}>${t.id}`, d, cls });
        }
      }
      const order = { far: 0, open: 1, done: 2, now: 3 } as Record<string, number>;
      out.sort((a, z) => order[a.cls] - order[z.cls]);
      setLines(out);
      setSize({ w: b.width, h: b.height });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list, sig]);
  return (
    <div className="tech-tree" ref={box}>
      <svg className="tech-lines" width={size.w} height={size.h} aria-hidden>
        {lines.map((l) => (
          <path key={l.key} d={l.d} className={l.cls} />
        ))}
      </svg>
      {([1, 2, 3, 4] as const).map((era) => (
        <div key={era} className="civ-era-row">
          <small className="stat-group-name">
            <ArtIcon k={eraArtKey(era)} emoji={ERAS[era].icon} cls="inline" /> {ERAS[era].name}
          </small>
          <div className="tiles c5">
            {list
              .filter((t) => t.era === era)
              .map((t) => {
                const done = C.hasTech(state, t.id);
                const now = c.cur[t.line] === t.id;
                const why = C.canResearch(state, t.id);
                const st = C.techStage(state, t.id);
                const prog = C.techProgress(state, t);
                const p = pos[t.id];
                return (
                  <div key={t.id} className="tt-cell" data-tech={t.id} style={p ? { gridColumn: p.col + 1, gridRow: p.row + 1 } : undefined}>
                    <Tile
                      icon={<ArtIcon k={techArtKey(t.id)} emoji={t.icon} alt={t.name} />}
                      label={t.name}
                      sub={done ? '✓ 완료' : now ? `${st + 1}단계 ${Math.round(prog * 100)}%` : why ? '선행 연구' : st ? `${st}/${C.TECH_STAGES}단계` : `${r1(C.techCost(state, t) * C.TECH_STAGES)}시간`}
                      badge={!done && c.eureka.includes(t.id) ? '💡' : null}
                      tone={done ? 'green' : now ? 'gold' : undefined}
                      locked={!done && !now && !!why && why.startsWith('먼저')}
                      onClick={() => onPick(t)}
                    >
                      {!done && (st > 0 || now) && <StagePips n={st} cur={now} />}
                    </Tile>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TechModal({ state, t, onClose, onGo }: ScreenProps & { t: Tech; onClose: () => void; onGo: (id: string) => void }) {
  const c = C.civOf(state);
  const done = C.hasTech(state, t.id);
  const now = c.cur[t.line] === t.id;
  const why = C.canResearch(state, t.id);
  const me = state.player.countryId;
  const unlocks: string[] = [
    ...(t.units ?? []).flatMap((u) => [`🪖 ${u}`, ...specialsFor(me, u).map((d) => `🌟 ${d.name}`)]),
    ...(t.cards ?? []).map((k) => cardById(k)).filter(Boolean).map((k) => `🃏 ${k!.name}`),
    ...(t.districts ?? []).map((d) => `${districtById(d).icon} ${districtById(d).name}`),
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
          <span className="muted">연구 중이에요</span>
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
            <p>도시마다 육각 칸이 있어요(소도시 19 · 중도시 37 · 대도시 61칸). 칸에 <b>구역</b>을 지어요: 소도시 1 · 중도시 2 · 대도시 3개.</p>
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
          return (
            <button key={city.id} className={`civ-city ${cc.loyalty < LOYALTY_OK ? 'low' : ''}`} onClick={() => setPick(city.id)}>
              <span className="civ-city-top">
                <b>
                  {city.capital ? '👑 ' : ''}
                  {city.name}
                </b>
                <span>{loyaltyFace(cc.loyalty)}</span>
              </span>
              <Meter value={cc.loyalty} max={100} tone={cc.loyalty >= LOYALTY_OK ? 'green' : 'red'} />
              <small className="muted">
                👪{cc.pop} · {cc.districts.map((d) => districtById(d.id).icon).join('') || '구역 없음'} {cc.districts.length}/{C.districtSlots(state, city.id)}
                {building ? ' 🏗️' : ''}
                {city.home !== me ? ' · 점령지' : ''}
              </small>
            </button>
          );
        })}
      </div>
      {pick && <CityModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

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

function CityModal({ state, actions, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const city = cityById(id);
  const cc = C.cityCiv(state, id);
  const tiles = C.cityTiles(id);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const distAt = (k: string) => cc.districts.find((d) => d.tile === k);
  const mineAt = (k: string) => (cc.mines ?? []).find((m) => m.tile === k);
  const selTile = sel ? tiles.find((t) => hexKey(t.q, t.r) === sel) : null;
  const dep = sel ? C.depositAt(id, sel) : null;
  const target = C.loyaltyTarget(state, id);
  const coast = useMemo(() => cityCoast(tiles), [id]);
  const now = state.worldMs;
  const cells = useMemo((): CityCell[] => {
    const center = tiles.find((t) => t.center) ?? tiles[0];
    const base = tiles.map((t) => {
      const k = hexKey(t.q, t.r);
      const ground = C.terrainOf(t.q, t.r);
      const d = cc.districts.find((x) => x.tile === k);
      const m = (cc.mines ?? []).find((x) => x.tile === k);
      const dp = C.depositAt(id, k);
      let thing = null as CityThing | null;
      if (t.center) thing = 'center';
      else if (d) thing = d.id;
      else if (m) thing = 'mine';
      else if (dp) thing = null;
      else if (ground === '산') thing = 'mountain';
      else if (ground === '유적') thing = 'ruins';
      return {
        key: k,
        x: t.x,
        y: t.y,
        ground,
        thing,
        building: (d && d.doneMs > now) || (m && m.doneMs > now) || false,
        deposit: dp && !d ? RES_ICON[dp] : null,
        mined: !!m,
        dist: hexDist(t, center),
      };
    });
    // 빈 땅: 도심 가까이엔 인구만큼 마을, 멀리엔 군데군데 숲
    const empty = base.filter((c) => !c.thing && !c.deposit).sort((a, b) => a.dist - b.dist);
    empty.slice(0, cc.pop).forEach((c) => (c.thing = 'suburb'));
    empty.slice(cc.pop).forEach((c) => {
      const h = (Math.abs(Math.round(c.x * 7 + c.y * 13)) * 2654435761) % 97;
      if (c.dist >= 2 && h % 3 === 0) c.thing = 'forest';
    });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cc.districts, cc.mines, cc.pop, Math.floor(now / 60000)]);
  return (
    <Modal title={city.name} icon={city.capital ? '👑' : '🏙️'} onClose={onClose}>
      <div className="row">
        <span>
          {loyaltyFace(cc.loyalty)} 민심 <b>{Math.round(cc.loyalty)}</b> <small className="muted">→ {Math.round(target)}</small>
        </span>
        <span>
          👪 인구 <b>{cc.pop}</b>/{C.popCap(state, id)}
        </span>
        <Tip label="이유" title="민심 목표" rows={C.loyaltyReasons(state, id).map(([k, v]) => [k, signed(Math.round(v))])} total={`${Math.round(target)}`} />
      </div>
      {cc.loyalty < LOYALTY_OK && <p className="small warn">민심이 낮아 이 도시 생산 ×{r1(C.loyaltyMult(cc.loyalty))} (도시는 잃지 않아요)</p>}
      <CityView cells={cells} coast={coast} sel={sel} onPick={(k) => (setSel(k), setMsg(''))} uid={id} inland={!isCoastalCity(id)} />
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
        <span>◌ 매장지 · ⛏️ 채굴장</span>
      </div>
      <p className="small muted">{isCoastalCity(id) ? '🌊 바다에 닿은 도시 · 가장자리 바닷가 칸에 ⚓항만을 지을 수 있어요' : '🏞️ 내륙 도시 · ⚓항만은 못 지어요(🛫비행장은 돼요)'}</p>
      <p className="small">
        구역 {cc.districts.length}/{C.districtSlots(state, id)} ·{' '}
        {cc.districts.map((d) => `${districtById(d.id).icon}${d.doneMs > state.worldMs ? `(${timeLeft(d.doneMs - state.worldMs)})` : ''}`).join(' ') || '아직 없음'}
      </p>
      {selTile ? (
        <div className="civ-build">
          <small className="stat-group-name">
            고른 칸: {selTile.center ? '도심' : C.terrainOf(selTile.q, selTile.r)}
            {C.terrainOf(selTile.q, selTile.r) === '바닷가' ? ` · 옆 바다 ${C.seaAround(selTile.q, selTile.r)}칸` : ''}
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
              {districtById(distAt(sel!)!.id).icon} {districtById(distAt(sel!)!.id).name} · 이웃 보너스 {C.adjCount(id, sel!, distAt(sel!)!.id, cc)}개
            </p>
          ) : (
            <div className="tiles c5">
              {DISTRICTS.map((d) => {
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
                      setMsg(`${d.icon} ${d.name} 공사 시작! ${r1(C.districtHours(state, d.id))}시간 뒤 완공`);
                      setSel(null);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <p className="small muted">
          칸을 누르면 지을 수 있는 구역이 나와요. 이웃 보너스가 큰 자리를 골라 보세요. 매장지
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
            <p>주인 없는 분쟁 섬 12곳마다 주민 대표가 있어요. 사절을 보내거나(예산 {fmt(ENVOY_COST)}) 섬 부탁(자원 보내기)을 들어주면 영향력이 쌓여요.</p>
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
              label={p.name}
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
          <small>{ev ?? `${fmt(ENVOY_COST)} · 영향력 +${Math.round(10 * C.influenceMult(state))}`}</small>
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

