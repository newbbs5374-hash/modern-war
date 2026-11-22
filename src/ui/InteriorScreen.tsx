// 내정 화면: 금고(나라 살림 한눈에) · 자원(설명·사용처·획득처) · 시설(분야별 3개 + 내정 업무)
import { useState, type ReactNode } from 'react';
import { CITIES } from '../data/cities';
import {
  BUFF_EFF,
  BUFF_HOURS,
  BUILDINGS,
  CHORES,
  CHORE_EXP,
  CHORE_HOURS,
  CITY_RES,
  FACILITIES,
  FACILITY_EFF,
  FACILITY_TEXT,
  OCCUPIED_RES,
  RESOURCES,
  RES_BUILDING,
  RES_DESC,
  RES_ICON,
  RES_PRICE,
  UNIT_COST,
  buildingInfo,
  type BuildingId,
  type Facility,
  type Res,
} from '../data/economy';
import { RANKS } from '../data/ranks';
import { COUNTRIES, countryById } from '../data/world';
import {
  buffActive,
  buildingEff,
  canChore,
  canUpgrade,
  claimChore,
  contractMoneyPerHour,
  contractResPerHour,
  maxLevel,
  producesOf,
  resMult,
  resPerDay,
  startChore,
  tradePrice,
  upgradeCost,
  upgradeFacility,
} from '../game/economy';
import { budgetBreakdown, budgetPerDay, pendingCap, salaryPerDay, troopLossPerDay, troopsBreakdown, troopsPerDay } from '../game/state';
import { citiesOf, isAlive, relationOf } from '../game/world';
import { BoostBar } from './BoostBar';
import { CountryInfo, RelTag, fmt, leaderText } from './common';
import { FLAG } from './flag';
import { FACILITY_ICON, UNIT_ICON } from './icons';
import { Fold, Meter, Modal, Tabs, useTab } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';

const r1 = (v: number) => Math.round(v * 10) / 10;
const sign = (v: number) => (v >= 0 ? `+${fmt(v)}` : `−${fmt(-v)}`);

