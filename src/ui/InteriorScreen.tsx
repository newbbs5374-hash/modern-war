// 내정 화면: 금고(나라 살림 한눈에) · 자원(설명·사용처·획득처) · 시설(분야 5개 × 3개 + 내정 업무, 단계마다 그림)
import { payPreview } from '../game/payday';
import { routeTo } from './nav';
import { ResIcon, facilityArtExact, facilityArtUrl, vaultArtUrl, type VaultName } from './iconArt';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CITIES } from '../data/cities';
import {
  BUFF_EFF,
  BUFF_HOURS,
  BUILDINGS,
  BUILDING_SCALE,
  CHORES,
  CHORE_EXP,
  CHORE_HOURS,
  CITY_RES,
  FACILITIES,
  levelEff,
  FACILITY_TEXT,
  OCCUPIED_RES,
  PROCESSED,
  RES_ORDER,
  LUXURY_LOYALTY,
  RESOURCES,
  RES_BUILDING,
  RES_DESC,
  RES_ICON,
  RES_KIND,
  RES_KINDS,
  RES_KIND_TEXT,
  RES_PRICE,
  UNIT_COST,
  buildingInfo,
  type BuildingId,
  type Facility,
  type Res,
} from '../data/economy';
import { titleOf } from '../game/title';
import { COUNTRIES, countryById } from '../data/world';
import {
  buffActive,
  buildingEff,
  canChoreAt,
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
  isDefBuilding,
  armyPower,
} from '../game/economy';
import { defConsentCap, defConsentRows, splitOf } from '../game/policy';
import { budgetBreakdown, budgetPerDay, defPerDay, defShare, pendingCap, salaryPerDay, troopLossPerDay, troopsBreakdown, troopsPerDay } from '../game/state';
import { citiesOf, homeOf, isAlive, relationOf } from '../game/world';
import { BoostBar, BoostMini, BoostStart } from './BoostBar';
import { BOOST_MS, startAndFinish } from '../game/boost';
import { CountryInfo, RelTag, fmt, leaderText } from './common';
import { FLAG } from './flag';
import { FACILITY_ICON, UNIT_ICON } from './icons';
import { Fold, Meter, Modal, Tabs, useTab } from './kit';
import { timeLeft } from './officerScreens';
import type { ScreenProps } from './screens';
import { canResearch, civOf, deposits, extraResPerHour, myIslands, processOn, processPerHour } from '../game/civ';
import { PIONEER_ISLANDS } from '../data/hexmap';
import { FAC_EFF, FAC_MILESTONE, FAC_NEED, FIELD_TIER_EFF, FIELD_TIER_NAME, describeEff, scaleEff } from '../data/facilityGrowth';
import { facNeedWhy, fieldTier, fieldTierProgress } from '../game/facility';
import { TECHS } from '../data/civ';

/** 고를 수 있는 연구가 있는데 비어 있는 줄이 있으면 */
export const needPick = (s: ScreenProps['state']) => (['mil', 'soc'] as const).some((l) => !civOf(s).cur[l] && TECHS.some((t) => t.line === l && !canResearch(s, t.id)));
import { CityPanel, GovPanel, ResearchPanel } from './CivScreens';

const r1 = (v: number) => Math.round(v * 10) / 10;
const sign = (v: number) => (v >= 0 ? `+${fmt(v)}` : `−${fmt(-v)}`);

