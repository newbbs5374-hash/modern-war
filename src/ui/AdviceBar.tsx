// 화면별 담당 부하 조언 줄(11-24 대장 요청 3번). 국방·외교·사회·경제 큰 탭 맨 위.
import { useState } from 'react';
import { COUNTRIES } from '../data/world';
import { advisorOf, adviceAccuracy, adviceSeed, canFollow, followAdvice, pickAdvice, tone, type AdviceField, type Tip } from '../game/advice';
import { civOf } from '../game/civ';
import { GROUPS, groupSat } from '../game/groups';
import { mediaOf } from '../game/media';
import { busyProjects } from '../game/projects';
import { spyOf } from '../game/spy';
import { pairKey } from '../game/world';
import type { GameState } from '../game/state';
import { generalSlots } from '../data/officers';
import { PersonFace } from './CabinetUI';
import { needPick } from './InteriorScreen';

const NAME: Record<AdviceField, string> = { defense: '국방', diplo: '외교', society: '사회', economy: '경제' };

/** 내 나라와 가장 긴장이 높은 나라 */
function hotPair(s: GameState): { id: string; name: string; tension: number; war: boolean } | null {
  const me = s.player.countryId;
  let best: { id: string; name: string; tension: number; war: boolean } | null = null;
  for (const c of COUNTRIES) {
    if (c.id === me) continue;
    const p = s.world.pairs[pairKey(me, c.id)];
    if (!p) continue;
    const war = p.rel === '전쟁';
    const v = war ? 200 : p.tension;
    if (!best || v > (best.war ? 200 : best.tension)) best = { id: c.id, name: c.name, tension: Math.round(p.tension), war };
  }
  return best;
}

/** 분야별 할 말 후보(무게 > 0 = 진짜 급한 일) */
export function adviceTips(s: GameState, f: AdviceField): Tip[] {
  const civ = civOf(s);
  const o = s.officer;
  const hot = hotPair(s);
  const T = (id: string, text: string, tab: string, weight: number): Tip => ({ id, text, tab, weight });
  const out: Tip[] = [];
  if (f === 'defense') {
    if (hot?.war) out.push(T('war', `${hot.name}과(와) 전쟁 중입니다. 부대부터 살피셔야 합니다.`, 'forces', 6));
    else if (hot && hot.tension >= 55) out.push(T('tension', `${hot.name}과(와) 긴장이 ${hot.tension}입니다. 작전 지도로 대비하시죠.`, 'ops', 4));
    if (o.active && s.worldMs >= o.active.endMs) out.push(T('opdone', '끝난 작전 보고가 와 있습니다.', 'ops', 5));
    if (!civ.cur.mil && needPick(s)) out.push(T('tech', '군사 연구가 멈춰 있습니다. 다음 연구를 골라 주세요.', 'tech', 4));
    if (generalSlots(s.player.rankIndex) > o.generals.length) out.push(T('gen', '빈 장군 자리가 있습니다. 지휘부를 채우시죠.', 'command', 3));
    if (!spyOf(s).active.length) out.push(T('spy', '지금 돌아가는 공작이 없습니다. 정보전을 한번 보시죠.', 'spy', 1.5));
    out.push(T('i-fac', '국방 시설을 한 단계 더 올려 두면 든든합니다.', 'fac', 0), T('i-forces', '부대 편성을 한번 둘러보시죠.', 'forces', 0), T('i-ops', '작전 지도에서 국경을 살펴보시죠.', 'ops', 0));
  } else if (f === 'diplo') {
    if (civ.council.open && civ.council.open.vote === null) out.push(T('council', '국제 회의 표결이 열려 있습니다. 표를 던지셔야 합니다.', 'council', 5));
    if (hot && !hot.war && hot.tension >= 45) out.push(T('tension', `${hot.name}과(와) 긴장이 ${hot.tension}입니다. 관계를 풀어야 합니다.`, 'rel', 4));
    if (hot?.war) out.push(T('war', `${hot.name}과(와) 전쟁 중입니다. 우방을 모아야 합니다.`, 'agree', 4));
    out.push(T('isle', '분쟁 섬 영향력을 챙기면 다투는 나라를 앞설 수 있습니다.', 'isle', 1));
    out.push(T('i-nat', '다른 나라 정보를 한번 훑어보시죠.', 'nations', 0), T('i-agree', '호감을 쌓아 두면 협정이 쉬워집니다.', 'agree', 0), T('i-mofa', '정상회담 일정을 챙겨 보시죠.', 'mofa', 0));
  } else if (f === 'society') {
    if (!civ.gov) out.push(T('gov', '아직 체제를 정하지 않으셨습니다. 체제부터 고르시죠.', 'gov', 5));
    if (o.chiefRival || o.dismissDeadlineMs !== null) out.push(T('rival', '정계가 시끄럽습니다. 정적과 국회를 먼저 챙기셔야 합니다.', 'politics', 5));
    const low = GROUPS.map((g) => [g, groupSat(s, g.id)] as const).sort((a, b) => a[1] - b[1])[0];
    if (low && low[1] <= 35) out.push(T('group', `${low[0].icon}${low[0].name} 만족도가 ${Math.round(low[1])}입니다. 달래야 합니다.`, 'opinion', low[1] <= 25 ? 5 : 3));
    if (!civ.cur.soc && needPick(s)) out.push(T('tech', '사회 연구가 멈춰 있습니다.', 'tech', 3));
    const m = mediaOf(s);
    if (m.petitions.length) out.push(T('pet', `국민 청원 ${m.petitions.length}건이 답을 기다립니다.`, 'press', 3));
    else if (s.worldMs >= m.pressMs) out.push(T('press', '기자회견을 열 때가 됐습니다.', 'press', 2));
    out.push(T('i-city', '도시를 키우면 민심이 따라옵니다.', 'city', 0), T('i-mins', '사회 부처 업무를 맡겨 두시죠.', 'mins', 0), T('i-op', '여론 단체를 한번 만나 보시죠.', 'opinion', 0));
  } else {
    if (s.economy.chore && s.worldMs >= s.economy.chore.endMs) out.push(T('chore', '끝난 시설 공사가 있습니다. 확인해 주세요.', 'facall', 4));
    if (busyProjects(s).some(([, p]) => p.endMs <= s.worldMs)) out.push(T('proj', '국가 사업 하나가 끝났습니다.', 'proj', 4));
    if (!s.economy.chore) out.push(T('idlefac', '쉬는 공사 인력이 있습니다. 산업 시설을 올리시죠.', 'ind', 2.5));
    out.push(T('i-trade', '무역 계약을 늘리면 돈이 꾸준히 들어옵니다.', 'trade', 0), T('i-res', '자원 창고를 한번 보시죠.', 'res', 0), T('i-tax', '세금과 예산 비율을 점검해 보시죠.', 'tax', 0));
  }
  return out;
}

