// 11-28 국정 37 강화: 일 미리 보기. 앞으로 다가올 국정 일(재난·비리 의혹·국정감사·지사 요구·선거·재신임·표결)을 시각 순으로.
import { assemblyOf } from './assembly';
import { billById } from './laws';
import { polityOf } from './polity';
import { CAMPAIGN_MS, electionName } from './seats';
import type { GameState } from './state';

export interface Upcoming {
  id: string;
  icon: string;
  name: string;
  atMs: number;
  tip: string;
  /** 시각이 정확하지 않고 "이쯤부터" 일어날 수 있음 */
  rough?: boolean;
}

export function upcomingOf(s: GameState): Upcoming[] {
  if (!s.polity) return [];
  const p = polityOf(s);
  const a = assemblyOf(s);
  const out: Upcoming[] = [];
  if (!p.disaster) out.push({ id: 'disaster', icon: '🚨', name: '재난', atMs: p.disasterMs, rough: true, tip: '재난 담당 장관·청장 능력이 높으면 잘 막아요. 미리 자리를 채워 두세요.' });
  if (!p.scandal) out.push({ id: 'scandal', icon: '🔍', name: '각료 비리 의혹', atMs: p.scandalMs, rough: true, tip: '청렴한 각료가 많으면 의혹이 덜 나와요.' });
  if (!p.audit) out.push({ id: 'audit', icon: '📋', name: '국정감사', atMs: p.auditMs, tip: '장관 능력이 높을수록 답변이 잘 돼요.' });
  if (!p.demand) out.push({ id: 'demand', icon: '🗺️', name: '시·도지사 요구', atMs: p.demandMs, rough: true, tip: '들어주면 그 도시 민심이 올라요.' });
  const e = p.election;
  out.push({ id: 'campaign', icon: '📣', name: `${electionName(e)} 유세 시작`, atMs: e.atMs - CAMPAIGN_MS, tip: '하루 2곳씩 유세해 득표율을 올려요(고향은 2배).' });
  out.push({ id: 'election', icon: '🗳️', name: electionName(e), atMs: e.atMs, tip: '지지도·경제가 좋을수록 이겨요.' });
  out.push({ id: 'conf', icon: '🏛️', name: '재신임 투표', atMs: a.confMs, tip: '지지도 65면 거의 통과, 35면 거의 실패해요.' });
  if (a.vote) out.push({ id: 'vote', icon: '📨', name: `${billById(a.vote.id).name} 표결`, atMs: a.vote.endMs, tip: '표결 전까지 의원 묶음을 설득하면 통과 확률이 올라요.' });
  return out.filter((x) => x.atMs > s.worldMs).sort((x, y) => x.atMs - y.atMs);
}