/** 누르면 말풍선이 뜨는 글자(어디서 어떻게 계산되는지). 말풍선은 늘 게임 화면 안에 들어오게 자리를 잡음 */
export function Tip({ label, title, rows, total }: { label: ReactNode; title: string; rows: Array<[string, string]>; total?: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ style: CSSProperties; arrow: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open || !btn.current || !box.current) return;
    const place = () => {
      const b = btn.current!.getBoundingClientRect();
      const frame = (btn.current!.closest('.frame') ?? document.documentElement).getBoundingClientRect();
      const left0 = Math.max(frame.left, 0) + 8;
      const right0 = Math.min(frame.right, window.innerWidth) - 8;
      const w = Math.min(220, right0 - left0);
      const h = box.current!.offsetHeight;
      const left = Math.min(Math.max(b.left + b.width / 2 - w / 2, left0), right0 - w);
      const up = b.bottom + 8 + h > window.innerHeight - 8 && b.top - 8 - h > 8;
      const top = up ? b.top - 8 - h : b.bottom + 8;
      setPos({ style: { left, top, width: w }, arrow: Math.min(Math.max(b.left + b.width / 2 - left, 12), w - 12), up });
    };
    place();
    const close = () => setOpen(false);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);
  return (
    <span className="tip">
      <button ref={btn} className="tip-btn" onClick={(e) => (e.stopPropagation(), setOpen((v) => !v), setPos(null))}>
        {label} <i>ⓘ</i>
      </button>
      {open &&
        createPortal(
          <>
            <span className="tip-shield" onClick={() => setOpen(false)} />
            <span
              ref={box}
              className={`tip-bubble${pos?.up ? ' up' : ''}`}
              role="tooltip"
              style={{ ...(pos?.style ?? { left: 0, top: 0 }), visibility: pos ? 'visible' : 'hidden', ['--arrow' as string]: `${pos?.arrow ?? 18}px` }}
              onClick={() => setOpen(false)}
            >
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
          </>,
          document.body,
        )}
    </span>
  );
}

type Tab = 'home' | 'res' | 'fac' | 'city' | 'tech' | 'gov';
export function InteriorScreen(props: ScreenProps) {
  const { state } = props;
  const [tab, setTab] = useTab<Tab>('nation', 'home');
  const choreDone = state.economy.chore && state.worldMs >= state.economy.chore.endMs;
  const civ = civOf(state);
  return (
    <>
      <Tabs
        value={(['home', 'res', 'fac', 'city', 'tech', 'gov'] as string[]).includes(tab) ? tab : 'home'}
        onChange={setTab}
        tabs={[
          { id: 'home', label: '금고', icon: '💰' },
          { id: 'res', label: '자원', icon: '⛏️' },
          { id: 'fac', label: '시설', icon: '🏭', badge: choreDone ? '!' : null },
          { id: 'city', label: '도시', icon: '🏘️' },
          { id: 'tech', label: '연구', icon: '🔬', badge: needPick(state) ? '!' : null },
          { id: 'gov', label: '체제', icon: '🃏', badge: !civ.gov ? '!' : null },
        ]}
      />
      {(tab === 'home' || !['res', 'fac', 'city', 'tech', 'gov'].includes(tab)) && <TreasuryPanel {...props} />}
      {tab === 'city' && <CityPanel {...props} />}
      {tab === 'tech' && <ResearchPanel {...props} />}
      {tab === 'gov' && <GovPanel {...props} />}
      {tab === 'res' && <ResourcePanel {...props} />}
      {tab === 'fac' && <FacilityPanel {...props} />}
    </>
  );
}