export function AdviceBar({ state, apply, field, go }: { state: GameState; apply: (f: (s: GameState) => GameState) => void; field: AdviceField; go: (tab: string) => void }) {
  const [open, setOpen] = useState(false);
  const a = advisorOf(state, field);
  if (!a)
    return (
      <p className="advice-bar empty small muted">
        💬 {NAME[field]} 담당 장관·참모가 없어요. 개인 → 인재·대통령실에서 앉히면 조언해 줘요.
      </p>
    );
  const acc = adviceAccuracy(a);
  const tips = pickAdvice(adviceTips(state, field), acc, adviceSeed(state, field, a.p.id));
  const ok = canFollow(state, field);
  return (
    <div className={`advice-bar ${open ? 'open' : ''}`}>
      <button className="advice-head" onClick={() => setOpen(!open)}>
        <PersonFace p={a.p} size={24} />
        <span className="advice-line">
          <small>
            {a.where} {a.p.name} · 정확도 {Math.round(acc * 100)}%
          </small>
          <b>{tips[0] ? tone(a.p.trait, tips[0].text) : '특별히 드릴 말씀은 없습니다.'}</b>
        </span>
        <span className="muted">{open ? '▴' : `▾ ${tips.length}`}</span>
      </button>
      {open && (
        <div className="advice-list">
          {tips.map((t, i) => (
            <div key={t.id} className="advice-card">
              <span className="advice-n">{i + 1}</span>
              <small>{i === 0 ? tone(a.p.trait, t.text) : t.text}</small>
              <button
                onClick={() => {
                  if (ok) apply((s) => followAdvice(s, field, a.p.id, t.right));
                  go(t.tab);
                }}
              >
                따르기 →
              </button>
            </div>
          ))}
          <p className="small muted" style={{ margin: 0 }}>
            {ok ? '조언을 따르면 충성 +2(분야마다 1시간에 한 번).' : '이번 시간에는 이미 조언을 따랐어요.'} 자리 적합도가 높은 사람일수록 진짜 급한 일을 짚어요.
          </p>
        </div>
      )}
    </div>
  );
}
