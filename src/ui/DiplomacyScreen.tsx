// 외교 화면: 무역(한 번 사고팔기 · 정기 수입/수출 계약) · 국가정보(나라 카드) · 외교관계(관계도 + 목록)
import { useState } from 'react';
import { LEADERS } from '../data/leaders';
import { RESOURCES, RES_ICON, SELL_RATE, type Res } from '../data/economy';
import { BLOCS, COUNTRIES, countryById, type Relation } from '../data/world';
import { COMMAND_TOP, DIPLO_COOLDOWN_HOURS, canDiplo, diploChance, diploReady, doDiplo, type DiploAct } from '../game/command';
import {
  CONTRACT_MAX,
  CONTRACT_QTY,
  addContract,
  canContract,
  canTrade,
  cancelContract,
  contractMoney,
  contractPaused,
  producesOf,
  trade,
  tradePartners,
  tradePrice,
} from '../game/economy';
import { citiesOf, isAlive, pairKey, relationOf } from '../game/world';
import { CountryInfo, RelTag, TensionBar, fmt } from './common';
import { FLAG, Flag } from './flag';
import { Chip, Help, Modal, Tabs, useTab } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { civOf } from '../game/civ';
import { AgreePanel, CouncilPanel, FavorBox, IslandPanel } from './CivScreens';
import { REL_COLORS } from './WorldMap';

type Tab = 'trade' | 'nations' | 'rel' | 'agree' | 'isle' | 'council';
export function DiplomacyScreen(props: ScreenProps) {
  const [tab, setTab] = useTab<Tab>('diplo', 'trade');
  const [sel, setSel] = useState<string | null>(null);
  const civ = civOf(props.state);
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'trade', label: '무역', icon: '🚢' },
          { id: 'nations', label: '국가정보', icon: '🗂️' },
          { id: 'rel', label: '외교관계', icon: '🕸️' },
          { id: 'agree', label: '호감·협정', icon: '🤝' },
          { id: 'isle', label: '개척 섬', icon: '🏝️' },
          { id: 'council', label: '군도 회의', icon: '🏛️', badge: civ.council.open && civ.council.open.vote === null ? '!' : null },
        ]}
      />
      {tab === 'agree' && <AgreePanel {...props} />}
      {tab === 'isle' && <IslandPanel {...props} />}
      {tab === 'council' && <CouncilPanel {...props} />}
      {tab === 'trade' && <TradePanel {...props} />}
      {tab === 'nations' && <NationsPanel {...props} onPick={setSel} />}
      {tab === 'rel' && <RelationsPanel {...props} onPick={setSel} />}
      {sel && <CountryModal {...props} id={sel} onClose={() => setSel(null)} />}
    </>
  );
}

