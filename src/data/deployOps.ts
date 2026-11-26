// 11-26 파병 요청 · 파병 교전(대장 요청).
// "인도양에 파병하기, 유럽 XX나라에 파병하기 등 해당 국가의 요청이 생겼다는 이벤트(최대한 많이, 빈번하게)"
// "파병 중인 군인이 있을 때(파병한 병과에 맞는) 이벤트성 전투 30개 이상 · 공중전·해상전·육상전·해상-육상전·해상-공중전·육상-공중전"
// 요청 = 지역 28곳 × 요청 종류 12가지(지역 성격에 맞는 것만) · 교전 = 40가지(전장은 battle3d/deployFields.ts 등 3D 전장).
import { AIR, LAND, SEA } from '../battle3d/deployFields';
import type { Kind } from '../battle3d/sim';

export type Branch = 'land' | 'sea' | 'air';
export const BRANCH_NAME: Record<Branch, string> = { land: '육군', sea: '해군', air: '공군' };
export const BRANCH_ICON: Record<Branch, string> = { land: '🪖', sea: '⚓', air: '✈️' };
/** 지역 성격(요청 종류·교전이 어울리는지 고를 때) */
export type Tag = 'ocean' | 'coast' | 'desert' | 'snow' | 'arctic' | 'jungle' | 'mountain' | 'city' | 'plain';

export interface Region {
  id: string;
  name: string;
  /** 깃발 대신 쓰는 그림 글자 */
  icon: string;
  tags: Tag[];
  /** 고마워하는 13개국(있으면 호감) */
  friend?: string;
}

/** 파병 요청이 오는 곳(13개국 밖 나라·바다). id는 'r-'로 시작(나라 id와 겹치지 않게) */
export const REGIONS: Region[] = [
  { id: 'r-indian', name: '인도양', icon: '🌊', tags: ['ocean'], friend: 'in' },
  { id: 'r-aden', name: '아덴만', icon: '🌊', tags: ['ocean', 'coast', 'desert'] },
  { id: 'r-hormuz', name: '호르무즈 해협', icon: '🛢️', tags: ['ocean', 'coast', 'desert'] },
  { id: 'r-malacca', name: '말라카 해협', icon: '🌊', tags: ['ocean', 'coast', 'jungle'] },
  { id: 'r-med', name: '지중해', icon: '🌊', tags: ['ocean', 'coast', 'city'], friend: 'tr' },
  { id: 'r-arcticsea', name: '북극해', icon: '🧊', tags: ['ocean', 'arctic'] },
  { id: 'r-guinea', name: '기니만', icon: '🌊', tags: ['ocean', 'coast', 'jungle'] },
  { id: 'r-carib', name: '카리브해', icon: '🏝️', tags: ['ocean', 'coast', 'jungle'], friend: 'us' },
  { id: 'r-pacific', name: '남태평양 섬나라', icon: '🏝️', tags: ['ocean', 'coast', 'jungle'], friend: 'jp' },
  { id: 'r-philippines', name: '필리핀', icon: '🏝️', tags: ['ocean', 'coast', 'jungle', 'city'] },
  { id: 'r-poland', name: '폴란드', icon: '🇵🇱', tags: ['snow', 'plain', 'city'], friend: 'de' },
  { id: 'r-lithuania', name: '리투아니아', icon: '🇱🇹', tags: ['snow', 'plain', 'coast'] },
  { id: 'r-romania', name: '루마니아', icon: '🇷🇴', tags: ['mountain', 'plain', 'coast'], friend: 'ua' },
  { id: 'r-finland', name: '핀란드', icon: '🇫🇮', tags: ['snow', 'arctic', 'plain'] },
  { id: 'r-norway', name: '노르웨이', icon: '🇳🇴', tags: ['arctic', 'ocean', 'coast', 'mountain'], friend: 'uk' },
  { id: 'r-moldova', name: '몰도바', icon: '🇲🇩', tags: ['plain', 'city'], friend: 'ua' },
  { id: 'r-mali', name: '말리(사헬)', icon: '🏜️', tags: ['desert'] },
  { id: 'r-niger', name: '니제르', icon: '🏜️', tags: ['desert'] },
  { id: 'r-somalia', name: '소말리아', icon: '🏜️', tags: ['desert', 'coast', 'ocean', 'city'] },
  { id: 'r-ssudan', name: '남수단', icon: '🌍', tags: ['desert', 'jungle', 'plain'] },
  { id: 'r-lebanon', name: '레바논', icon: '🇱🇧', tags: ['city', 'coast', 'mountain'] },
  { id: 'r-sinai', name: '시나이 반도', icon: '🏜️', tags: ['desert', 'mountain'] },
  { id: 'r-congo', name: '콩고', icon: '🌳', tags: ['jungle', 'city'] },
  { id: 'r-haiti', name: '아이티', icon: '🏝️', tags: ['city', 'coast', 'ocean'], friend: 'us' },
  { id: 'r-colombia', name: '콜롬비아', icon: '🌳', tags: ['jungle', 'mountain'] },
  { id: 'r-afghan', name: '아프가니스탄', icon: '⛰️', tags: ['mountain', 'desert'] },
  { id: 'r-kuwait', name: '쿠웨이트', icon: '🛢️', tags: ['desert', 'coast', 'city'] },
  { id: 'r-cyprus', name: '키프로스', icon: '🏝️', tags: ['coast', 'city', 'ocean'], friend: 'uk' },
];
export const regionById = (id: string) => REGIONS.find((r) => r.id === id);
export const isRegion = (id: string) => id.startsWith('r-');

