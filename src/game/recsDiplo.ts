// 11-28 국정 37 강화 3단계: 외교 나머지 칸 장관 추천(분쟁 지역·호감·협정·국제 회의·외교부 회담).
import { countryById, COUNTRIES } from '../data/world';
import { AGREES, ENVOY_COST, ENVOY_INFLUENCE, ISLAND_REQUEST_INFLUENCE } from '../data/civ';
import { PIONEER_ISLANDS } from '../data/hexmap';
import { canAgree, canEnvoy, canFulfill, civOf, favorOf, fulfillRequest, influenceMult, islandLeader, islandRequest, makeAgreement, sendEnvoy } from './civ';
import { canTalk } from './summitTalk';
import { tradeTips } from './tradeAdvice';
import { EMBASSY_COST, EMBASSY_MAX_FAVOR, canOpenEmbassy, openEmbassy } from './embassy';
import { pairKey } from './world';
import { approx, registerRecs, type Rec } from './recs';
import type { GameState } from './state';

const name = (id: string) => countryById(id).name;

/** 분쟁 지역: 1등과 차이가 가장 작은 섬에 사절·부탁 들어주기 */
export function islandRecs(s: GameState): Rec[] {
  const me = s.player.countryId;
  const out: Rec[] = [];
  const inf = civOf(s).influence;
  const rows = PIONEER_ISLANDS.map((p) => {
    const lead = islandLeader(s, p.id);
    const mine = inf[p.id]?.[me] ?? 0;
    return { p, mine, gap: lead.id === me ? Infinity : Math.max(0, lead.v - mine) };
  })
    .filter((r) => r.gap !== Infinity)
    .sort((a, b) => a.gap - b.gap);
  const top = rows[0];
  if (!top) return out;
  const env = Math.round(ENVOY_INFLUENCE * influenceMult(s, top.p.id));
  if (!canEnvoy(s, top.p.id))
    out.push({
      id: `isle:env:${top.p.id}`,
      field: 'diplo',
      tab: 'isle',
      icon: '🕊️',
      title: `${top.p.name}에 사절 보내기`,
      value: 3000 + (env >= top.gap ? 5000 : 0),
      gain: () => `영향력 +${env}${env >= top.gap ? ' → 1등' : ` (1등까지 ${Math.ceil(top.gap)})`}`,
      why: `1등과 차이가 가장 작은 곳이에요. 비용 ${ENVOY_COST.toLocaleString('ko-KR')}.`,
      act: (x) => sendEnvoy(x, top.p.id),
      can: (x) => canEnvoy(x, top.p.id),
    });
  for (const r of rows.slice(0, 3)) {
    if (canFulfill(s, r.p.id)) continue;
    const q = islandRequest(s, r.p.id);
    const g = Math.round(ISLAND_REQUEST_INFLUENCE * influenceMult(s, r.p.id));
    out.push({
      id: `isle:req:${r.p.id}`,
      field: 'diplo',
      tab: 'isle',
      icon: '📦',
      title: `${r.p.name} 부탁 들어주기(${q.res} ${q.qty}개)`,
      value: 3500 + (g >= r.gap ? 5000 : 0),
      gain: () => `영향력 +${g}${g >= r.gap ? ' → 1등' : ''}`,
      why: '창고에 있는 자원으로 바로 들어줄 수 있어요.',
      act: (x) => fulfillRequest(x, r.p.id),
      can: (x) => canFulfill(x, r.p.id),
    });
    break;
  }
  return out;
}