/* ───────── 무역 ───────── */
function TradePanel({ state, actions }: ScreenProps) {
  const partners = tradePartners(state);
  const [who, setWho] = useState(partners[0] ?? '');
  const [pick, setPick] = useState<Res | null>(null);
  const [qty, setQty] = useState(5);
  const [cq, setCq] = useState(1);
  const [msg, setMsg] = useState('');
  const me = state.player.countryId;
  const contracts = state.economy.contracts ?? [];
  const cur = partners.includes(who) ? who : partners[0];
  const has = cur ? producesOf(state, cur) : [];
  const go = (r: Res, buy: boolean) => {
    const why = canTrade(state, cur, r, qty, buy);
    if (why) return setMsg(why);
    setMsg(`${buy ? '샀어요' : '팔았어요'}: ${r} ${qty}개`);
    actions.apply((s) => trade(s, cur, r, qty, buy));
  };
  const contract = (r: Res, buy: boolean) => {
    const why = canContract(state, cur, r, cq, buy);
    if (why) return setMsg(why);
    setMsg(`정기 ${buy ? '수입' : '수출'} 계약: ${r} 시간당 ${cq}개`);
    actions.apply((s) => addContract(s, cur, r, cq, buy));
  };
  return (
    <>
      <section className="card">
        <div className="row">
          <div className="ichips">
            <Chip icon="💰" value={fmt(state.nations[me].treasury)} label="국방예산" />
            <Chip icon="🔁" value={`${contracts.length}/${CONTRACT_MAX}`} label="계약" />
          </div>
          <Help title="무역">
            <p>전쟁 중이 아닌 나라와 자원을 사고팔아요. 값은 상대 지도자 성향에 따라 달라요(경제형 싸게, 공격형 비싸게, 연합은 10% 할인). 그 나라 도시에서 나는 자원만 살 수 있고, 팔 때는 값의 {Math.round(SELL_RATE * 100)}%를 받아요.</p>
            <p>
              <b>정기 계약</b>은 매시간 자동으로 수입·수출해요. 전쟁이 나면 멈추고, 돈이나 팔 자원이 모자라면 있는 만큼만 해요. 최대 {CONTRACT_MAX}개.
            </p>
          </Help>
        </div>
        {contracts.length > 0 && (
          <div className="contracts">
            {contracts.map((c) => {
              const paused = contractPaused(state, c);
              const m = contractMoney(state, c);
              return (
                <div key={c.id} className={`contract ${paused ? 'paused' : ''}`}>
                  <span>
                    {FLAG[c.country]} {c.buy ? '📥 수입' : '📤 수출'} {RES_ICON[c.res]}
                    {c.res} {c.qty}/시간
                  </span>
                  <small className={paused ? 'warn' : m >= 0 ? 'ok' : 'muted'}>{paused ?? `${m >= 0 ? '+' : ''}${fmt(m)}💰/시간`}</small>
                  <button className="x-btn" onClick={() => actions.apply((s) => cancelContract(s, c.id))} aria-label="계약 끝내기">
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {!cur ? (
        <p className="empty">거래할 나라가 없어요(모두 전쟁 중).</p>
      ) : (
        <>
          <div className="pillrow">
            {partners.map((id) => (
              <button key={id} className={`flagbtn ${id === cur ? 'on' : ''}`} onClick={() => (setMsg(''), setWho(id))}>
                {FLAG[id]}
              </button>
            ))}
          </div>
          <p className="small muted">
            {countryById(cur).name} · {state.world.personalities[cur]} · <RelTag state={state} id={cur} />
          </p>
          <div className="res-grid">
            {RESOURCES.map((r) => (
              <button key={r} className={`res-card ${has.includes(r) ? 'can' : ''}`} onClick={() => (setMsg(''), setPick(r))}>
                <span className="res-ico">{RES_ICON[r]}</span>
                <b>{r}</b>
                <strong>💰{tradePrice(state, cur, r)}</strong>
                <small className="muted">{has.includes(r) ? `보유 ${fmt(state.economy.stock[r])}` : '수출만'}</small>
              </button>
            ))}
          </div>
          {msg && <p className="small result">{msg}</p>}
        </>
      )}
      {pick && cur && (
        <Modal title={`${pick} 무역`} icon={RES_ICON[pick]} onClose={() => setPick(null)}>
          <p className="small">
            {FLAG[cur]} {countryById(cur).name} · 1개 💰{tradePrice(state, cur, pick)} · 보유 {fmt(state.economy.stock[pick])}
          </p>
          <h4 className="mini-h">한 번 사고팔기</h4>
          <span className="seg">
            {[1, 5, 20, 50].map((n) => (
              <button key={n} className={qty === n ? 'on' : ''} onClick={() => setQty(n)}>
                {n}개
              </button>
            ))}
          </span>
          <div className="buttons" style={{ marginTop: 6 }}>
            <button className="primary" style={{ flex: 1 }} disabled={!has.includes(pick)} onClick={() => go(pick, true)}>
              📥 사기 −💰{fmt(tradePrice(state, cur, pick) * qty)}
            </button>
            <button style={{ flex: 1 }} onClick={() => go(pick, false)}>
              📤 팔기 +💰{fmt(Math.round(tradePrice(state, cur, pick) * SELL_RATE * qty))}
            </button>
          </div>
          <h4 className="mini-h">정기 계약 (매시간)</h4>
          <span className="seg">
            {CONTRACT_QTY.map((n) => (
              <button key={n} className={cq === n ? 'on' : ''} onClick={() => setCq(n)}>
                {n}/시간
              </button>
            ))}
          </span>
          <div className="buttons" style={{ marginTop: 6 }}>
            <button className="primary" style={{ flex: 1 }} disabled={!!canContract(state, cur, pick, cq, true)} onClick={() => contract(pick, true)}>
              📥 수입 계약 −💰{fmt(tradePrice(state, cur, pick) * cq)}/시간
            </button>
            <button style={{ flex: 1 }} disabled={!!canContract(state, cur, pick, cq, false)} onClick={() => contract(pick, false)}>
              📤 수출 계약 +💰{fmt(Math.round(tradePrice(state, cur, pick) * SELL_RATE * cq))}/시간
            </button>
          </div>
          {msg && <p className="small result">{msg}</p>}
        </Modal>
      )}
    </>
  );
}

/* ───────── 국가정보: 나라 카드 ───────── */
function NationsPanel({ state, onPick }: ScreenProps & { onPick: (id: string) => void }) {
  const me = state.player.countryId;
  return (
    <div className="ncards">
      {COUNTRIES.map((c) => {
        const alive = isAlive(state.world, c.id);
        const rel = c.id === me ? '나' : relationOf(state.world, me, c.id);
        return (
          <button key={c.id} className={`ncard ${alive ? '' : 'dead'}`} style={{ borderColor: REL_COLORS[rel as Relation | '나'] }} onClick={() => onPick(c.id)}>
            <span className="ncard-top">
              <span className="ncard-flag">{FLAG[c.id]}</span>
              <span className="ncard-name">
                <b>{c.name}</b>
                <small>
                  {LEADERS[c.id].title} {LEADERS[c.id].name}
                </small>
              </span>
            </span>
            <span className="ncard-tags">
              <RelTag state={state} id={c.id} />
              <span className="tag">{state.world.personalities[c.id]}</span>
            </span>
            <span className="ncard-stats">
              <small>🏙️{citiesOf(state.world, c.id).length}</small>
              <small>🪖{fmt(state.nations[c.id].troops / 1000)}k</small>
              <small>💰{fmt(state.nations[c.id].treasury / 1000)}k</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────── 외교관계: 관계도 + 관계별 목록 ───────── */
const REL_ORDER: Relation[] = ['연합', '중립', '휴전', '전쟁'];
const REL_ICON: Record<Relation, string> = { 연합: '🤝', 중립: '🏳️', 휴전: '🕊️', 전쟁: '⚔️' };
function RelationsPanel({ state, onPick }: ScreenProps & { onPick: (id: string) => void }) {
  const me = state.player.countryId;
  const w = state.world;
  const others = COUNTRIES.filter((c) => c.id !== me);
  const R = 118;
  const cx = 160;
  const cy = 140;
  const pos = others.map((c, i) => {
    const a = -Math.PI / 2 + (i / others.length) * Math.PI * 2;
    return { c, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  });
  const top = state.player.rankIndex >= COMMAND_TOP;
  const wait = diploReady(state) - state.worldMs;
  return (
    <>
      <div className="rel-sum">
        {REL_ORDER.map((r) => (
          <span key={r} className="rel-chip" style={{ borderColor: REL_COLORS[r] }}>
            {REL_ICON[r]} {r} <b>{others.filter((c) => isAlive(w, c.id) && relationOf(w, me, c.id) === r).length}</b>
          </span>
        ))}
        <Help title="외교관계">
          <p>가운데가 우리 나라예요. 선 색이 관계예요: 파랑 연합 · 회색 중립 · 주황 휴전 · 빨강 전쟁. 중립·휴전 선이 굵을수록 긴장도가 높아요(100이 되면 휴전이 깨지거나 전쟁).</p>
          <p>나라를 누르면 자세한 정보가 나오고, 최고 등급 지도자가 되면 선전포고·휴전 제안·연합 제안을 해요({DIPLO_COOLDOWN_HOURS}시간마다 한 번).</p>
        </Help>
      </div>
      <svg className="rel-web" viewBox="0 0 320 296" role="img" aria-label="외교 관계도">
        {pos.map(({ c, x, y }) => {
          if (!isAlive(w, c.id)) return null;
          const p = w.pairs[pairKey(me, c.id)];
          const rel = p?.rel ?? '중립';
          const t = rel === '전쟁' || rel === '연합' ? 3 : 1 + (p?.tension ?? 0) / 25;
          return <line key={c.id} x1={cx} y1={cy} x2={x} y2={y} stroke={REL_COLORS[rel]} strokeWidth={t} strokeDasharray={rel === '휴전' ? '5 4' : undefined} opacity={0.85} />;
        })}
        <circle cx={cx} cy={cy} r={26} fill="#1e293b" stroke={REL_COLORS['나']} strokeWidth={3} />
        <g transform={`translate(${cx - 15},${cy - 10})`}>
          <Flag id={me} />
        </g>
        {pos.map(({ c, x, y }) => {
          const alive = isAlive(w, c.id);
          const rel = relationOf(w, me, c.id);
          return (
            <g key={c.id} onClick={() => onPick(c.id)} style={{ cursor: 'pointer' }} opacity={alive ? 1 : 0.35}>
              <circle cx={x} cy={y} r={19} fill="#0f172a" stroke={REL_COLORS[rel]} strokeWidth={2.5} />
              <g transform={`translate(${x - 12},${y - 8})`}>
                <Flag id={c.id} size={0.8} />
              </g>
              <text x={x} y={y + 31} textAnchor="middle" fontSize="9.5" fill="#cbd5e1">
                {c.name.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
      {top && <p className="small muted center">📜 외교 행동: {wait > 0 ? `${timeLeft(wait)} 뒤 가능` : '지금 가능'}</p>}
      {REL_ORDER.map((r) => {
        const list = others.filter((c) => isAlive(w, c.id) && relationOf(w, me, c.id) === r);
        if (!list.length) return null;
        return (
          <div key={r} className="rel-group">
            <small className="stat-group-name" style={{ color: REL_COLORS[r] }}>
              {REL_ICON[r]} {r} {list.length}
            </small>
            {list.map((c) => {
              const p = w.pairs[pairKey(me, c.id)];
              return (
                <button key={c.id} className="line-item wide-btn" onClick={() => onPick(c.id)}>
                  <span className="li-ico">{FLAG[c.id]}</span>
                  <span className="li-main">
                    <b>{c.name}</b>
                    <small>
                      {state.world.personalities[c.id]} · {BLOCS[c.bloc].name}
                      {r === '전쟁' && p ? ` · 피로도 ${Math.round(p.weariness)}` : ''}
                      {(r === '중립' || r === '휴전') && p ? ` · 긴장 ${Math.round(p.tension)}` : ''}
                    </small>
                  </span>
                  <TensionBar state={state} a={me} b={c.id} />
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/* ───────── 나라 팝업: 정보 + 외교 행동 ───────── */
function CountryModal({ state, actions, id, onClose }: ScreenProps & { id: string; onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const me = state.player.countryId;
  const top = state.player.rankIndex >= COMMAND_TOP;
  return (
    <Modal title={countryById(id).name} icon={FLAG[id]} onClose={onClose}>
      {top && id !== me && (
        <div className="buttons">
          {(['선전포고', '휴전 제안', '연합 제안'] as DiploAct[]).map((act) => {
            const why = canDiplo(state, id, act);
            return (
              <button
                key={act}
                style={{ flex: 1, marginTop: 0 }}
                className={act === '선전포고' ? 'danger' : 'primary'}
                disabled={!!why}
                title={why ?? ''}
                onClick={() => {
                  if (act === '선전포고' && !window.confirm(`${countryById(id).name}에 선전포고할까요?`)) return;
                  setMsg(
                    actions.applyWith((s) => {
                      const r = doDiplo(s, id, act);
                      return { state: r.state, out: r.text };
                    }) ?? '',
                  );
                }}
              >
                {act === '선전포고' ? '⚔️' : act === '휴전 제안' ? '🕊️' : '🤝'} {act}
                <small>{why ?? (act === '선전포고' ? '' : `성공 ${Math.round(diploChance(state, id, act) * 100)}%`)}</small>
              </button>
            );
          })}
        </div>
      )}
      {msg && <p className="small result">{msg}</p>}
      <FavorBox state={state} id={id} />
      <CountryInfo id={id} state={state} />
    </Modal>
  );
}