export interface RequestKind {
  id: string;
  name: string;
  icon: string;
  /** 보낸 부대에 꼭 있어야 하는 병과(모두) */
  need: Branch[];
  /** 이 성격 중 하나가 있는 지역에서만 */
  tags: Tag[];
  /** 머무는 실제 시간 */
  hours: number;
  /** 요청 글({곳} = 지역 이름) */
  text: string;
  /** 끝나면 받는 나라 예산 · 명성 */
  money: number;
  fame: number;
}

export const REQUEST_KINDS: RequestKind[] = [
  { id: 'pirate', name: '해적 퇴치', icon: '🏴‍☠️', need: ['sea'], tags: ['ocean'], hours: 12, money: 3000, fame: 6, text: '{곳}에 해적이 들끓어 상선이 오가지 못해요. 해군을 보내 바다를 지켜 달라는 요청이 왔어요.' },
  { id: 'escort', name: '상선 호송', icon: '🚢', need: ['sea'], tags: ['ocean'], hours: 10, money: 2700, fame: 5, text: '{곳}을(를) 지나는 상선단이 호위를 부탁해요. 구축함 몇 척이면 충분하대요.' },
  { id: 'blockade', name: '해상 감시', icon: '🔭', need: ['sea'], tags: ['ocean', 'arctic'], hours: 14, money: 3200, fame: 5, text: '{곳}에서 무기 밀수선이 오간다는 첩보예요. 해상 감시를 함께 해 달래요.' },
  { id: 'airpatrol', name: '영공 초계', icon: '🛩️', need: ['air'], tags: ['ocean', 'coast', 'desert', 'snow', 'arctic', 'mountain', 'plain'], hours: 10, money: 2800, fame: 5, text: '{곳} 하늘에 정체불명 비행기가 자꾸 들어와요. 전투기·드론으로 하늘을 지켜 달래요.' },
  { id: 'peace', name: '평화유지', icon: '🕊️', need: ['land'], tags: ['desert', 'jungle', 'city', 'plain', 'mountain'], hours: 16, money: 3300, fame: 8, text: '{곳}에서 휴전이 맺어졌어요. 휴전이 깨지지 않게 평화유지군을 보내 달래요.' },
  { id: 'border', name: '국경 경계', icon: '🧱', need: ['land'], tags: ['snow', 'plain', 'mountain'], hours: 14, money: 3000, fame: 6, text: '{곳} 국경 너머에 무장 세력이 모이고 있어요. 국경을 함께 지켜 달라는 요청이에요.' },
  { id: 'rebel', name: '반군 소탕', icon: '🎯', need: ['land'], tags: ['desert', 'jungle', 'mountain'], hours: 12, money: 3700, fame: 7, text: '{곳} 정부가 반군에 밀리고 있어요. 지상군을 보내 반군 소탕을 도와 달래요.' },
  { id: 'relief', name: '재난 구호', icon: '⛑️', need: [], tags: ['coast', 'city', 'jungle', 'plain'], hours: 8, money: 2000, fame: 9, text: '{곳}에 큰 지진·홍수가 났어요. 어떤 부대든 보내 구호를 도와 달래요. 세계가 지켜봐요.' },
  { id: 'evac', name: '교민 보호', icon: '🛂', need: ['land'], tags: ['city', 'coast', 'desert'], hours: 8, money: 2300, fame: 6, text: '{곳}의 치안이 무너졌어요. 우리 교민과 외국인을 지킬 부대가 필요해요.' },
  { id: 'drill', name: '연합 훈련', icon: '🤝', need: [], tags: ['ocean', 'coast', 'desert', 'snow', 'arctic', 'jungle', 'mountain', 'city', 'plain'], hours: 6, money: 1700, fame: 4, text: '{곳}에서 여러 나라가 모이는 연합 훈련에 우리 부대도 와 달래요.' },
  { id: 'base', name: '기지 방어', icon: '🛡️', need: ['land', 'air'], tags: ['desert', 'mountain', 'snow', 'plain'], hours: 16, money: 4300, fame: 8, text: '{곳}의 공군 기지가 공격 위협을 받아요. 지상군과 공군을 함께 보내 달래요.' },
  { id: 'landing', name: '상륙 지원', icon: '⚓', need: ['sea', 'land'], tags: ['coast'], hours: 14, money: 4300, fame: 8, text: '{곳} 해안의 섬·항구를 무장 세력이 차지했어요. 배와 지상군을 함께 보내 되찾아 달래요.' },
];
export const requestKindById = (id: string) => REQUEST_KINDS.find((k) => k.id === id);
/** 지역에 어울리는 요청 종류 */
export const kindsFor = (r: Region) => REQUEST_KINDS.filter((k) => k.tags.some((t) => r.tags.includes(t)));