/** 호감·협정: 무역 1순위 상대와 항로, 가장 긴장 높은 나라와 불가침, 방위 약속 */
export function agreeRecs(s: GameState): Rec[] {
  const me = s.player.countryId;
  const out: Rec[] = [];
  const t = tradeTips(s)[0];
  const partner = t?.from ?? t?.to;
  if (partner && !canAgree(s, partner, 'route')) {
    const a = AGREES.find((x) => x.id === 'route')!;
    out.push({
      id: `agree:route:${partner}`,
      field: 'diplo',
      tab: 'agree',
      icon: a.icon,
      title: `${name(partner)}와 항로 개방 협정`,
      value: 4000,
      gain: () => `무역 값 10% 이득 · 호감 +5 · −${approx(a.cost)}`,
      why: `지금 무역 추천 1순위 상대예요(${t!.res}).`,
      act: (x) => makeAgreement(x, partner, 'route'),
      can: (x) => canAgree(x, partner, 'route'),
    });
  }
  let hot: { id: string; v: number } | null = null;
  for (const c of COUNTRIES) {
    if (c.id === me) continue;
    const p = s.world.pairs[pairKey(me, c.id)];
    if (p && p.rel !== '전쟁' && p.tension >= 40 && !canAgree(s, c.id, 'nonagg') && (!hot || p.tension > hot.v)) hot = { id: c.id, v: p.tension };
  }
  if (hot) {
    const h = hot;
    out.push({
      id: `agree:nonagg:${h.id}`,
      field: 'diplo',
      tab: 'agree',
      icon: '🤝',
      title: `${name(h.id)}와 불가침 협정`,
      value: 3000 + h.v * 80,
      gain: () => `긴장 ${Math.round(h.v)} 더 안 오름 · 호감 +5`,
      why: `우리와 긴장이 가장 높은 나라 중 받아 주는 곳이에요.`,
      act: (x) => makeAgreement(x, h.id, 'nonagg'),
      can: (x) => canAgree(x, h.id, 'nonagg'),
    });
  }
  const def = COUNTRIES.filter((c) => c.id !== me && !canAgree(s, c.id, 'defense')).sort((a, b) => favorOf(s, b.id) - favorOf(s, a.id))[0];
  if (def)
    out.push({
      id: `agree:defense:${def.id}`,
      field: 'diplo',
      tab: 'agree',
      icon: '🛡️',
      title: `${def.name}와 방위 약속`,
      value: 4500,
      gain: () => '내 도시 방어 +5% · 호감 +10',
      why: `호감 ${Math.round(favorOf(s, def.id))}: 방위 약속을 받아 줘요.`,
      act: (x) => makeAgreement(x, def.id, 'defense'),
      can: (x) => canAgree(x, def.id, 'defense'),
    });
  return out;
}

/** 국제 회의 표결 · 협정 문턱 가까운 나라와 정상회담(직접 고르는 일이라 보기만) */
export function talkRecs(s: GameState): Rec[] {
  const out: Rec[] = [];
  const o = civOf(s).council.open;
  if (o && o.vote === null)
    out.push({ id: 'council:vote', field: 'diplo', tab: 'council', icon: '🗳️', title: '국제 회의 표결에 표 던지기', value: 7000, gain: () => '표를 안 내면 부관이 대신 고름', why: '열린 표결이 있어요.' });
  const me = s.player.countryId;
  const near = COUNTRIES.filter((c) => c.id !== me && !canTalk(s, c.id, 'visit'))
    .map((c) => ({ c, f: favorOf(s, c.id) }))
    .filter((x) => x.f >= 20 && x.f < 30)
    .sort((a, b) => b.f - a.f)[0];
  if (near)
    out.push({
      id: `talk:${near.c.id}`,
      field: 'diplo',
      tab: 'mofa',
      icon: '✈️',
      title: `${near.c.name} 정상 찾아가기`,
      value: 2500,
      gain: () => `호감 ${Math.round(near.f)} → 30이면 방위 약속`,
      why: '조금만 더 오르면 방위 약속을 맺을 수 있어요.',
    });
  return out;
}

registerRecs('diplo', islandRecs);
registerRecs('diplo', agreeRecs);
registerRecs('diplo', talkRecs);

/** 대사관 칸이 비면: 방위 약속(호감 30)까지 가장 가까운 나라 */
export function embassyRecs(s: GameState): Rec[] {
  const me = s.player.countryId;
  const c = COUNTRIES.filter((x) => x.id !== me && !canOpenEmbassy(s, x.id))
    .map((x) => ({ x, f: favorOf(s, x.id) }))
    .sort((a, b) => Math.abs(30 - a.f - EMBASSY_MAX_FAVOR) - Math.abs(30 - b.f - EMBASSY_MAX_FAVOR))[0];
  if (!c) return [];
  return [
    {
      id: `emb:${c.x.id}`,
      field: 'diplo',
      tab: 'mofa',
      icon: '🏢',
      title: `${c.x.name}에 대사 보내기`,
      value: 3200,
      gain: () => `호감 +4 → 날마다 +2(최대 +${EMBASSY_MAX_FAVOR}) · −${approx(EMBASSY_COST)}`,
      why: `호감 ${Math.round(c.f)}: 대사관 호감이 다 차면 방위 약속(30)에 가까워져요.`,
      act: (x) => openEmbassy(x, c.x.id),
      can: (x) => canOpenEmbassy(x, c.x.id),
    },
  ];
}
registerRecs('diplo', embassyRecs);
