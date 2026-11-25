// 점령 도시 편입 진행 상자(도시 창 안, 11-25)
import type { GameState } from '../game/state';
import { cityById } from '../data/cities';
import { countryById } from '../data/world';
import { ANNEX_LOYALTY, OK_HOURS, annexEntry, canVote, isAnnexed, milMs, startVote, voteYes } from '../game/annex';
import { homeOf } from '../game/world';

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
  if (a.voteAt) return ' · 🗳️ 투표 중';
  return a.stage === '군정' ? ' · 🪖 군정' : a.treaty ? ' · 📜 조약 민정' : ' · 🏛️ 민정';
}

export function AnnexBox({ state, id, apply }: { state: GameState; id: string; apply: Apply }) {
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
      <b>🗺️ 영토 편입</b>
      <div className="annex-steps">
        {steps.map((t, i) => (
          <span key={t} className={i < shown ? 'done' : i === shown ? 'now' : ''}>
            {t}
          </span>
        ))}
      </div>
      <p className="small">{line}</p>
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