/** 전투 모양(대장 요청: 공중전·해상전·육상전·해상-육상전·해상-공중전·육상-공중전) */
export type Mode = 'air' | 'sea' | 'land' | 'sea-land' | 'sea-air' | 'land-air' | 'joint';
export const MODE_NAME: Record<Mode, string> = {
  air: '공중전',
  sea: '해상전',
  land: '육상전',
  'sea-land': '해상-육상전',
  'sea-air': '해상-공중전',
  'land-air': '육상-공중전',
  joint: '육해공 합동전',
};
export const MODE_NEED: Record<Mode, Branch[]> = {
  air: ['air'],
  sea: ['sea'],
  land: ['land'],
  'sea-land': ['sea', 'land'],
  'sea-air': ['sea', 'air'],
  'land-air': ['land', 'air'],
  joint: ['land', 'sea', 'air'],
};
export const BRANCH_KINDS: Record<Branch, Kind[]> = { land: LAND, sea: SEA, air: AIR };

export interface Clash {
  id: string;
  title: string;
  icon: string;
  mode: Mode;
  /** 3D 전장 id */
  field: string;
  /** 이 성격이 있는 곳에서만(13개국 파병은 어디든) */
  tags: Tag[];
  /** 알림 글({곳}·{병과}) — 끝은 질문 */
  text: string;
  /** 이기면 받는 돈(별 하나마다) · 명성 */
  money: number;
  fame: number;
  /** 배치 예산 바꾸기(없으면 전장 값) */
  budget?: number;
}

