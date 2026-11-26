// 점령 도시 편입 진행 상자(도시 창 안, 11-25)
import type { GameState } from '../game/state';
import { cityById } from '../data/cities';
import { countryById } from '../data/world';
import {
  ANNEX_LOYALTY, OK_HOURS, OCC_TASKS, PUPPET_FAVOR_HOME, LIBERATE_FAVOR, LIBERATE_FAME, annexEntry, canChoose, canLiberate, canOccTask, canVote, isAnnexed, liberate, liberateTo, makePuppet, milMs, startVote, voteYes, type OccTask,
} from '../game/annex';
import { occupyPlan, setPendingPlan } from '../battle/spec';
import type { Screen } from './nav';
import { ga, homeOf } from '../game/world';

const H = 3600e3;
const hrs = (ms: number) => {
  const h = Math.max(0, Math.ceil(ms / H));
  return h >= 48 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`;
};

type Apply = (f: (s: GameState) => GameState) => void;

/** 도시 카드에 붙는 짧은 표시 */
export function annexTag(s: GameState, id: string): string {
  const me = s.player.countryId;
  if (isAnnexed(s, id)) return ' · 🗺️ 편입';
  if (homeOf(s.world, id) === me) return '';
  const a = annexEntry(s, id);
  if (!a) return ' · 점령지';
  if (a.mode === 'puppet') return ' · 🎎 꼭두각시';
  if (a.voteAt) return ' · 🗳️ 투표 중';
  return a.stage === '군정' ? ' · 🪖 군정' : a.treaty ? ' · 📜 조약 민정' : ' · 🏛️ 민정';
}

/** 점령지 관리 임무 버튼들(미니게임 한 판) */
function OccTasks({ state, id, go }: { state: GameState; id: string; go?: (s: Screen) => void }) {
  const c = cityById(id);
  const a = annexEntry(state, id);
  if (!a || !go || !c.front) return null;
  const list = (Object.keys(OCC_TASKS) as OccTask[]).map((t) => ({ t, def: OCC_TASKS[t], why: canOccTask(state, id, t) }));
  const shown = list.filter((x) => !x.why || /시간 뒤|국방예산|가득/.test(x.why));
  if (!shown.length) return null;
  return (
    <div className="occ-tasks">
      <b className="small">🧰 점령지 관리 임무 <small className="muted">미니게임 한 판 · 별이 많을수록 효과 큼</small></b>
      {shown.map(({ t, def, why }) => {
        const cost = def.cost(c.value);
        return (
          <button
            key={t}
            className="wide"
            disabled={!!why}
            title={why ?? ''}
            onClick={() => {
              setPendingPlan(occupyPlan(id, c.name, t, def.name, def.mini, (state.worldMs / 1000 + id.length * 97) >>> 0));
              go('battle');
            }}
          >
            {def.icon} {def.name}
            <small>{why ?? `${def.desc}${cost ? ` · 💰${cost.toLocaleString('ko-KR')}` : ''}`}</small>
          </button>
        );
      })}
    </div>
  );
}

export function AnnexBox({ state, id, apply, go }: { state: GameState; id: string; apply: Apply; go?: (s: Screen) => void }) {
  const c = cityById(id);
  const me = state.player.countryId;
  const now = state.worldMs;
  if (isAnnexed(state, id)) {
    return (
      <div className="annex-box done">
        <b>🗺️ 편입한 우리 영토</b>
        <p className="small">원래 {countryById(c.home).name} 땅이었지만 이제 우리 땅이에요. 세금·자원·생산 100% · 반란 없음 · 본토 방어 보너스.</p>
      </div>
    );
  }
  if (homeOf(state.world, id) === me || state.world.owner[id] !== me) return null;
  const a = annexEntry(state, id);
  const dmg = a?.damage ? <p className="small warn">💥 전쟁 피해 {a.damage}% · 이 도시 수입 −{a.damage}% (하루 3%씩 회복, 재건 임무로 빨리)</p> : null;
  if (a?.mode === 'puppet') {
    return (
      <div className="annex-box">
        <b>🎎 꼭두각시 정부</b>
        <p className="small">반란 없음 · 세금의 30%를 공물로 받아요 · 자원·생산은 못 써요. {ga(countryById(c.home).name)} 강해지면(원래 땅을 60% 넘게 지키면) 떨어져 나갈 수 있어요.</p>
        {dmg}
        <OccTasks state={state} id={id} go={go} />
      </div>
    );
  }
  const chooseWhy = canChoose(state, id);
  const libTo = liberateTo(state, id);
  const libWhy = canLiberate(state, id);
  const choose = !chooseWhy && (
    <div className="annex-choose">
      <b className="small">이 도시를 어떻게 할까요? <small className="muted">군정 동안 고를 수 있어요 · 안 고르면 편입 길</small></b>
      <div className="annex-choose-row">
        <div className="annex-pick now">
          <b>🗺️ 편입</b>
          <small>군정 → 민정 → 주민투표. 오래 걸리지만 끝나면 우리 땅(100%). {countryById(c.home).name} 호감 크게 ↓</small>
        </div>
        <button className="annex-pick" onClick={() => apply((s) => makePuppet(s, id))}>
          <b>🎎 꼭두각시 정부</b>
          <small>바로 · 반란 없음 · 공물 30% · 자원·생산 없음 · 호감 {PUPPET_FAVOR_HOME} · 되돌릴 수 없음</small>
        </button>
        <button className="annex-pick" disabled={!!libWhy} title={libWhy ?? ''} onClick={() => apply((s) => liberate(s, id))}>
          <b>🕊️ 해방</b>
          <small>{libTo ? `${countryById(libTo).name}에 돌려줘요 · 호감 +${LIBERATE_FAVOR} · 명성 +${LIBERATE_FAME} · 연합(전쟁 중이면 휴전)` : libWhy}</small>
        </button>
      </div>
    </div>
  );
  const step = !a ? 0 : a.stage === '군정' ? 0 : a.voteAt ? 2 : 1;
  const steps = a?.treaty ? ['📜 조약', '🏛️ 민정', '🗺️ 편입'] : ['🪖 군정', '🏛️ 민정', '🗳️ 주민투표', '🗺️ 편입'];
  const shown = a?.treaty ? Math.min(step, 1) : step;
  const why = canVote(state, id);
  const yes = voteYes(state, id);
  let line = '';
  if (!a) line = '곧 군정이 시작돼요.';
  else if (a.stage === '군정') line = `군정 중 · 치안 확보까지 ${hrs(a.since + milMs(state, id) - now)} (치안청이 있으면 빨라져요). 반란 위험이 가장 높아요.`;
  else if (a.voteAt) line = `주민투표 중 · 결과까지 ${hrs(a.voteAt - now)} · 예상 찬성 ${yes.pct}%`;
  else if (a.okSince == null) line = `민정 중 · 수입 75% · 반란 절반. 민심을 ${ANNEX_LOYALTY} 이상으로 올리세요(주거·학교·병원 구역, 생활 자원, 행정안전부).`;
  else {
    const left = a.okSince + OK_HOURS * H - now;
    line = left > 0 ? `민심 ${ANNEX_LOYALTY} 이상 유지 중 · ${hrs(left)} 더 지키면 ${a.treaty ? '편입돼요' : '투표를 열 수 있어요'}` : a.treaty ? '곧 편입돼요' : '주민투표를 열 수 있어요!';
  }
  return (
    <div className="annex-box">
      <b>🏳️ 점령지 처분 · 영토 편입</b>
      <div className="annex-steps">
        {steps.map((t, i) => (
          <span key={t} className={i < shown ? 'done' : i === shown ? 'now' : ''}>
            {t}
          </span>
        ))}
      </div>
      <p className="small">{line}</p>
      {dmg}
      {choose}
      <OccTasks state={state} id={id} go={go} />
      {!a?.treaty && a?.stage === '민정' && !a.voteAt && (
        <>
          <p className="small muted">
            예상 찬성 {yes.pct}% ({yes.rows.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' · ')}) · 50% 넘으면 편입
          </p>
          <button className="primary wide" disabled={!!why} title={why ?? ''} onClick={() => apply((s) => startVote(s, id))}>
            🗳️ 주민투표 열기 <small>{why ?? `하루 뒤 결과 · 예상 찬성 ${yes.pct}%`}</small>
          </button>
        </>
      )}
      <p className="small muted">편입하면 {countryById(c.home).name} 호감이 크게, 같은 진영 나라 호감이 조금 내려가요.</p>
    </div>
  );
}
