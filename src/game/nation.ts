// 나라별 내정 이름 바꾸기 + 나라 특징 효과(11-25). 자료는 data/nations.ts.
// 부처·참모·시설 자료는 모든 나라가 같은 틀을 써서, 내 나라가 정해지면 이름만 그 나라 것으로 바꿔 둠(그림은 그대로 공용).
import { MINISTRIES } from '../data/cabinet';
import { OFFICES, POSTS } from '../data/staff';
import { GOV_FACILITIES } from '../data/govFacilities';
import { LEADERS } from '../data/leaders';
import { nationGov, type NationEffKey, type NationTrait } from '../data/nations';

/** 장군 자리 이름(한국 기준 → applyNation이 그 나라 것으로 바꿈). game/loyal.ts가 다시 내보냄 */
export const GENERAL_TITLE: Record<'합참' | '육군' | '해군' | '공군' | '정보' | '군수', string> = { 합참: '합참의장', 육군: '육군참모총장', 해군: '해군참모총장', 공군: '공군참모총장', 정보: '국군정보사령관', 군수: '군수사령관' };

type Orig = { min: Map<string, string>; post: Map<string, string>; office: Map<string, string>; fac: Map<string, [string, string]>; gen: Record<string, string> };
let orig: Orig | null = null;

/** 다른 나라용 시설 설명(한국 지명 없이) */
const FAC_TEXT: Record<string, string> = {
  foodcluster: '식품 기업이 모인 단지. 먹거리 산업이 커져요.',
  energyhub: '수소·태양광·풍력 에너지 단지.',
  startup: '새 회사가 태어나는 둥지.',
  cemetery: '나라를 지킨 사람들이 잠든 곳.',
  museum: '나라의 보물을 모은 박물관.',
  add: '새 무기를 연구하는 곳.',
  customs: '큰 항구로 드나드는 물건을 살피는 곳.',
  stockpile: '나라의 원자재를 쌓아 두는 창고.',
  kcgacademy: '바다를 지키는 사람을 길러요.',
  naro: '로켓을 쏘아 올리는 곳.',
  garden: '나라의 숲과 정원을 가꿔요.',
  farmlab: '새 농업 기술 시험장.',
  diaspora: '해외에 사는 우리 국민을 맞이해요.',
  saemangeum: '새로 여는 큰 공장 단지.',
  sejong: '정부 부처가 모인 청사.',
  baekje: '옛 유적을 지켜요.',
};
/** 다른 나라용 기본 시설 이름(나라 자료에 없을 때) */
const FAC_NAME: Record<string, string> = {
  foodcluster: '식품 산업 단지', energyhub: '에너지 단지', civilacademy: '공무원 연수원', lawcenter: '법령 정보센터', vaccine: '백신 심사센터',
  rescue: '특수 구조대', riot: '경찰 기동대', garden: '국립공원 관리소', farmlab: '농업 시험장', cdc: '감염병 대응 센터', patent: '특허 심사원',
  supercom: '기상 슈퍼컴퓨터 센터', taxdata: '국세 전산센터', draft: '징병 검사소', family: '가족 돌봄 센터',
};
let applied = '';

function keepOrig(): Orig {
  if (!orig) {
    orig = {
      min: new Map(MINISTRIES.map((m) => [m.id, m.name])),
      post: new Map(POSTS.map((p) => [p.id, p.name])),
      office: new Map(OFFICES.map((o) => [o.id, o.name])),
      fac: new Map(GOV_FACILITIES.map((f) => [f.id, [f.name, f.text]])),
      gen: { ...GENERAL_TITLE },
    };
  }
  return orig;
}

/** 내 나라 이름으로 부처·참모·기관·시설·장군 이름을 바꿔 둠(여러 번 불러도 됨) */
export function applyNation(countryId: string): void {
  if (applied === countryId) return;
  const o = keepOrig();
  const g = nationGov(countryId);
  for (const m of MINISTRIES) m.name = g.ministries[m.id] ?? o.min.get(m.id)!;
  for (const p of POSTS) p.name = g.posts[p.id] ?? o.post.get(p.id)!;
  for (const x of OFFICES) x.name = g.offices?.[x.id] ?? o.office.get(x.id)!;
  for (const f of GOV_FACILITIES) {
    const [name, text] = o.fac.get(f.id)!;
    const n = g.facilities[f.id];
    f.name = countryId === 'kr' ? name : (n?.[0] ?? FAC_NAME[f.id] ?? name);
    f.text = countryId === 'kr' ? text : (n?.[2] ?? FAC_TEXT[f.id] ?? text);
  }
  for (const k of Object.keys(GENERAL_TITLE) as Array<keyof typeof GENERAL_TITLE>) {
    GENERAL_TITLE[k] = g.generals?.[k] ?? (countryId === 'kr' ? o.gen[k] : o.gen[k].replace('국군', '군'));
  }
  applied = countryId;
}

/** 시설이 놓일 도시 이름(그 나라에 맞춘 자리, 없으면 null) */
export const nationFacCity = (countryId: string, facId: string): string | null => nationGov(countryId).facilities[facId]?.[1] ?? null;

/** 지도자 직함(대통령·총리·국가주석…) */
export const headTitle = (countryId: string) => LEADERS[countryId]?.title ?? '대통령';
/** 지도자 집무실(대통령실·백악관·총리 관저…) */
export const officeName = (countryId: string) => nationGov(countryId).office;

export const nationTraits = (countryId: string): NationTrait[] => nationGov(countryId).traits;

/** 나라 특징 효과 합 */
export function nationEff(countryId: string, key: NationEffKey): number {
  let v = 0;
  for (const t of nationTraits(countryId)) v += t.eff[key] ?? 0;
  return v;
}

/** 표에 넣을 줄(0이 아닌 특징만) */
export function nationRows(countryId: string, key: NationEffKey): Array<[string, number]> {
  return nationTraits(countryId)
    .filter((t) => t.eff[key])
    .map((t) => [`${t.icon} ${t.name}`, t.eff[key]!]);
}
