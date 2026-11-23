// ⑥ 지도 위 전투 화면: 실제 육각 지도에서 부대 말을 움직여 도시를 점령.
// 계산은 battle/field.ts, 여기서는 그리고 누르는 것만.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CAPTURERS,
  FIELD_HEX,
  FIELD_LIMIT,
  FUNIT,
  SUPPLY_CARRIER,
  SUPPLY_RANGE,
  TERRAIN_INFO,
  baseOf,
  bossDifficulty,
  bossName,
  canSeeUnit,
  createField,
  defOf,
  fDist,
  moveNeed,
  unitName,
  finishField,
  gameTime,
  orderMove,
  resolveBoss,
  skipBoss,
  stepField,
  visibleSet,
  type FTerrain,
  type FUnit,
  type FieldBattle,
} from '../../battle/field';
import { hexCorners } from '../../data/hexmap';
import { cityById } from '../../data/cities';
import { FX_ART, TILE_ART, UNIT_ART, fieldArt, spArt } from '../fieldArt';
import { Modal } from '../kit';
import { BattleBar, type FrameProps } from './BattleScreen';
import { fieldArmy } from '../../battle/auto';
import { SideView } from './SideView';
import { GridView } from './GridView';
import { FieldFx, fxMood } from './FieldFx';

const SIDE_COLOR = { me: '#2563eb', foe: '#dc2626' };
const STEP = 0.25;
/** ×1 = 전투 1초를 실제 1초에 */
const RATE = 1;
/** 확대 한도 */
const ZMAX = 3.5;