/* ───────── 금고 ───────── */
/** 금고 칸(11-27): 왼쪽 큰 그림 + 오른쪽 이름·값·시간당 한 줄. 칸 높이는 모두 같아요. */
function VCard({ art, emoji, name, value, big, children }: { art: VaultName | null; emoji: string; name: string; value: ReactNode; big?: boolean; children?: ReactNode }) {
  const url = art ? vaultArtUrl(art) : null;
  return (
    <div className={`vc${big ? ' vc-big' : ''}`}>
      <span className="vc-art">{url ? <img src={url} alt="" draggable={false} /> : <i>{emoji}</i>}</span>
      <span className="vc-body">
        <small className="vc-name">{name}</small>
        <b className="vc-val">{value}</b>
        <span className="vc-sub">{children}</span>
      </span>
    </div>
  );
}
/** 시설 효과 %(그 단계 기준, 특별 가동 빼고) */
const levelPct = (id: BuildingId, lv: number) => Math.round(levelEff(id, lv) * (BUILDING_SCALE[id] ?? 1) * 1000) / 10;
/** 그 단계 효과를 글로(새 16개는 효과 글, 나머지는 +n%) */
const levelText = (id: BuildingId, lv: number) => {
  const f = FAC_EFF[id];
  return f ? describeEff(scaleEff(f.eff, levelEff(id, lv))) : `+${levelPct(id, lv)}%`;
};
/** 시설 그림(단계마다 다름) 또는 이모지 */
function FacArt({ id, level, cls = '' }: { id: BuildingId; level: number; cls?: string }) {
  const url = facilityArtUrl(id, level);
  return url ? <img className={`fac-art ${level < 1 ? 'empty' : ''} ${cls}`} src={url} alt={id} draggable={false} /> : <span className={`bcard-ico ${level < 1 ? 'empty' : ''}`}>{buildingInfo(id).icon}</span>;
}
export function TreasuryPanel({ state, actions }: ScreenProps) {
  const me = countryById(state.player.countryId);
  const n = state.nations[me.id];
  const w = state.world;
  const e = state.economy;
  const mine = citiesOf(w, me.id);
  const home = CITIES.filter((c) => c.home === me.id);
  const occupied = mine.filter((id) => homeOf(w, id) !== me.id).length;
  const others = COUNTRIES.filter((c) => c.id !== me.id && isAlive(w, c.id));
  const relCount = (r: string) => others.filter((c) => relationOf(w, me.id, c.id) === r).length;
  const stockValue = RESOURCES.reduce((a, r) => a + (e.stock[r] ?? 0) * RES_PRICE[r], 0);
  const units = Object.values(e.army).reduce((a, v) => a + v, 0);
  const contracts = e.contracts ?? [];
  const cm = contractMoneyPerHour(state);
  const buffs = BUILDINGS.filter((b) => buffActive(state, b.id)).length;
  const avgLv = BUILDINGS.reduce((a, b) => a + (e.buildings[b.id]?.level ?? 0), 0) / BUILDINGS.length;
  const builtN = BUILDINGS.filter((b) => (e.buildings[b.id]?.level ?? 0) >= 1).length;
  const bRows = budgetBreakdown(state);
  const tRows = troopsBreakdown(state);
  const budget = budgetPerDay(state, me.id);
  const troops = troopsPerDay(state, me.id);
  const troopLoss = troopLossPerDay(state);
  const defCap = defConsentCap(state);
  return (
    <>
      <div className="vault-hero">
        <span className="vh-flag">{FLAG[me.id]}</span>
        <b>{me.name}</b>
        <small className="muted">{leaderText(state, me.id)}</small>
      </div>
      <div className="vault2">
        <div className="vgroup">
          <small className="vgroup-title">💰 예산</small>
          <VCard art="나라 예산" emoji="💰" name="나라 예산" big value={fmt(n.treasury)}>
            <Tip label={`+${fmt(budget * (1 - defShare(state)) + cm)}/시간`} title="나라 예산 시간당" rows={[...bRows, [`🛡️ 국방비로 감(국방 몫 ${splitOf(state).def}%)`, `-${fmt(budget * defShare(state))}`]]} total={`+${fmt(budget * (1 - defShare(state)) + cm)}`} />
          </VCard>
          <VCard art="봉급" emoji="💵" name="봉급" value={fmt(state.player.salary)}>
            <Tip
              label={`+${fmt(salaryPerDay(state))}/시간`}
              title="봉급"
              rows={[
                ['호칭', titleOf(state).name],
                ['쌓인 봉급(본부에서 받기)', fmt(state.player.pendingSalary)],
                ['쌓이는 한도', fmt(pendingCap(state))],
              ]}
            />
          </VCard>
          <VCard art="무역 계약" emoji="🔁" name="무역 계약" value={`${contracts.length}개`}>
            <small className={cm >= 0 ? 'ok' : 'warn'}>
              {cm >= 0 ? '+' : ''}
              {fmt(cm)}/시간
            </small>
          </VCard>
        </div>
        <div className="vgroup">
          <small className="vgroup-title def">
            🛡️ 국방비 <span>예산 {splitOf(state).def}% · 국회 {defCap}%까지</span>
          </small>
          <VCard art="국방비" emoji="🛡️" name="국방비" big value={fmt(n.def ?? 0)}>
            <Tip
              label={`+${fmt(defPerDay(state))}/시간`}
              title="국방비 시간당"
              rows={[
                ['수입 전체', fmt(budget)],
                ['국방 몫(예산 나누기)', `${splitOf(state).def}%`],
                ['🏛️ 국회 동의 한도', `${defCap}%`],
                ...defConsentRows(state).map(([k, v]) => [`  ${k}`, `${v >= 0 && k !== '기본' ? '+' : ''}${v}`] as [string, string]),
                ['쓰는 곳', '부대·국방 시설·파병'],
              ]}
              total={`+${fmt(defPerDay(state))}`}
            />
          </VCard>
          <VCard art="병력" emoji="🪖" name="병력" big value={`${fmt(n.troops)}명`}>
            <Tip label={`${sign(troops - troopLoss)}/시간`} title="병력 시간당" rows={tRows} total={sign(troops - troopLoss)} />
          </VCard>
          <VCard art="전투력" emoji="💪" name="전투력" value={fmt(armyPower(state))}>
            <small className="muted">부대 {units} · 모집 {e.queue.length}</small>
          </VCard>
        </div>
        <div className="vgroup">
          <small className="vgroup-title">📦 자원 · 산업</small>
          <VCard art="자원 값어치" emoji="📦" name="자원 값어치" value={fmt(stockValue)}>
            <small className="muted">보유량 × 기본값</small>
          </VCard>
          <VCard art="시설" emoji="🏭" name="시설" value={`평균 ${r1(avgLv)}단계`}>
            <small className="muted">
              {builtN}/{BUILDINGS.length}곳 · 가동 {buffs}
            </small>
          </VCard>
          <VCard art="도시" emoji="🏙️" name="도시" value={`${mine.length}곳`}>
            <small className="muted">
              본토 {mine.length - occupied}/{home.length} · 점령 {occupied}
            </small>
          </VCard>
        </div>
        <div className="vgroup">
          <small className="vgroup-title">🌐 외교 · 정치</small>
          <VCard art="외교" emoji="🌐" name="외교" value={`🤝${relCount('연합')} ⚔️${relCount('전쟁')}`}>
            <small className="muted">
              휴전 {relCount('휴전')} · 중립 {relCount('중립')}
            </small>
          </VCard>
          <VCard art={null} emoji="🏛️" name="국회" value={state.polity ? `여당 ${state.polity.seats.ruling}석` : `신뢰 ${Math.round(state.officer.trust)}`}>
            <small className="muted">국방비 동의 {defCap}%까지</small>
          </VCard>
          <VCard art="정보 · 신뢰" emoji="🕵️" name="정보 · 신뢰" value={`${fmt(state.officer.intel)} · ${Math.round(state.officer.trust)}`}>
            <small className="muted">명성 {fmt(state.officer.fame)}</small>
          </VCard>
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
        💵 쌓인 봉급 받기 (+{fmt(state.player.pendingSalary)}){(() => {
          const p = payPreview(state);
          return p.salary > 0 ? ` · 💰나라 예산 +${fmt(p.budget)}${p.ruby ? ` · 💎+${p.ruby}` : ''}${p.boosts ? ` · 🎫+${p.boosts}` : ''}` : '';
        })()}
      </button>
    </>
  );
}