const C = (id: string, icon: string, title: string, mode: Mode, field: string, tags: Tag[], text: string, money = 800, fame = 3, budget?: number): Clash => ({ id, icon, title, mode, field, tags, text, money, fame, budget });

/** 파병 교전 40가지 */
export const CLASHES: Clash[] = [
  // ── 해상전
  C('pirate-swarm', '🏴‍☠️', '해적 고속정 떼', 'sea', 'pirates', ['ocean'], '{곳}에 파병한 {병과}가 해적 고속정 떼와 교전이 일어났어요. 소탕하러 가시겠어요?'),
  C('hijack', '🚢', '상선 납치 시도', 'sea-air', 'convoysea', ['ocean'], '{곳}을(를) 지나던 상선을 해적이 납치하려 해요. {병과}의 배와 헬기가 상선 옆에 붙었어요. 호위하러 가시겠어요?'),
  C('mine-subs', '🫧', '해협의 숨은 잠수함', 'sea', 'hormuz', ['ocean', 'desert'], '{곳}에서 정체불명 잠수함이 {병과}를 따라붙었어요. 먼저 찾아 격침하러 가시겠어요?'),
  C('ice-fleet', '🧊', '얼음 바다 침입 함대', 'sea', 'arcticsea', ['arctic', 'ocean'], '{곳}에 정체불명 함대가 들어왔어요. {병과}가 막아서고 있어요. 쫓아내러 가시겠어요?'),
  C('night-boats', '🌙', '밤바다 난민선 습격', 'sea', 'refugee', ['ocean', 'coast'], '{곳} 밤바다에서 난민선이 무장 보트에 쫓기고 있어요. {병과}가 가장 가까워요. 구하러 가시겠어요?', 900, 5),
  C('rogue-carrier', '🛳️', '불량 국가 항모 전단', 'sea', 'carrier', ['ocean'], '{곳}에 불량 국가 항모 전단이 나타나 {병과}를 위협해요. 큰 해전이에요. 맞서시겠어요?', 1200, 6),
  C('strait-battle', '⚓', '해협 봉쇄 돌파', 'sea', 'strait', ['ocean'], '{곳} 해협을 무장 함대가 막아 섰어요. {병과}가 길을 뚫어야 해요. 돌파하시겠어요?', 1100, 5),
  // ── 해상-공중전
  C('pirate-mother', '🚁', '해적 모선과 헬기', 'sea-air', 'pirates', ['ocean'], '{곳}의 해적 모선이 헬기까지 띄웠어요. {병과}가 배와 비행기로 함께 칠 수 있어요. 소탕하러 가시겠어요?', 3500),
  C('convoy-air', '🛩️', '상선단 하늘 엄호', 'sea-air', 'convoysea', ['ocean'], '{곳} 상선단에 해적과 무장 드론이 함께 덤벼요. {병과}가 배와 하늘을 함께 지켜야 해요. 엄호하러 가시겠어요?', 3500),
  C('carrier-duel', '✈️', '항모 대 항모', 'sea-air', 'carrier', ['ocean'], '{곳}에서 적 항모 전단과 마주쳤어요. {병과}의 함대와 비행대가 함께 맞붙어요. 결전하시겠어요?', 1400, 7),
  C('gulf-raid', '🛢️', '유조선 노린 기습', 'sea-air', 'hormuz', ['ocean', 'desert'], '{곳}에서 유조선을 노린 잠수함과 고속정이 움직여요. {병과}가 배와 헬기로 막을 수 있어요. 가시겠어요?', 3500),
  C('polar-patrol', '🌨️', '북극 초계 교전', 'sea-air', 'arcticsea', ['arctic', 'ocean'], '{곳} 초계 중인 {병과}에 적 함대가 쏘기 시작했어요. 배와 비행기로 반격하시겠어요?', 3500),
  C('rescue-air', '🛟', '구조선 엄호', 'sea-air', 'refugee', ['ocean', 'coast'], '{곳}에서 구조 작전 중인 {병과}를 무장 보트가 덮쳤어요. 배와 헬기로 지키러 가시겠어요?', 900, 5),
  C('fjord-raid', '🏔️', '피오르 해안 기습', 'joint', 'fjord', ['arctic', 'mountain', 'coast'], '{곳} 피오르 해안에 적 지휘소가 숨어 있어요. {병과}의 배·지상군·비행기로 함께 치러 가시겠어요?', 1200, 7),
  // ── 공중전
  C('tanker-cap', '🛢️', '유조선단 하늘 지키기', 'air', 'skysea', ['ocean', 'coast', 'desert'], '{곳} 하늘에 적 폭격기 편대가 유조선단을 노려요. {병과}가 출격 준비를 마쳤어요. 막으러 가시겠어요?'),
  C('gunboat-strike', '💥', '무장 함정 공습', 'air', 'seastrike', ['ocean', 'coast'], '{곳}에 무장 함정이 몰려와요. {병과}가 하늘에서 칠 수 있어요. 공습하시겠어요?'),
  C('radar-defense', '📡', '레이더 기지 방공', 'air', 'skyland', ['mountain', 'desert', 'snow', 'plain', 'arctic'], '{곳}의 레이더 기지로 적 전투기·폭격기가 날아와요. {병과}가 하늘을 지켜야 해요. 출격하시겠어요?'),
  // ── 육상전
  C('border-raid', '🧱', '국경 초소 습격', 'land', 'border', ['snow', 'plain'], '{곳} 국경 초소에 무장 세력이 넘어왔어요. {병과}가 초소를 지키고 있어요. 막으러 가시겠어요?'),
  C('sahel-camp', '🏜️', '사막 반군 거점', 'land', 'sahel', ['desert'], '{곳}에서 {병과}가 반군 거점을 찾아냈어요. 소탕하러 가시겠어요?'),
  C('jungle-cartel', '🌿', '밀림 무장 조직', 'land', 'cartel', ['jungle'], '{곳} 밀림 속 무장 조직이 {병과}를 공격했어요. 본거지를 치러 가시겠어요?'),
  C('embassy-evac', '🏛️', '대사관 철수 엄호', 'land', 'embassy', ['city', 'coast'], '{곳}에서 폭동이 나 대사관 사람들이 갇혔어요. {병과}가 가장 가까워요. 구하러 가시겠어요?', 900, 5),
  C('oil-defense', '🛢️', '유전 지키기', 'land', 'oasis', ['desert'], '{곳} 유전에 무장 세력이 몰려와요. {병과}가 유전을 지키고 있어요. 버티러 가시겠어요?'),
  C('bridge-hold', '🌉', '다리 사수', 'land', 'bridgehold', ['plain', 'jungle', 'city'], '{곳}의 큰 다리를 무장 세력이 끊으려 해요. {병과}가 다리 건너 진지에 있어요. 지키러 가시겠어요?'),
  C('aid-convoy', '🚚', '구호 차량 호송', 'land', 'mountainpass', ['mountain', 'snow'], '{곳} 산길로 가는 구호 차량을 무장 세력이 노려요. {병과}가 호송할 수 있어요. 가시겠어요?', 800, 5),
  C('hostage', '🆘', '구호요원 인질 구출', 'land', 'hostage', ['jungle', 'plain', 'desert', 'mountain'], '{곳}에서 구호요원이 무장 세력에게 붙잡혔어요. {병과}가 마을 가까이 있어요. 구출하러 가시겠어요?', 1000, 6),
  C('ridge-assault', '⛰️', '산악 무장 기지', 'land', 'highland', ['mountain'], '{곳} 고지 위에 무장 세력 기지가 있어요. {병과}가 고지를 올려다보고 있어요. 치러 가시겠어요?', 3500),
  C('canyon-ambush', '🪨', '협곡 매복', 'land', 'canyon', ['mountain', 'desert'], '{곳} 협곡을 지나던 {병과}가 매복을 당했어요. 뚫고 나가시겠어요?', 3500),
  // ── 육상-공중전
  C('valley-cas', '🛡️', '계곡 근접 지원', 'land-air', 'cas', ['mountain', 'desert', 'plain'], '{곳} 계곡에서 평화유지군 차량이 포위됐어요. {병과}의 지상군과 하늘 지원이 함께 필요해요. 가시겠어요?', 900, 5),
  C('sahel-air', '🚁', '사막 반군 공습', 'land-air', 'sahel', ['desert'], '{곳} 반군이 무장 트럭으로 움직여요. {병과}의 지상군과 헬기로 함께 치시겠어요?', 3500),
  C('border-air', '🛩️', '국경 너머 기갑 공세', 'land-air', 'border', ['snow', 'plain'], '{곳} 국경 너머에서 전차와 헬기가 넘어와요. {병과}가 땅과 하늘에서 함께 막아야 해요. 가시겠어요?', 3500),
  C('cartel-air', '🌴', '밀림 본거지 공습', 'land-air', 'cartel', ['jungle'], '{곳} 무장 조직 본거지를 찾았어요. {병과}의 지상군과 드론으로 함께 치시겠어요?', 3500),
  C('oil-air', '🔥', '유전 공습 막기', 'land-air', 'oasis', ['desert'], '{곳} 유전에 적 지상군과 드론이 함께 와요. {병과}가 땅과 하늘에서 지켜야 해요. 가시겠어요?', 3500),
  C('dune-raid', '🏭', '사막 정유 기지 기습', 'land-air', 'dune', ['desert'], '{곳}의 무장 세력이 정유 기지를 차지했어요. {병과}의 지상군과 공군으로 되찾으시겠어요?', 1000, 5),
  C('airfield-raid', '🛫', '적 비행장 기습', 'land-air', 'airfield', ['plain', 'desert', 'snow'], '{곳}의 무장 세력 비행장에서 드론이 계속 떠요. {병과}로 비행장을 치시겠어요?', 1000, 5),
  // ── 해상-육상전
  C('pirate-base', '☠️', '해적 해안 기지', 'sea-land', 'piratebase', ['coast'], '{곳} 해안에서 해적 기지를 찾았어요. {병과}의 배와 지상군으로 함께 치시겠어요?', 1000, 5),
  C('coral-island', '🏝️', '산호섬 기지 탈환', 'sea-land', 'island', ['coast', 'jungle', 'ocean'], '{곳}의 작은 섬 기지를 무장 세력이 차지했어요. {병과}로 상륙해 되찾으시겠어요?', 1000, 5),
  C('stop-landing', '🌊', '상륙 저지', 'sea-land', 'coastdef', ['coast'], '{곳} 해안으로 무장 세력 배가 상륙하려 해요. {병과}가 해안에 있어요. 막으시겠어요?', 3500),
  C('harbor-raid', '⚓', '밀수 항구 급습', 'sea-land', 'harbor', ['coast', 'city'], '{곳}의 밀수 항구에서 무기가 오가요. {병과}로 부두를 차지하시겠어요?', 1000, 5),
  // ── 육해공 합동전
  C('island-joint', '🎖️', '섬 기지 합동 상륙', 'joint', 'island', ['coast', 'ocean', 'jungle'], '{곳} 섬 기지에 대공포까지 있어요. {병과}의 배·지상군·비행기를 모두 써서 되찾으시겠어요?', 1200, 7),
  C('beach-joint', '🎖️', '해안 합동 상륙', 'joint', 'beachhead', ['coast'], '{곳} 해안 요새를 무장 세력이 지켜요. {병과}의 육해공 합동 상륙이 필요해요. 가시겠어요?', 1200, 7),
];
export const clashById = (id: string) => CLASHES.find((c) => c.id === id);