export function FieldView(props: FrameProps) {
  const { spec, stats, rank, onEnd } = props;
  const bRef = useRef<FieldBattle | null>(null);
  if (!bRef.current) bRef.current = createField({ city: spec.city, difficulty: spec.difficulty, rank, stats, seed: spec.seed, enemy: spec.enemy, defense: spec.defense, ...fieldArmy(spec) });
  const b = bRef.current;
  const [, setFrame] = useState(0);
  const redraw = () => setFrame((x) => x + 1);
  const [auto, setAutoState] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [duel, setDuel] = useState<null | 'hq' | 'cruiser'>(null);
  const [help, setHelp] = useState(false);
  const ended = useRef(false);
  const acc = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const runRef = useRef(true);
  runRef.current = !paused && !duel && !help;

  // 실시간: 0.1초마다 흘림(0.25초 단위로 계산해서 같은 조작이면 같은 결과)
  useEffect(() => {
    const t = setInterval(() => {
      const cur = bRef.current!;
      if (!runRef.current || cur.result || cur.prompt) return;
      acc.current += 0.05 * speedRef.current * RATE;
      while (acc.current >= STEP && !cur.result && !cur.prompt) {
        stepField(cur, STEP);
        acc.current -= STEP;
      }
      // 계산은 0.25초 단위, 그림은 그 사이도 부드럽게(연출 시간 = b.t + 남은 몫)
      redraw();
    }, 50);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (b.result && !ended.current) {
      ended.current = true;
      onEnd(b.result);
    }
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const f = b.field;
  /** 연출용 시간: 계산 시간 + 아직 계산 안 한 몫 */
  const vt = b.t + (b.result || b.prompt ? 0 : acc.current);
  const vis = visibleSet(b, 'me');
  const seen = b.units.filter((u) => canSeeUnit(b, 'me', u, vis));
  const selU = sel !== null ? b.units.find((u) => u.id === sel && u.side === 'me') ?? null : null;
  const minX = Math.min(...f.cells.map((c) => c.x)) - FIELD_HEX;
  const minY = Math.min(...f.cells.map((c) => c.y)) - FIELD_HEX;
  const W = f.w + 2;
  const H = f.h + 2;
  // 확대·축소·끌어서 옮기기(보이는 범위 = 가운데 cx,cy · 배율 zoom)
  const [view, setView] = useState({ zoom: 1, cx: minX + W / 2, cy: minY + H / 2 });
  const clampView = (v: { zoom: number; cx: number; cy: number }) => {
    const zoom = Math.max(1, Math.min(ZMAX, v.zoom));
    const hw = W / zoom / 2;
    const hh = H / zoom / 2;
    return { zoom, cx: Math.max(minX + hw, Math.min(minX + W - hw, v.cx)), cy: Math.max(minY + hh, Math.min(minY + H - hh, v.cy)) };
  };
  const zoomBy = (k: number, at?: { x: number; y: number }) =>
    setView((v) => {
      const zoom = Math.max(1, Math.min(ZMAX, v.zoom * k));
      const p = at ?? { x: v.cx, y: v.cy };
      // 누른 자리가 화면에서 그대로 있게
      return clampView({ zoom, cx: p.x + (v.cx - p.x) * (v.zoom / zoom), cy: p.y + (v.cy - p.y) * (v.zoom / zoom) });
    });
  const vw = W / view.zoom;
  const vh = H / view.zoom;
  const vx = view.cx - vw / 2;
  const vy = view.cy - vh / 2;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; moved: number }>({ dist: 0, moved: 0 });
  const dragged = useRef(false);
  /** 화면 좌표 → 지도 좌표 */
  const toMap = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: vx + ((clientX - r.left) / r.width) * vw, y: vy + ((clientY - r.top) / r.height) * vh };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current.moved = 0;
      dragged.current = false;
    }
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      gesture.current.dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const r = svgRef.current!.getBoundingClientRect();
    if (pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (gesture.current.dist > 0 && d > 0) zoomBy(d / gesture.current.dist, toMap((p1.x + p2.x) / 2, (p1.y + p2.y) / 2));
      gesture.current.dist = d;
      dragged.current = true;
      return;
    }
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved > 8) dragged.current = true;
    if (view.zoom > 1 && dragged.current) setView((v) => clampView({ ...v, cx: v.cx - (dx / r.width) * vw, cy: v.cy - (dy / r.height) * vh }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.dist = 0;
  };
  const onWheel = (e: React.WheelEvent) => zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, toMap(e.clientX, e.clientY));
  const mood = fxMood(b, vt);
  const shakeX = mood.shake ? Math.sin(vt * 90) * 1.6 * mood.shake : 0;
  const shakeY = mood.shake ? Math.cos(vt * 70) * 1.2 * mood.shake : 0;
  const polys = useMemo(() => f.cells.map((c) => hexCorners(c.x, c.y, FIELD_HEX - 0.4).map((p) => p.join(',')).join(' ')), [f]);
  const terrains = useMemo(() => [...new Set(f.cells.map((c) => c.terrain))], [f]);

  // 고른 부대의 작전 범위(비행 부대)·보급 범위(육군)
  const rangeCells = useMemo(() => {
    if (!selU) return null;
    const def = FUNIT[selU.kind];
    if (def.layer === 'air') {
      const base = baseOf(b, selU);
      if (base === null) return null;
      return { cells: f.cells.map((_, i) => fDist(f, base, i) <= (def.op ?? 4)), color: '#fde047', label: `작전 범위 ${def.op}칸` };
    }
    if (selU.kind === 'carrier') {
      return { cells: f.cells.map((_, i) => fDist(f, selU.at, i) <= 4), color: '#fde047', label: '전투기 작전 범위 4칸' };
    }
    if (def.layer === 'land') {
      const cv = b.units.filter((u) => u.side === 'me' && u.kind === 'carrier');
      return { cells: f.cells.map((_, i) => fDist(f, f.landing, i) <= SUPPLY_RANGE || cv.some((c) => fDist(f, c.at, i) <= SUPPLY_CARRIER)), color: '#4ade80', label: '보급 범위' };
    }
    return null;
  }, [selU?.id, selU?.at, b.t]);

  const setAuto = (v: boolean) => {
    b.auto = v;
    setAutoState(v);
    if (v) setSel(null);
  };

  const tapCell = (i: number) => {
    if (b.result) return;
    // 끌거나 두 손가락으로 확대한 뒤에는 누른 것으로 치지 않음
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    const here = b.units.filter((u) => u.at === i && u.side === 'me');
    if (here.length) {
      // 같은 칸에 땅·하늘 부대가 겹치면 누를 때마다 번갈아
      const cur = here.findIndex((u) => u.id === sel);
      const next = here[(cur + 1) % here.length];
      if (cur < 0 || here.length > 1) {
        setSel(next.id);
        return;
      }
    }
    if (selU) {
      if (auto) return setToast('자동 지휘 중이에요. 🤖 자동을 끄면 직접 움직일 수 있어요');
      const why = orderMove(b, selU.id, i);
      if (why) setToast(why);
      else redraw();
      return;
    }
    const foe = seen.find((u) => u.at === i && u.side === 'foe');
    if (foe) setToast(`${foe.sp ? '🌟' : ''}${unitName(foe)} · 체력 ${Math.ceil(foe.hp)}/${foe.maxHp} · ${defOf(foe).does}`);
    else setToast(`${f.cells[i].terrain}: ${TERRAIN_INFO[f.cells[i].terrain].text}`);
  };

  // 부대 말의 그릴 자리(다음 칸 쪽으로 조금씩 움직이는 모습)
  const posOf = (u: FUnit) => {
    const a = f.cells[u.at];
    if (!u.path.length) return { x: a.x, y: a.y };
    const n = f.cells[u.path[0]];
    const need = moveNeed(u, n.terrain);
    const k = Math.min(0.85, need ? (u.mv + (b.result || b.prompt ? 0 : acc.current)) / need : 0);
    return { x: a.x + (n.x - a.x) * k, y: a.y + (n.y - a.y) * k };
  };

  const hq = b.units.find((u) => u.kind === 'hq');
  const mine = b.units.filter((u) => u.side === 'me');
  const troops = mine.filter((u) => CAPTURERS.includes(u.kind)).length;
  const foesSeen = seen.filter((u) => u.side === 'foe').length;
  const promptBoss = b.prompt ? b.units.find((u) => u.id === b.prompt!.boss) : null;

  if (duel) {
    const sub = {
      ...props,
      spec: {
        ...spec,
        frame: duel === 'hq' ? ('side' as const) : ('grid' as const),
        variant: duel === 'hq' ? 'breakthrough' : 'naval',
        title: bossName(duel),
        seed: spec.seed + 777,
        difficulty: bossDifficulty(b, duel),
      },
      onEnd: (r: { win: boolean }) => {
        resolveBoss(b, r.win);
        setDuel(null);
        setToast(r.win ? `${bossName(duel)} 승리!` : `${bossName(duel)}에서 밀렸어요`);
        redraw();
      },
    };
    return (
      <div className="field-duel">
        <p className="small">
          🎮 <b>{bossName(duel)}</b> 직접 지휘 중 · 끝나면 지도로 돌아가요
        </p>
        {duel === 'hq' ? <SideView {...sub} /> : <GridView {...sub} />}
      </div>
    );
  }

  return (
    <div className="field">
      <div className="field-hud">
        <span>⏱ 남은 {gameTime(Math.max(0, FIELD_LIMIT - b.t))}</span>
        <span>🟦 {mine.length}</span>
        <span>🟥 {foesSeen} 보임</span>
        {hq && vis.has(hq.at) ? (
          <span className="field-hqbar" title="적 사령부">
            🏯
            <b>
              <i style={{ width: `${(hq.hp / hq.maxHp) * 100}%` }} />
            </b>
          </span>
        ) : (
          <span>{b.hqDown ? '🏯 무너짐 → 도심으로!' : '🏯 ?'}</span>
        )}
        <button className="help" onClick={() => setHelp(true)} aria-label="지도 전투 도움말">
          ?
        </button>
      </div>
      <div className="field-stage">
      <svg
        ref={svgRef}
        className={`field-map ${view.zoom > 1 ? 'zoomed' : ''}`}
        viewBox={`${vx + shakeX} ${vy + shakeY} ${vw} ${vh}`}
        role="img"
        aria-label={`${cityById(f.city).name} 주변 지도`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <defs>
          {terrains.map((t) => {
            const url = fieldArt(TILE_ART[t]);
            return url ? (
              <pattern key={t} id={`ft-${TILE_ART[t]}`} patternUnits="userSpaceOnUse" width={FIELD_HEX * 4} height={FIELD_HEX * 4}>
                <image href={url} width={FIELD_HEX * 4} height={FIELD_HEX * 4} preserveAspectRatio="xMidYMid slice" />
              </pattern>
            ) : null;
          })}
        </defs>
        {f.cells.map((c, i) => (
          <polygon
            key={i}
            points={polys[i]}
            fill={fieldArt(TILE_ART[c.terrain]) ? `url(#ft-${TILE_ART[c.terrain]})` : TERRAIN_INFO[c.terrain].color}
            stroke={c.terrain === '도심' ? '#fde047' : '#0003'}
            strokeWidth={c.terrain === '도심' ? 1.2 : 0.5}
            onClick={() => tapCell(i)}
          />
        ))}
        {f.cells.map((c, i) => (c.terrain === '숲' || c.terrain === '산') && !fieldArt(TILE_ART[c.terrain]) ? <TerrainMark key={`m${i}`} x={c.x} y={c.y} t={c.terrain} /> : null)}
        {rangeCells &&
          f.cells.map((_, i) =>
            rangeCells.cells[i] ? <polygon key={`r${i}`} points={polys[i]} fill={rangeCells.color} opacity={0.16} pointerEvents="none" /> : null,
          )}
        {/* 안개 */}
        {f.cells.map((_, i) => (vis.has(i) ? null : <polygon key={`f${i}`} points={polys[i]} fill="#020617" opacity={0.5} pointerEvents="none" />))}
        {/* 상륙 거점 */}
        <Sprite x={f.cells[f.landing].x} y={f.cells[f.landing].y - 2} art={FX_ART.landing} emoji="🚩" size={14} />
        {/* 고른 부대 길 */}
        {selU && selU.path.length > 0 && (
          <polyline
            points={[posOf(selU), ...selU.path.map((p) => f.cells[p])].map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#fde047"
            strokeWidth={1.4}
            strokeDasharray="3 2"
            pointerEvents="none"
          />
        )}
        {/* 부대 말: 땅·바다 먼저, 하늘은 위에 */}
        {[...seen].sort((a, c) => (FUNIT[a.kind].layer === 'air' ? 1 : 0) - (FUNIT[c.kind].layer === 'air' ? 1 : 0)).map((u) => {
          const p = posOf(u);
          const air = FUNIT[u.kind].layer === 'air';
          const big = u.kind === 'carrier' || u.kind === 'cruiser' || u.kind === 'hq';
          const r = air ? 5.5 : big ? 8.5 : 7.5;
          const artKey = u.sp && fieldArt(spArt(u.sp)) ? spArt(u.sp) : UNIT_ART[u.kind];
          const pic = !!fieldArt(artKey);
          const hit = u.hitAt !== undefined ? vt - u.hitAt : 9;
          // 맞으면 잠깐 흔들리고 하얗게 번쩍
          const jig = hit < 0.3 ? Math.sin(hit * 80) * 1.2 * (1 - hit / 0.3) : 0;
          const x = p.x + (air ? 6 : 0) + jig;
          const y = p.y + (air ? -6 : 0);
          return (
            <g key={u.id} transform={`translate(${x},${y})`} pointerEvents="none" className={u.side === 'me' && u.supply < 0.95 ? 'low-supply' : ''}>
              <circle r={r} fill={SIDE_COLOR[u.side]} fillOpacity={pic ? 0.55 : 0.85} stroke={u.id === sel ? '#fde047' : u.side === 'me' ? '#bfdbfe' : '#fecaca'} strokeWidth={u.id === sel ? 1.8 : pic ? 1.1 : 0.7} />
              <Sprite x={0} y={-1} art={artKey} emoji={FUNIT[u.kind].icon} size={pic ? (air ? 14 : big ? 22 : 18) : air ? 10 : big ? 16 : 13} flip={u.face < 0} />
              {u.sp && (
                <text x={-r + 1} y={-r + 3} fontSize={5.5}>
                  🌟
                </text>
              )}
              {hit < 0.25 && <circle r={r} fill="#fff" opacity={0.7 * (1 - hit / 0.25)} />}
              <rect x={-7} y={r - 1} width={14} height={2.2} fill="#0009" />
              <rect x={-7} y={r - 1} width={(14 * Math.max(0, u.hp)) / u.maxHp} height={2.2} fill={u.hp / u.maxHp > 0.5 ? '#22c55e' : u.hp / u.maxHp > 0.25 ? '#f59e0b' : '#ef4444'} />
              {u.side === 'me' && (u.supply < 0.95 || u.ammo <= 0 || (FUNIT[u.kind].layer !== 'land' && u.fuel <= 0)) && (
                <text x={r - 1} y={-r + 3} fontSize={6}>
                  {u.ammo <= 0 ? '🎯' : FUNIT[u.kind].layer !== 'land' && u.fuel <= 0 ? '⛽' : '🔌'}
                </text>
              )}
            </g>
          );
        })}
        {/* 효과: 포탄·미사일·어뢰가 날아가고, 맞은 자리에 폭발·물보라 */}
        <FieldFx b={b} vt={vt} pos={(i, air) => ({ x: f.cells[i].x + (air ? 6 : 0), y: f.cells[i].y + (air ? -6 : 0) })} />
      </svg>
      {mood.hurt > 0 && <div className="field-hurt" style={{ opacity: mood.hurt }} />}
      <div className="field-zoom">
        <button onClick={() => zoomBy(1.5)} aria-label="확대" disabled={view.zoom >= ZMAX}>
          ＋
        </button>
        <button onClick={() => zoomBy(1 / 1.5)} aria-label="축소" disabled={view.zoom <= 1}>
          －
        </button>
        {view.zoom > 1 && (
          <button onClick={() => setView({ zoom: 1, cx: minX + W / 2, cy: minY + H / 2 })} aria-label="전체 보기">
            ⤢
          </button>
        )}
        {selU && (
          <button
            onClick={() => {
              const p = posOf(selU);
              setView((v) => clampView({ zoom: Math.max(2, v.zoom), cx: p.x, cy: p.y }));
            }}
            aria-label="고른 부대로"
          >
            🎯
          </button>
        )}
      </div>
      </div>
      {toast && <div className="field-toast">{toast}</div>}
      <BattleBar
        auto={auto}
        setAuto={setAuto}
        speed={speed}
        setSpeed={setSpeed}
        done={!!b.result}
        onInstant={() => {
          finishField(b);
          redraw();
        }}
        extra={
          <button className={paused ? 'on' : ''} onClick={() => setPaused(!paused)} disabled={!!b.result}>
            {paused ? '▶ 계속' : '⏸ 멈춤'}
          </button>
        }
      />
      {selU ? (
        <div className="field-info">
          <b>
            {FUNIT[selU.kind].icon} {selU.sp ? '🌟' : ''}
            {unitName(selU)}
          </b>
          <small>
            체력 {Math.ceil(selU.hp)}/{selU.maxHp} · 사거리 {defOf(selU).range}칸
            {FUNIT[selU.kind].layer === 'land' ? ` · 보급 ${Math.round(selU.supply * 100)}%` : ''} · 🎯탄약 {Math.round(selU.ammo * 100)}%
            {FUNIT[selU.kind].layer !== 'land' ? ` · ⛽연료 ${Math.round(selU.fuel * 100)}%` : ''}
            {rangeCells ? ` · 노란·초록 칸 = ${rangeCells.label}` : ''}
          </small>
          <small className="muted">{defOf(selU).does}</small>
          <div className="buttons">
            <button
              onClick={() => {
                selU.path = [];
                selU.goal = null;
                redraw();
              }}
            >
              ✋ 멈추기
            </button>
            <button onClick={() => setSel(null)}>선택 풀기</button>
          </div>
        </div>
      ) : (
        <p className="small muted field-tip">{auto ? '🤖 부관이 지휘 중이에요.' : '내 부대(파란 말)를 누르고 갈 칸을 누르세요. 적 옆 칸에 닿으면 알아서 싸워요.'}</p>
      )}
      <div className="field-roster">
        {mine.map((u) => (
          <button key={u.id} className={`${u.id === sel ? 'on' : ''} ${u.sp ? 'sp' : ''}`} title={unitName(u)} onClick={() => setSel(u.id === sel ? null : u.id)}>
            {u.sp ? '🌟' : FUNIT[u.kind].icon}
            <i style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
          </button>
        ))}
      </div>
      <ul className="battle-log small">
        {b.log.slice(0, 3).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <p className="small muted">보병·전차 {troops}개 남음 · 적 사령부를 무너뜨리고 보병·전차가 도심(노란 테두리)에 닿으면 점령</p>
      {b.prompt && promptBoss && (
        <Modal
          title={bossName(promptBoss.kind)}
          icon={FUNIT[promptBoss.kind].icon}
          onClose={() => {
            skipBoss(b);
            redraw();
          }}
          footer={
            <>
              <button
                onClick={() => {
                  skipBoss(b);
                  redraw();
                }}
              >
                🤖 지도에서 계속
              </button>
              <button className="gold" onClick={() => setDuel(promptBoss.kind === 'hq' ? 'hq' : 'cruiser')}>
                🎮 직접 지휘
              </button>
            </>
          }
        >
          <p>
            {promptBoss.kind === 'hq' ? '우리 육군이 적 사령부 바로 앞에 닿았어요.' : '우리 함대가 적 기함과 맞붙었어요.'} 직접 지휘하면{' '}
            {promptBoss.kind === 'hq' ? '옆보기 시가지 돌입' : '격자 함대전'}으로 들어가요.
          </p>
          <p className="small muted">
            이기면 {promptBoss.kind === 'hq' ? '사령부가 바로 무너져요' : '기함이 바로 가라앉아요'}. 지면 앞장선 부대가 크게 다쳐요. 안 하면 지도 위에서 자동으로 계속 싸워요.
          </p>
          <p className="small">결전 난이도 {bossDifficulty(b, promptBoss.kind).toFixed(2)} · 주변 적을 먼저 줄일수록 쉬워요</p>
        </Modal>
      )}
      {help && (
        <Modal title="지도 위 전투" icon="🗺️" onClose={() => setHelp(false)}>
          <p>🟦 내 부대를 누르고 갈 칸을 누르면 실시간으로 움직여요. 적 옆 칸(포병·구축함은 3칸)에 닿으면 알아서 싸워요.</p>
          <p>✈️ 전투기는 항모에서 4칸 안만 날아요. 항모를 움직이면 범위도 따라가요. 항모가 지면 상륙 거점(🚩)으로 기지를 옮겨요.</p>
          <p>🔌 육군은 상륙 거점 5칸·항모 3칸 안에서 보급을 받아요. 벗어나면 점점 약해져요.</p>
          <p>🎯 쏠 때마다 탄약, ✈️🚢 비행기·배는 움직일 때마다 연료를 써요. 보급 범위(비행기는 기지 옆)에 있으면 다시 차요. 탄약이 떨어지면 공격 ×0.35, 연료가 떨어지면 2.5배 느려요. 대전투는 출발할 때 창고의 🛢️석유 6·🟠구리 4를 쓰고, 모자라면 그만큼 덜 채우고 출발해요.</p>
          <p>🌟 특화 유닛: 우리 연방 특화 유닛을 만들어 두면 종류마다 2부대까지 바꿔 나가요. 적 연방도 자기 특화 유닛을 내보내요. 말을 누르면 능력이 보여요.</p>
          <p>🌫️ 내 부대 주변만 보여요. 🛸 드론은 4칸까지 봐요. 🫧 잠수함은 가까이 가거나 구축함이 있어야 보여요.</p>
          <p>🔍 ＋/－ 버튼, 두 손가락 벌리기, 마우스 휠로 확대해요. 확대하면 끌어서 옮기고, 🎯는 고른 부대로 가요.</p>
          <p>⛰️ 산·숲·시가지는 방어에 좋고 느려요. 해협은 배가 느려요.</p>
          <p>🏯 적 사령부·⚓ 적 기함에 닿으면 "직접 지휘"로 큰 싸움을 직접 할 수 있어요.</p>
          <p className="small muted">스탯: 통솔 = 공격 · 전술 = 방어 · 포격 = 포병·함포 · 정보 = 시야 · 군수 = 보급 끊김 덜 함</p>
        </Modal>
      )}
    </div>
  );
}

/** 그림이 있으면 그림, 없으면 이모지 */
function Sprite({ x, y, art, emoji, size, flip, opacity }: { x: number; y: number; art: string; emoji: string; size: number; flip?: boolean; opacity?: number }) {
  const url = fieldArt(art);
  if (url)
    return (
      <image
        href={url}
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        opacity={opacity}
        pointerEvents="none"
        transform={flip ? `translate(${2 * x},0) scale(-1,1)` : undefined}
      />
    );
  return (
    <text x={x} y={y + size * 0.36} fontSize={size * 0.8} textAnchor="middle" opacity={opacity} pointerEvents="none">
      {emoji}
    </text>
  );
}

function TerrainMark({ x, y, t }: { x: number; y: number; t: FTerrain }) {
  return t === '산' ? (
    <path d={`M${x - 6},${y + 4} L${x - 1},${y - 5} L${x + 2},${y} L${x + 4},${y - 3} L${x + 7},${y + 4} Z`} fill="#6b6359" stroke="#4b453e" strokeWidth={0.5} pointerEvents="none" />
  ) : (
    <g pointerEvents="none" fill="#3c6b35">
      <circle cx={x - 3} cy={y + 1} r={3} />
      <circle cx={x + 3} cy={y + 2} r={2.6} />
      <circle cx={x} cy={y - 3} r={2.8} />
    </g>
  );
}