/* ───────── 자원 ───────── */
export function ResourcePanel(props: ScreenProps) {
  const { state } = props;
  const e = state.economy;
  const per = resPerDay(state);
  const extra = extraResPerHour(state);
  const [pick, setPick] = useState<Res | null>(null);
  return (
    <>
      <p className="small muted center">자원을 누르면 설명 · 쓰는 곳 · 얻는 곳이 나와요. 도시 칸의 ⛏️ 매장지에 채굴장을 지으면 더 나요.</p>
      {RES_KINDS.map((k) => (
        <div key={k} className="fgroup">
          <small className="stat-group-name">
            {k === '전략' ? '⚙️' : k === '가공' ? '🏭' : k === '첨단' ? '🧪' : '🎁'} {k} 자원 <span className="muted">· {RES_KIND_TEXT[k]}</span>
          </small>
          <div className="res-grid">
            {RES_ORDER.filter((r) => RES_KIND[r] === k).map((r) => {
              const net = per[r] + (extra[r] ?? 0) + contractResPerHour(state, r);
              const have = e.stock[r] ?? 0;
              return (
                <button key={r} className={`res-card ${k === '생활' && have >= 1 ? 'on' : ''}`} onClick={() => setPick(r)}>
                  <span className="res-ico">
                    <ResIcon res={r} />
                  </span>
                  <b>{r}</b>
                  <strong>{fmt(have)}</strong>
                  <small className={net > 0 ? 'ok' : net < 0 ? 'warn' : 'muted'}>{net ? `${net > 0 ? '+' : ''}${r1(net)}/시간` : k === '생활' && have >= 1 ? `민심 +${LUXURY_LOYALTY}` : '안 남'}</small>
                </button>
              );
            })}
          </div>
          {k === '가공' && (
            <div className="proc-list">
              {PROCESSED.map((pr) => {
                const n = processPerHour(state, pr.res);
                const on = processOn(e, pr.res);
                return (
                  <label key={pr.res} className="small row-check">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(ev) =>
                        props.actions.apply((s) => ({
                          ...s,
                          economy: pr.res === '복합소재' ? { ...s.economy, composite: ev.target.checked } : { ...s.economy, process: { ...s.economy.process, [pr.res]: ev.target.checked } },
                        }))
                      }
                    />{' '}
                    {RES_ICON[pr.res]} {pr.res} 만들기
                    <span className="muted">
                      {n ? ` · 시간당 ${n}개 · 재료 ${Object.entries(pr.input).map(([r, v]) => `${RES_ICON[r as Res]}${r} ${v! * n}`).join(' ')}` : on ? ' · 공업 구역이 아직 없어요' : ` · 재료 ${Object.entries(pr.input).map(([r, v]) => `${r} ${v}`).join('·')}`}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}
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
    CITIES.filter((c) => w.owner[c.id] === id).reduce((a, c) => a + (CITY_RES[c.name]?.[res] ?? 0) * (homeOf(w, c.id) === id ? 1 : OCCUPIED_RES), 0);
  const contracts = (state.economy.contracts ?? []).filter((c) => c.res === res);
  const mineSpots = CITIES.filter((c) => w.owner[c.id] === me && deposits(c.id).some((d) => d.res === res));
  const islands = PIONEER_ISLANDS.filter((p) => p.res === res);
  return (
    <Modal title={res} icon={<ResIcon res={res} />} onClose={onClose}>
      <p>{RES_DESC[res]}</p>
      <div className="kv2">
        <span>보유</span>
        <b>{fmt(state.economy.stock[res] ?? 0)}개</b>
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
              {homeOf(state.world, c.id) !== me ? '(점령)' : ''} +{r1((CITY_RES[c.name]![res] ?? 0) * (homeOf(state.world, c.id) === me ? 1 : OCCUPIED_RES) * mult)}/시간
            </span>
          ))}
        </div>
      ) : (
        <p className="small muted">우리 도시에서는 안 나요. 수입하거나 나는 도시를 점령하세요.</p>
      )}
      {mineSpots.length > 0 && (
        <p className="small">
          ⛏️ 매장지: {mineSpots.map((c) => c.name).join(', ')} <span className="muted">(도시를 열고 매장지 칸에 채굴장을 지어요)</span>
        </p>
      )}
      {islands.length > 0 && <p className="small">🏝️ 분쟁 지역: {islands.map((p) => `${p.name}${myIslands(state).includes(p.id) ? '(우리 영향력 1등)' : ''}`).join(', ')}</p>}
      {PROCESSED.filter((p) => p.res === res).map((p) => (
        <p key={p.res} className="small">
          🏭 공업 구역 1곳마다 시간당 1개({Object.entries(p.input).map(([r, v]) => `${r} ${v}`).join(' + ')}을 씀)
        </p>
      ))}
      {(() => {
        const into = PROCESSED.filter((p) => p.input[res]);
        return into.length ? <p className="small muted">🏭 가공 재료: {into.map((p) => `${p.res}(${res} ${p.input[res]})`).join(', ')}</p> : null;
      })()}
      {RES_KIND[res] === '생활' && <p className="small good">🎁 1개만 있어도 모든 도시 민심 +{LUXURY_LOYALTY}. 여러 개는 효과가 같아서 남는 건 팔면 좋아요.</p>}
      {RES_BUILDING[res] && (
        <p className="small muted">
          {buildingInfo(RES_BUILDING[res]!).icon} {RES_BUILDING[res]} 효과 ×{(Math.round(mult * 100) / 100).toFixed(2)}
        </p>
      )}
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
      <button className="wide" style={{ marginTop: 6 }} onClick={() => (onClose(), go(routeTo('diplo', 'diplo', 'trade')))}>
        🚢 경제 → 무역에서 사고팔기
      </button>
    </Modal>
  );
}

/* ───────── 시설 ───────── */
/** 시설 칸. only를 주면 그 시설만(분야 탭마다 나눠 보여 줌) */
export function FacilityPanel(props: ScreenProps & { only?: readonly BuildingId[] }) {
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
      {FACILITIES.filter((f) => BUILDINGS.some((b) => b.fac === f && (!props.only || props.only.includes(b.id)))).map((f) => (
        <FacilityGroup key={f} {...props} fac={f} onPick={setPick} />
      ))}
      {pick && <BuildingModal {...props} id={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function FacilityGroup({ state, actions, fac, onPick, only }: ScreenProps & { fac: Facility; onPick: (id: BuildingId) => void; only?: readonly BuildingId[] }) {
  const e = state.economy;
  const all = BUILDINGS.filter((b) => b.fac === fac);
  const list = all.filter((b) => !only || only.includes(b.id));
  const lowest = Math.min(...all.map((b) => upgradeCost(state, b.id).exp));
  const tier = fieldTier(state, fac);
  const tp = fieldTierProgress(state, fac);
  return (
    <div className="fac-group">
      <div className="fac-head">
        <span>
          {FACILITY_ICON[fac]} <b>{fac}</b> <small className="muted">{FACILITY_TEXT[fac]}</small>
        </span>
        <small className="muted">경험 {fmt(e.facilities[fac].exp)}</small>
      </div>
      <div className="list-row small fac-tier">
        <span>
          📈 분야 성장 <b>{tier}단계 · {FIELD_TIER_NAME[tier]}</b>
          <small className="muted"> · 단계마다 {FIELD_TIER_EFF[fac].text}{tier > 0 ? ` (지금 ${describeEff(scaleEff(FIELD_TIER_EFF[fac].eff, tier))})` : ''}</small>
        </span>
        <small className="muted">{tier >= 5 ? '최고' : `시설 단계 ${tp.sum}/${tp.next}`}</small>
      </div>
      {tier < 5 && <Meter value={tp.sum} max={tp.next} />}
      {list
        .filter((b) => e.buildings[b.id].buildEndMs > state.worldMs)
        .map((b) => (
          <div key={b.id} className="list-row small">
            <span>
              🏗️ {b.id} 공사 중 · {timeLeft(e.buildings[b.id].buildEndMs - state.worldMs)}
            </span>
            <BoostBar state={state} apply={actions.apply} target={{ kind: 'build', fac: b.id }} compact />
          </div>
        ))}
      <div className="tiles c3">
        {list.map((b) => {
          const st = e.buildings[b.id];
          const building = st.buildEndMs > state.worldMs;
          const buff = buffActive(state, b.id);
          const ready = !canUpgrade(state, b.id);
          const empty = st.level < 1;
          // 카드 안 가속(11-25): 공사 중 → ⏩/⚡ · 이 시설 업무 중 → 업무 가속 · 올릴 수 있으면 ⚡바로 짓기
          const choring = !building && e.chore?.building === b.id && e.chore.endMs > state.worldMs;
          const canNow = !building && !choring && ready;
          const boost = building || choring || canNow;
          return (
            <div key={b.id} className="bcard-cell">
            <button className={`bcard ${buff ? 'buff' : ''} ${ready ? 'ready' : ''} ${empty ? 'empty' : ''} ${boost ? 'has-boost' : ''}`} onClick={() => onPick(b.id)}>
              {buff && <i className="badge">⚡</i>}
              <FacArt id={b.id} level={st.level} />
              <b>{b.id}</b>
              <small>
                {empty
                  ? facNeedWhy(state, b.id)
                    ? `🔒 ${facNeedWhy(state, b.id)}`
                    : '빈 땅 · 지을 수 있어요'
                  : FAC_EFF[b.id]
                    ? `Lv.${st.level} · ${describeEff(scaleEff(FAC_EFF[b.id]!.eff, buildingEff(state, b.id))).split(' · ')[0]}`
                    : `Lv.${st.level} · +${Math.round(buildingEff(state, b.id) * (BUILDING_SCALE[b.id] ?? 1) * 1000) / 10}%`}
              </small>
              {building ? (
                <small className="ok">🏗️ {timeLeft(st.buildEndMs - state.worldMs)}</small>
              ) : st.level < 5 ? (
                <Meter value={e.facilities[fac].exp} max={upgradeCost(state, b.id).exp || lowest} tone={ready ? 'green' : undefined} />
              ) : (
                <small className="muted">최고</small>
              )}
            </button>
            {building && <BoostMini state={state} apply={actions.apply} target={{ kind: 'build', fac: b.id }} />}
            {choring && <BoostMini state={state} apply={actions.apply} target={{ kind: 'chore' }} />}
            {canNow && (
              <BoostStart
                state={state}
                apply={actions.apply}
                need={Math.ceil((upgradeCost(state, b.id).hours * 3600e3) / BOOST_MS)}
                label={empty ? '짓기' : '올리기'}
                run={(s) => startAndFinish(s, (x) => upgradeFacility(x, b.id), { kind: 'build', fac: b.id })}
              />
            )}
            </div>
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
  const choreWhy = canChoreAt(state, id);
  const empty = st.level < 1;
  const c = upgradeCost(state, id);
  const [msg, setMsg] = useState('');
  return (
    <Modal
      title={id}
      icon={facilityArtUrl(id, st.level) ? undefined : info.icon}
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
              setMsg(empty ? '짓기 시작했어요.' : '공사를 시작했어요.');
            }}
          >
            {why ?? (empty ? '🏗️ 짓기' : '⬆️ 올리기')}
          </button>
        </>
      }
    >
      <div className="fac-hero">
        <FacArt id={id} level={st.level} cls="big" />
      </div>
      <div className="fac-steps">
        {[1, 2, 3, 4, 5].map((lv) => {
          const u = facilityArtExact(id, lv);
          return (
            <span key={lv} className={`fac-step ${lv <= st.level ? 'on' : ''} ${lv === st.level ? 'now' : ''}`}>
              {u ? <img src={u} alt="" draggable={false} /> : <i>{lv <= st.level ? info.icon : '·'}</i>}
              <small>{lv}단계</small>
            </span>
          );
        })}
      </div>
      <p>
        <span className="tag">{info.fac}</span> {info.does}
      </p>
      <div className="kv2">
        <span>지금</span>
        <b>{empty ? '빈 땅(아직 안 지음)' : `${st.level}단계 · ${levelText(id, st.level)}`}</b>
        <span>특별 가동</span>
        <b>{buffActive(state, id) ? `⚡ +${Math.round(BUFF_EFF * (BUILDING_SCALE[id] ?? 1) * 1000) / 10}% · ${timeLeft(st.buffEndMs - state.worldMs)}` : '없음'}</b>
        {st.level < 5 && (
          <>
            <span>다음 단계</span>
            <b>{levelText(id, st.level + 1)}</b>
            <span>{info.fac} 경험</span>
            <b>
              {fmt(state.economy.facilities[info.fac].exp)} / {c.exp}
            </b>
            <span>{isDefBuilding(id) ? '국방비' : '나라 예산'} · 공사</span>
            <b>
              {isDefBuilding(id) ? '🛡️' : '💰'}{fmt(c.money)} · {c.hours}시간
            </b>
            <span>올릴 수 있는 최고</span>
            <b>{maxLevel(state.player.rankIndex)}단계</b>
          </>
        )}
      </div>
      {FAC_NEED[id] && (
        <p className="small" style={{ marginTop: 6 }}>
          🔗 먼저 지을 시설: <b>{FAC_NEED[id]!.id} {FAC_NEED[id]!.lv}단계</b>{' '}
          {(state.economy.buildings[FAC_NEED[id]!.id]?.level ?? 0) >= FAC_NEED[id]!.lv ? <span className="ok">✓ 갖춤</span> : <span className="bad">아직</span>}
        </p>
      )}
      <div className="fac-miles">
        <small className="muted">단계 보너스(그 단계가 되면 계속 붙음)</small>
        {([3, 5] as const).map((lv) => (
          <div key={lv} className={`list-row small ${st.level >= lv ? 'ok' : 'muted'}`}>
            <span>
              {st.level >= lv ? '✅' : '🔒'} {lv}단계 · {FAC_MILESTONE[id][lv].text}
            </span>
          </div>
        ))}
        {FAC_EFF[id] && (
          <div className="list-row small muted">
            <span>⭐ 5단계 본 효과 · {FAC_EFF[id]!.text}</span>
          </div>
        )}
      </div>
      {(id === '군항' || id === '공군기지') && (
        <p className="small" style={{ marginTop: 6 }}>
          {id === '군항'
            ? '🌐 군항은 나라 전체 시설이에요(모집 속도). 군함을 만들려면 사회 › 도시에서 바다에 닿은 도시에 ⚓항만 구역도 지어야 해요.'
            : '🌐 공군기지는 나라 전체 시설이에요(모집 속도). 헬기·전투기·폭격기를 만들려면 사회 › 도시에서 아무 도시에나 🛫비행장 구역도 지어야 해요.'}
        </p>
      )}
      {st.buildEndMs > state.worldMs && <BoostBar state={state} apply={actions.apply} target={{ kind: 'build', fac: id }} />}
      <p className="small muted" style={{ marginTop: 6 }}>
        📋 업무 "{CHORES[id]}": {CHORE_HOURS}시간 뒤 {info.fac} 경험 +{CHORE_EXP}, 그리고 {BUFF_HOURS}시간 동안 이 시설 효과 +{Math.round(BUFF_EFF * (BUILDING_SCALE[id] ?? 1) * 1000) / 10}%.
      </p>
      {msg && <p className="small result">{msg}</p>}
    </Modal>
  );
}