/** 누르면 말풍선이 뜨는 글자(어디서 어떻게 계산되는지) */
export function Tip({ label, title, rows, total }: { label: ReactNode; title: string; rows: Array<[string, string]>; total?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="tip">
      <button className="tip-btn" onClick={(e) => (e.stopPropagation(), setOpen((v) => !v))}>
        {label} <i>ⓘ</i>
      </button>
      {open && (
        <span className="tip-bubble" role="tooltip" onClick={() => setOpen(false)}>
          <b>{title}</b>
          {rows.map(([k, v]) => (
            <span key={k} className="tip-row">
              <span>{k}</span>
              <strong>{v}</strong>
            </span>
          ))}
          {total && (
            <span className="tip-row tip-total">
              <span>합계</span>
              <strong>{total}</strong>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

type Tab = 'home' | 'res' | 'fac';
export function InteriorScreen(props: ScreenProps) {
  const { state } = props;
  const [tab, setTab] = useTab<Tab>('nation', 'home');
  const choreDone = state.economy.chore && state.worldMs >= state.economy.chore.endMs;
  return (
    <>
      <Tabs
        value={tab === ('make' as Tab) || tab === ('trade' as Tab) || tab === ('dip' as Tab) ? 'home' : tab}
        onChange={setTab}
        tabs={[
          { id: 'home', label: '금고', icon: '💰' },
          { id: 'res', label: '자원', icon: '⛏️' },
          { id: 'fac', label: '시설', icon: '🏭', badge: choreDone ? '!' : null },
        ]}
      />
      {(tab === 'home' || !['res', 'fac'].includes(tab)) && <TreasuryPanel {...props} />}
      {tab === 'res' && <ResourcePanel {...props} />}
      {tab === 'fac' && <FacilityPanel {...props} />}
    </>
  );
}

/* ───────── 금고 ───────── */
function TreasuryPanel({ state, actions }: ScreenProps) {
  const me = countryById(state.player.countryId);
  const n = state.nations[me.id];
  const w = state.world;
  const e = state.economy;
  const mine = citiesOf(w, me.id);
  const home = CITIES.filter((c) => c.home === me.id);
  const occupied = mine.filter((id) => CITIES.find((c) => c.id === id)!.home !== me.id).length;
  const others = COUNTRIES.filter((c) => c.id !== me.id && isAlive(w, c.id));
  const relCount = (r: string) => others.filter((c) => relationOf(w, me.id, c.id) === r).length;
  const stockValue = RESOURCES.reduce((a, r) => a + e.stock[r] * RES_PRICE[r], 0);
  const units = Object.values(e.army).reduce((a, v) => a + v, 0);
  const contracts = e.contracts ?? [];
  const cm = contractMoneyPerHour(state);
  const buffs = BUILDINGS.filter((b) => buffActive(state, b.id)).length;
  const avgLv = BUILDINGS.reduce((a, b) => a + (e.buildings[b.id]?.level ?? 1), 0) / BUILDINGS.length;
  const bRows = budgetBreakdown(state);
  const tRows = troopsBreakdown(state);
  const budget = budgetPerDay(state, me.id);
  const troops = troopsPerDay(state, me.id);
  const troopLoss = troopLossPerDay(state);
  return (
    <>
      <section className="card">
        <div className="hero">
          <span className="avatar">{FLAG[me.id]}</span>
          <div className="hero-main">
            <b>{me.name}</b>
            <div className="small muted">{leaderText(state, me.id)}</div>
          </div>
        </div>
      </section>
      <div className="vault">
        <div className="vbox big">
          <small>💰 국방예산</small>
          <b>{fmt(n.treasury)}</b>
          <Tip label={`+${fmt(budget + cm)}/시간`} title="국방예산 시간당" rows={bRows} total={`+${fmt(budget + cm)}`} />
        </div>
        <div className="vbox big">
          <small>🪖 병력</small>
          <b>{fmt(n.troops)}명</b>
          <Tip label={`${sign(troops - troopLoss)}/시간`} title="병력 시간당" rows={tRows} total={sign(troops - troopLoss)} />
        </div>
        <div className="vbox">
          <small>💵 봉급</small>
          <b>{fmt(state.player.salary)}</b>
          <Tip
            label={`+${fmt(salaryPerDay(state))}/시간`}
            title="봉급"
            rows={[
              ['지도자 등급', RANKS[state.player.rankIndex].name],
              ['쌓인 봉급(본부에서 받기)', fmt(state.player.pendingSalary)],
              ['쌓이는 한도', fmt(pendingCap(state))],
            ]}
          />
        </div>
        <div className="vbox">
          <small>🏙️ 도시</small>
          <b>{mine.length}</b>
          <small className="muted">
            본토 {mine.length - occupied}/{home.length} · 점령 {occupied}
          </small>
        </div>
        <div className="vbox">
          <small>💪 전투력</small>
          <b>{fmt(e.power)}</b>
          <small className="muted">부대 {units} · 모집 중 {e.queue.length}</small>
        </div>
        <div className="vbox">
          <small>🌐 외교</small>
          <b>
            🤝{relCount('연합')} ⚔️{relCount('전쟁')}
          </b>
          <small className="muted">
            휴전 {relCount('휴전')} · 중립 {relCount('중립')}
          </small>
        </div>
        <div className="vbox">
          <small>📦 자원 값어치</small>
          <b>{fmt(stockValue)}</b>
          <small className="muted">7종 보유량 × 기본값</small>
        </div>
        <div className="vbox">
          <small>🔁 무역 계약</small>
          <b>{contracts.length}개</b>
          <small className={cm >= 0 ? 'ok' : 'warn'}>
            {cm >= 0 ? '+' : ''}
            {fmt(cm)}/시간
          </small>
        </div>
        <div className="vbox">
          <small>🏭 시설</small>
          <b>평균 {r1(avgLv)}단계</b>
          <small className="muted">특별 가동 {buffs}곳</small>
        </div>
        <div className="vbox">
          <small>🕵️ 정보 · 🤝 신뢰</small>
          <b>
            {fmt(state.officer.intel)} · {Math.round(state.officer.trust)}
          </b>
          <small className="muted">명성 {fmt(state.officer.fame)}</small>
        </div>
      </div>
      <Fold title="📖 우리 나라 더 보기 (특수 능력·신앙·도시)">
        <CountryInfo id={me.id} state={state} />
      </Fold>
      {state.economy.log.length > 0 && (
        <Fold title="🗒️ 최근 내정 소식">
          <ul className="small muted log">
            {state.economy.log.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Fold>
      )}
      <button className="wide" style={{ marginTop: 6 }} onClick={actions.claim} disabled={state.player.pendingSalary < 1}>
        💵 쌓인 봉급 받기 (+{fmt(state.player.pendingSalary)})
      </button>
    </>
  );
}

/* ───────── 자원 ───────── */
function ResourcePanel(props: ScreenProps) {
  const { state } = props;
  const e = state.economy;
  const per = resPerDay(state);
  const [pick, setPick] = useState<Res | null>(null);
  return (
    <>
      <p className="small muted center">자원을 누르면 설명 · 쓰는 곳 · 얻는 곳이 나와요.</p>
      <div className="res-grid">
        {RESOURCES.map((r) => {
          const net = per[r] + contractResPerHour(state, r);
          return (
            <button key={r} className="res-card" onClick={() => setPick(r)}>
              <span className="res-ico">{RES_ICON[r]}</span>
              <b>{r}</b>
              <strong>{fmt(e.stock[r])}</strong>
              <small className={net > 0 ? 'ok' : net < 0 ? 'warn' : 'muted'}>{net ? `${net > 0 ? '+' : ''}${r1(net)}/시간` : '안 남'}</small>
            </button>
          );
        })}
      </div>
      {pick && <ResourceModal {...props} res={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function ResourceModal({ state, go, res, onClose }: ScreenProps & { res: Res; onClose: () => void }) {
  const me = state.player.countryId;
  const w = state.world;
  const mult = resMult(state, res);
  const myCities = CITIES.filter((c) => w.owner[c.id] === me && CITY_RES[c.name]?.[res]);
  const uses = Object.entries(UNIT_COST).filter(([, c]) => c.res[res]);
  const sellers = COUNTRIES.filter((c) => c.id !== me && isAlive(w, c.id) && producesOf(state, c.id).includes(res));
  const perCountry = (id: string) =>
    CITIES.filter((c) => w.owner[c.id] === id).reduce((a, c) => a + (CITY_RES[c.name]?.[res] ?? 0) * (c.home === id ? 1 : OCCUPIED_RES), 0);
  const contracts = (state.economy.contracts ?? []).filter((c) => c.res === res);
  return (
    <Modal title={res} icon={RES_ICON[res]} onClose={onClose}>
      <p>{RES_DESC[res]}</p>
      <div className="kv2">
        <span>보유</span>
        <b>{fmt(state.economy.stock[res])}개</b>
        <span>기본 값</span>
        <b>💰{RES_PRICE[res]}</b>
      </div>
      <h4 className="mini-h">🛠️ 쓰는 곳</h4>
      <div className="chips-wrap">
        {uses.map(([u, c]) => (
          <span key={u} className="mini-chip">
            {UNIT_ICON[u]} {u} ×{c.res[res]}
          </span>
        ))}
      </div>
      <h4 className="mini-h">⛏️ 우리 땅에서 나는 곳</h4>
      {myCities.length ? (
        <div className="chips-wrap">
          {myCities.map((c) => (
            <span key={c.id} className="mini-chip">
              🏙️ {c.name}
              {c.home !== me ? '(점령)' : ''} +{r1((CITY_RES[c.name]![res] ?? 0) * (c.home === me ? 1 : OCCUPIED_RES) * mult)}/시간
            </span>
          ))}
        </div>
      ) : (
        <p className="small muted">우리 도시에서는 안 나요. 수입하거나 나는 도시를 점령하세요.</p>
      )}
      <p className="small muted">
        {buildingInfo(RES_BUILDING[res]).icon} {RES_BUILDING[res]} 효과 ×{(Math.round(mult * 100) / 100).toFixed(2)}
      </p>
      <h4 className="mini-h">🚢 수입할 수 있는 나라</h4>
      {sellers.length ? (
        sellers.map((c) => {
          const war = relationOf(w, me, c.id) === '전쟁';
          const ct = contracts.filter((x) => x.country === c.id);
          return (
            <div key={c.id} className="line-item">
              <span className="li-ico">{FLAG[c.id]}</span>
              <span className="li-main">
                <b>
                  {c.name} <RelTag state={state} id={c.id} />
                </b>
                <small>
                  그 나라 생산 {r1(perCountry(c.id))}/시간 · 1개 💰{tradePrice(state, c.id, res)}
                  {war ? ' · 전쟁 중이라 거래 불가' : ''}
                  {ct.length ? ` · 계약 ${ct.map((x) => `${x.buy ? '수입' : '수출'} ${x.qty}/시간`).join(', ')}` : ''}
                </small>
              </span>
            </div>
          );
        })
      ) : (
        <p className="small muted">지금 이 자원을 만드는 다른 나라가 없어요.</p>
      )}
      <button className="wide" style={{ marginTop: 6 }} onClick={() => (onClose(), go('diplo'))}>
        🤝 외교 → 무역에서 사고팔기
      </button>
    </Modal>
  );
}

/* ───────── 시설 ───────── */
function FacilityPanel(props: ScreenProps) {
  const { state, actions } = props;
  const e = state.economy;
  const chore = e.chore;
  const [pick, setPick] = useState<BuildingId | null>(null);
  return (
    <>
      <div className={`chore-line ${chore && state.worldMs >= chore.endMs ? 'done' : ''}`}>
        <span className="li-ico">📋</span>
        <span className="li-main">
          <b>{chore ? `${chore.building ?? chore.fac}: ${chore.title}` : '내정 업무 없음'}</b>
          <small>
            {chore
              ? state.worldMs >= chore.endMs
                ? '끝났어요! 보상을 받아요'
                : `${timeLeft(chore.endMs - state.worldMs)} 남음`
              : `시설을 눌러 업무를 맡겨요(${CHORE_HOURS}시간 · 경험 +${CHORE_EXP} · 특별 가동 ${BUFF_HOURS}시간)`}
          </small>
        </span>
        {chore && state.worldMs >= chore.endMs && (
          <button className="gold" onClick={() => actions.apply(claimChore)}>
            받기
          </button>
        )}
      </div>
      {chore && <BoostBar state={state} apply={actions.apply} target={{ kind: 'chore' }} compact />}
      {FACILITIES.map((f) => (
        <FacilityGroup key={f} {...props} fac={f} onPick={setPick} />
      ))}
      {pick && <BuildingModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function FacilityGroup({ state, fac, onPick }: ScreenProps & { fac: Facility; onPick: (id: BuildingId) => void }) {
  const e = state.economy;
  const list = BUILDINGS.filter((b) => b.fac === fac);
  const lowest = Math.min(...list.map((b) => upgradeCost(state, b.id).exp));
  return (
    <div className="fac-group">
      <div className="fac-head">
        <span>
          {FACILITY_ICON[fac]} <b>{fac}</b> <small className="muted">{FACILITY_TEXT[fac]}</small>
        </span>
        <small className="muted">경험 {fmt(e.facilities[fac].exp)}</small>
      </div>
      <div className="tiles c3">
        {list.map((b) => {
          const st = e.buildings[b.id];
          const building = st.buildEndMs > state.worldMs;
          const buff = buffActive(state, b.id);
          const ready = !canUpgrade(state, b.id);
          return (
            <button key={b.id} className={`bcard ${buff ? 'buff' : ''} ${ready ? 'ready' : ''}`} onClick={() => onPick(b.id)}>
              {buff && <i className="badge">⚡</i>}
              <span className="bcard-ico">{b.icon}</span>
              <b>{b.id}</b>
              <small>
                Lv.{st.level} · +{Math.round(buildingEff(state, b.id) * 100)}%
              </small>
              {building ? (
                <small className="ok">🏗️ {timeLeft(st.buildEndMs - state.worldMs)}</small>
              ) : st.level < 5 ? (
                <Meter value={e.facilities[fac].exp} max={upgradeCost(state, b.id).exp || lowest} tone={ready ? 'green' : undefined} />
              ) : (
                <small className="muted">최고</small>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BuildingModal({ state, actions, id, onClose }: ScreenProps & { id: BuildingId; onClose: () => void }) {
  const info = buildingInfo(id);
  const st = state.economy.buildings[id];
  const why = canUpgrade(state, id);
  const choreWhy = canChore(state);
  const c = upgradeCost(state, id);
  const [msg, setMsg] = useState('');
  return (
    <Modal
      title={id}
      icon={info.icon}
      onClose={onClose}
      footer={
        <>
          <button
            disabled={!!choreWhy}
            onClick={() => {
              actions.apply((s) => startChore(s, id));
              setMsg(`업무 시작: ${CHORES[id]} (${CHORE_HOURS}시간)`);
            }}
          >
            📋 {choreWhy ?? '업무 맡기기'}
          </button>
          <button
            className="gold"
            disabled={!!why}
            onClick={() => {
              actions.apply((s) => upgradeFacility(s, id));
              setMsg('공사를 시작했어요.');
            }}
          >
            {why ?? '⬆️ 올리기'}
          </button>
        </>
      }
    >
      <p>
        <span className="tag">{info.fac}</span> {info.does}
      </p>
      <div className="kv2">
        <span>지금</span>
        <b>
          {st.level}단계 · +{Math.round(FACILITY_EFF[st.level - 1] * 100)}%
        </b>
        <span>특별 가동</span>
        <b>{buffActive(state, id) ? `⚡ +${BUFF_EFF * 100}% · ${timeLeft(st.buffEndMs - state.worldMs)}` : '없음'}</b>
        {st.level < 5 && (
          <>
            <span>다음 단계</span>
            <b>+{Math.round(FACILITY_EFF[st.level] * 100)}%</b>
            <span>{info.fac} 경험</span>
            <b>
              {fmt(state.economy.facilities[info.fac].exp)} / {c.exp}
            </b>
            <span>예산 · 공사</span>
            <b>
              💰{fmt(c.money)} · {c.hours}시간
            </b>
            <span>올릴 수 있는 최고</span>
            <b>{maxLevel(state.player.rankIndex)}단계</b>
          </>
        )}
      </div>
      {st.buildEndMs > state.worldMs && <BoostBar state={state} apply={actions.apply} target={{ kind: 'build', fac: id }} />}
      <p className="small muted" style={{ marginTop: 6 }}>
        📋 업무 "{CHORES[id]}": {CHORE_HOURS}시간 뒤 {info.fac} 경험 +{CHORE_EXP}, 그리고 {BUFF_HOURS}시간 동안 이 시설 효과 +{BUFF_EFF * 100}%.
      </p>
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}
