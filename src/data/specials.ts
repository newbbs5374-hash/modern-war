// 나라별 특화 유닛(11-23 대장 결정): 나라마다 2개 + 몇 나라만 만드는 독점 병과 3종.
// - 특화 유닛은 바탕 병과와 같은 연구·등급·구역에서 열리고, 바탕 병과도 계속 만들 수 있음(바꿔 끼우기 아님).
// - 값은 바탕 병과의 약 ×1.15, 전투력 ×1.3(11-27, 3D 전투에서도 체력·공격 +30%) + 고유 능력 1개. (11-26 지도 위 2.5D 전투는 없어짐: 지금은 값·전투력·이름만 씀)
// - '국가 비밀 병기' 연구: 특화 유닛 전투력 +15%. '갈륨 레이더' 연구 뒤에는 갈륨 1을 더 써서 갈륨 개량형(+15%).
// - AI 나라도 지도 위 전투에서 자기 특화 유닛을 내보냄. 남의 도시를 점령해도 남의 특화 유닛은 못 만듦.
// 이름·모양은 이 게임에서 새로 지은 것(실제 무기·다른 게임 이름 아님).
import type { FKind, FTerrain } from './fieldKinds';
import { COUNTRIES, countryById } from './world';

/** 지도 위 전투에서 바뀌는 것(없으면 그대로) */
export interface FieldMod {
  kind: FKind;
  hp?: number;
  atk?: number;
  def?: number;
  /** 사거리 +칸 */
  range?: number;
  /** 시야 +칸 */
  sight?: number;
  /** 한 칸 가는 시간 배율(0.7 = 30% 빠름) */
  move?: number;
  /** 첫 공격 피해 배율 */
  ambush?: number;
  /** 적 방공·함선이 이 부대를 때릴 때 배율(0.5 = 절반) */
  evadeAA?: number;
  /** 이 지형에서는 느려지지 않고, 공격 + */
  terrain?: { at: FTerrain[]; atk: number };
  /** 이 종류 적 상대로 공격 배율 */
  vs?: { kinds: FKind[]; v: number };
  /** 이 종류 우리 편이 옆 칸에 있으면 공격 배율 */
  buddy?: { kind: FKind; v: number };
  /** 받는 피해 배율 */
  taken?: number;
  /** 1초마다 체력 회복(최대 체력의 비율) */
  regen?: number;
  /** 적 부대 위치를 모두 봄(해킹) */
  reveal?: boolean;
  /** 잠수함처럼 붙기 전엔 안 보임 */
  hidden?: boolean;
  /** 같은 종류 우리 편이 옆에 있으면 받는 피해 배율(무리 지을수록 단단) */
  pack?: number;
  /** 바다 칸 적도 제대로 때림(해안포) */
  seaStrike?: number;
  /** 우리 땅(점령지 방어) 지킬 때 힘 + (대전투가 아니라 침공 막기에 씀) */
  homeDef?: number;
  /** 보급 기지 역할(항모처럼 둘레 칸 보급) */
  supply?: number;
  /** 둘레 칸 우리 편이 받는 피해 배율(보호막) */
  shield?: { r: number; v: number };
  /** 처음에 보병을 더 데려옴 */
  extraInfantry?: number;
  /** 탄약·연료를 덜 씀(0.5 = 절반) */
  thrift?: number;
}

export interface SpecialDef {
  /** 'us-1' 같은 이름표 */
  id: string;
  country: string;
  slot: 1 | 2;
  name: string;
  base: string;
  effect: string;
  /** 값 배율(기본 1.15) · 시간 배율(기본 1.1) · 전투력 배율(기본·최소 1.3) */
  cost?: { money?: number; hours?: number; power?: number };
  field: FieldMod;
  /** 그림 칸 GPT 프롬프트(오른쪽을 보는 말 한 장) */
  art: string;
}

/** 바탕 병과 → 지도 위 전투 말 종류 */
export const FIELD_KIND_OF: Record<string, FKind> = {
  보병: 'infantry', 기갑병: 'infantry', 특수부대: 'infantry', 해킹부대: 'infantry',
  전차: 'tank', 포병: 'artillery', 미사일: 'artillery', 방공부대: 'aa', 무인드론: 'drone',
  공격헬기: 'fighter', 전투기: 'fighter', 폭격기: 'fighter',
  구축함: 'destroyer', 잠수함: 'submarine', 항공모함: 'carrier',
  탄도미사일: 'artillery', 다연장로켓: 'artillery', '극초음속 미사일': 'artillery', 공병: 'infantry', '해안 미사일': 'artillery', '장거리 방공': 'aa', 상륙장갑차: 'infantry',
  '정찰 무인기': 'drone', '바다 드론': 'drone', '스텔스 전투기': 'fighter', 조기경보기: 'fighter', '대잠 초계기': 'fighter', 전자전기: 'fighter', 공중급유기: 'fighter', '군집 드론': 'drone', '대드론 레이저 차량': 'aa', '무인 전투 로봇': 'tank', 해병대: 'infantry', '기뢰 부설함': 'destroyer', '지상 공격기': 'fighter',
};

const S = (d: SpecialDef) => d;

/** ② 새 특화 유닛(나라마다 하나) */
const SECOND: SpecialDef[] = [
  S({ id: 'us-2', country: 'us', slot: 2, name: '스텔스 비행대', base: '전투기', effect: '첫 공격 피해 +40% · 적 방공에 잘 안 맞음(피해 절반)', field: { kind: 'fighter', ambush: 1.4, evadeAA: 0.5 }, art: 'A pair of dark angular stealth fighter jets with flat faceted surfaces and a faint starry sheen, flying side by side.' }),
  S({ id: 'cn-2', country: 'cn', slot: 2, name: '남해 호위전단', base: '구축함', effect: '만드는 시간 −35% · 우리 배가 옆에 있으면 받는 피해 −25%', cost: { hours: 0.65 }, field: { kind: 'destroyer', pack: 0.75 }, art: 'A compact frigate warship with overlapping scale-like armor plates on the hull, a single gun and missile box.' }),
  S({ id: 'ru-2', country: 'ru', slot: 2, name: '시베리아 돌격 전차', base: '전차', effect: '산·숲에서도 느려지지 않고 공격 +20% · 방어 +20%', field: { kind: 'tank', def: 1.2, terrain: { at: ['산', '숲'], atk: 1.2 } }, art: 'A wide heavy tank painted white and grey with snow plow blade in front and wide tracks, frost on the armor.' }),
  S({ id: 'de-2', country: 'de', slot: 2, name: '철갑 척탄병', base: '기갑병', effect: '전차 옆에서 공격 +25% · 1초마다 체력 1% 회복', field: { kind: 'infantry', buddy: { kind: 'tank', v: 1.25 }, regen: 0.01 }, art: 'A heavy eight-wheeled armored personnel carrier with soldiers in thick steel armor plates dismounting beside it.' }),
  S({ id: 'jp-2', country: 'jp', slot: 2, name: '정숙 잠수전대', base: '잠수함', effect: '들키는 거리 줄어듦 · 숨어서 하는 첫 공격 2배', field: { kind: 'submarine', ambush: 2, hidden: true }, art: 'A sleek quiet submarine with a smooth teardrop hull and small pink-tinted sail, almost fully submerged.' }),
  S({ id: 'uk-2', country: 'uk', slot: 2, name: '암호 정보국', base: '해킹부대', effect: '지도 위 전투에서 적 부대 위치가 모두 보임 · 정보 임무 +15%', field: { kind: 'infantry', reveal: true }, art: 'A small grey command truck with many antennas and a satellite dish, two operators with laptops beside it.' }),
  S({ id: 'in-2', country: 'in', slot: 2, name: '고원 사냥헬기', base: '공격헬기', effect: '산·고지에서도 제 힘 · 전차 상대 공격 +30%', field: { kind: 'fighter', vs: { kinds: ['tank', 'artillery'], v: 1.3 }, terrain: { at: ['산'], atk: 1.15 } }, art: 'A tandem-seat attack helicopter with stub wings full of rockets, painted sand and saffron, flying low.' }),
  S({ id: 'kr-2', country: 'kr', slot: 2, name: '흑표 수출 전차', base: '전차', effect: '값 −25%(다른 전차보다 쌈) · 연료·탄약을 덜 씀', cost: { money: 0.75, power: 1.15 }, field: { kind: 'tank', thrift: 0.6 }, art: 'A neat modern main battle tank with clean modular armor blocks and a compact turret, light green camouflage.' }),
  S({ id: 'tr-2', country: 'tr', slot: 2, name: '해협 해안포대', base: '포병', effect: '바다 위 배도 제대로 때림(+100%) · 사거리 +1', field: { kind: 'artillery', seaStrike: 2, range: 1 }, art: 'A truck-mounted coastal gun battery with a long barrel aimed at the sea and a small radar mast.' }),
  S({ id: 'il-2', country: 'il', slot: 2, name: '즉시 동원 예비군', base: '보병', effect: '모집이 아주 빠름(−70%) · 우리 땅을 지킬 때 +40%', cost: { hours: 0.3, money: 1.0 }, field: { kind: 'infantry', homeDef: 0.4 }, art: 'A squad of reservist soldiers in mixed uniforms running out of a small bus, rifles in hand.' }),
  S({ id: 'ir-2', country: 'ir', slot: 2, name: '사막 탄도 여단', base: '미사일', effect: '값 −40% · 사거리 +1 · 대신 정확도 −15%', cost: { money: 0.6, power: 1.1 }, field: { kind: 'artillery', range: 1, atk: 0.85 }, art: 'A desert-camouflage truck launcher carrying one big ballistic missile raised at an angle.' }),
  S({ id: 'ua-2', country: 'ua', slot: 2, name: '국토 방위대', base: '보병', effect: '우리 땅을 지킬 때 +40% · 받는 피해 −15%', field: { kind: 'infantry', homeDef: 0.4, taken: 0.85 }, art: 'A squad of soldiers in trenches with sandbags among wheat stalks, one with a shoulder-launched rocket.' }),
  S({ id: 'kp-2', country: 'kp', slot: 2, name: '갱도 포병', base: '포병', effect: '땅굴에 숨어 받는 피해 −50% · 대신 느림', field: { kind: 'artillery', taken: 0.5, move: 1.3 }, art: 'A heavy artillery gun poking out of a rocky cave mouth with camouflage netting.' }),
  // 11-26 새 나라 5개
  S({ id: 'tw-2', country: 'tw', slot: 2, name: '고슴도치 방공대', base: '방공부대', effect: '휴대 미사일로 상륙 막기 · 우리 땅 지킬 때 +30% · 받는 피해 −20%', field: { kind: 'aa', homeDef: 0.3, taken: 0.8, vs: { kinds: ['fighter', 'drone'], v: 1.2 } }, art: 'A small team of soldiers with shoulder-fired anti-air missiles hiding among coastal rocks and palm trees, a light truck behind them.' }),
  S({ id: 'pl-2', country: 'pl', slot: 2, name: '천둥 로켓 포병단', base: '다연장로켓', effect: '한국산 로켓 · 값 −15% · 사거리 +1 · 공격 +10%', cost: { money: 0.85 }, field: { kind: 'artillery', range: 1, atk: 1.1 }, art: 'A modern eight-wheeled multiple rocket launcher truck with two large rocket pods raised, snowy plain behind.' }),
  S({ id: 'ph-2', country: 'ph', slot: 2, name: '정글 수색대', base: '특수부대', effect: '숲·산에서 공격 +30% · 숨어서 하는 첫 공격 +50%', field: { kind: 'infantry', terrain: { at: ['숲', '산'], atk: 1.3 }, ambush: 1.5 }, art: 'A squad of jungle scouts in leaf-pattern camouflage moving through dense tropical forest with rifles.' }),
  S({ id: 'pk-2', country: 'pk', slot: 2, name: '전략 억지 여단', base: '탄도미사일', effect: '사거리 +2 · 공격 +20% · 대신 값 +35%', cost: { money: 1.35, power: 1.35 }, field: { kind: 'artillery', range: 2, atk: 1.2 }, art: 'A large road-mobile ballistic missile launcher truck with a long missile raised, mountains in the background.' }),
  S({ id: 'sa-2', country: 'sa', slot: 2, name: '사막 방공 방패', base: '장거리 방공', effect: '석유 시설 지키기 · 미사일·드론 요격 +40% · 사거리 +1', field: { kind: 'aa', vs: { kinds: ['fighter', 'drone'], v: 1.4 }, range: 1 }, art: 'A long-range air defense battery with four tall missile launcher boxes and a big radar truck in the desert near oil towers.' }),
  // 11-27 새 나라 18개
  S({ id: 'eg-2', country: 'eg', slot: 2, name: '수에즈 방어 포대', base: '해안 미사일', effect: '바다 위 배를 제대로 때림 · 적 군함 상대 +40%', field: { kind: 'artillery', seaStrike: 2, vs: { kinds: ['destroyer', 'cruiser', 'carrier'], v: 1.4 } }, art: 'A truck-mounted anti-ship missile launcher with box canisters raised beside a wide canal with a container ship passing.' }),
  S({ id: 'ng-2', country: 'ng', slot: 2, name: '서아프리카 평화유지군', base: '보병', effect: '모집이 빠름(−40%) · 받는 피해 −15%', cost: { hours: 0.6 }, field: { kind: 'infantry', taken: 0.85 }, art: 'A squad of peacekeeping soldiers in green camouflage with light-blue helmets beside a white armored car.' }),
  S({ id: 'za-2', country: 'za', slot: 2, name: '희망봉 잠수전대', base: '잠수함', effect: '두 바다를 잇는 길목 지키기 · 숨어서 첫 공격 +50%', field: { kind: 'submarine', hidden: true, ambush: 1.5 }, art: 'A small diesel submarine surfacing in rough sea below a rocky cape headland with a lighthouse.' }),
  S({ id: 'et-2', country: 'et', slot: 2, name: '댐 방공대', base: '장거리 방공', effect: '큰 댐 지키기 · 전투기·드론 요격 +40%', field: { kind: 'aa', vs: { kinds: ['fighter', 'drone'], v: 1.4 } }, art: 'A long-range air defense battery with tall missile tubes and a radar truck on a hill above a huge concrete river dam.' }),
  S({ id: 'dz-2', country: 'dz', slot: 2, name: '사막 장벽 방공', base: '장거리 방공', effect: '사거리 +1 · 전투기 상대 +30%', field: { kind: 'aa', range: 1, vs: { kinds: ['fighter'], v: 1.3 } }, art: 'A long-range surface-to-air missile launcher truck with four tall tubes raised in a rocky desert at sunset.' }),
  S({ id: 'br-2', country: 'br', slot: 2, name: '정글 경공격기 대대', base: '지상 공격기', effect: '값 −20% · 숲 위에서 공격 +25%', cost: { money: 0.8 }, field: { kind: 'fighter', terrain: { at: ['숲'], atk: 1.25 } }, art: 'A pair of single-engine turboprop light attack planes in green camouflage flying low over the Amazon rainforest canopy.' }),
  S({ id: 'ar-2', country: 'ar', slot: 2, name: '파타고니아 산악대', base: '보병', effect: '산·눈에서 공격 +30% · 받는 피해 −10%', field: { kind: 'infantry', terrain: { at: ['산'], atk: 1.3 }, taken: 0.9 }, art: 'A squad of mountain troops in white and grey camouflage climbing a windy snowy Andes ridge with ropes.' }),
  S({ id: 'co-2', country: 'co', slot: 2, name: '강 해병 전대', base: '구축함', effect: '값 −30% · 빠른 배 · 시야 +1', cost: { money: 0.7, power: 1.05 }, field: { kind: 'destroyer', move: 0.75, sight: 1, hp: 0.85 }, art: 'A small fast armored river patrol boat with machine guns speeding along a muddy jungle river.' }),
  S({ id: 've-2', country: 've', slot: 2, name: '장거리 방공 여단', base: '장거리 방공', effect: '러시아제 방공 · 전투기 상대 +40% · 사거리 +1', field: { kind: 'aa', range: 1, vs: { kinds: ['fighter'], v: 1.4 } }, art: 'A big long-range air defense system with four large missile tubes and a tall radar mast near tropical hills.' }),
  S({ id: 'cl-2', country: 'cl', slot: 2, name: '아타카마 사막 기갑대', base: '전차', effect: '사막·평지에서 공격 +20% · 방어 +10%', field: { kind: 'tank', terrain: { at: ['평지'], atk: 1.2 }, def: 1.1 }, art: 'A modern main battle tank in tan camouflage crossing a dry red-brown desert with salt flats and volcanoes behind.' }),
  S({ id: 'au-2', country: 'au', slot: 2, name: '오지 정찰대', base: '특수부대', effect: '시야 +2 · 사막·평지에서 빠름(−25%)', field: { kind: 'infantry', sight: 2, move: 0.75 }, art: 'A long-range patrol team in desert camouflage with a six-wheeled patrol vehicle on red outback sand.' }),
  S({ id: 'ca-2', country: 'ca', slot: 2, name: '북극 순찰함', base: '구축함', effect: '얼음 바다도 감 · 체력 +20% · 시야 +1', field: { kind: 'destroyer', hp: 1.2, sight: 1 }, art: 'A grey ice-strengthened arctic patrol ship with a red-and-white hull stripe pushing through floating sea ice.' }),
  S({ id: 'mx-2', country: 'mx', slot: 2, name: '해병 강습대', base: '상륙장갑차', effect: '해안에서 공격 +25% · 모집 빠름(−30%)', cost: { hours: 0.7 }, field: { kind: 'infantry', terrain: { at: ['해안'], atk: 1.25 } }, art: 'A squad of marines in blue-grey camouflage jumping off a landing craft onto a tropical beach with palm trees.' }),
  S({ id: 'fr-2', country: 'fr', slot: 2, name: '외인부대', base: '특수부대', effect: '해외 작전에 강함 · 공격 +20% · 받는 피해 −10%', field: { kind: 'infantry', atk: 1.2, taken: 0.9 }, art: 'A squad of legionnaire soldiers in desert camouflage and white kepi caps beside a wheeled armored vehicle.' }),
  S({ id: 'it-2', country: 'it', slot: 2, name: '알피니 산악대', base: '보병', effect: '산에서 공격 +30% · 받는 피해 −10%', field: { kind: 'infantry', terrain: { at: ['산'], atk: 1.3 }, taken: 0.9 }, art: 'A squad of mountain infantry with feathered alpine hats climbing a snowy Alpine ridge with ropes.' }),
  S({ id: 'es-2', country: 'es', slot: 2, name: '지브롤터 해안포대', base: '해안 미사일', effect: '바다 위 배를 제대로 때림 · 사거리 +1', field: { kind: 'artillery', seaStrike: 2, range: 1 }, art: 'A coastal anti-ship missile launcher truck on a rocky cliff overlooking a narrow strait with a big rock across the water.' }),
  S({ id: 'gr-2', country: 'gr', slot: 2, name: '섬 방어 포병', base: '포병', effect: '섬·해안을 지킬 때 +35% · 바다 위 배도 때림', field: { kind: 'artillery', homeDef: 0.35, seaStrike: 1.5 }, art: 'A self-propelled howitzer dug in on a dry rocky Greek island hilltop with whitewashed houses and blue sea behind.' }),
  S({ id: 'fi-2', country: 'fi', slot: 2, name: '숲 포병 여단', base: '포병', effect: '숲에서 숨어 받는 피해 −30% · 사거리 +1', field: { kind: 'artillery', taken: 0.7, range: 1 }, art: 'A towed artillery gun camouflaged with pine branches in a snowy forest, crew in white winter gear.' }),
];

/** ① 지금 특별 병과(world.ts specialUnit)를 지도 위 전투 능력으로 */
const FIRST_FIELD: Record<string, { field: FieldMod; art: string; cost?: SpecialDef['cost'] }> = {
  us: { field: { kind: 'carrier', hp: 1.3, def: 1.2, supply: 1 }, art: 'A huge supercarrier with an angled flight deck, two escort ships tiny beside it, four jets on deck.' },
  cn: { field: { kind: 'infantry', hp: 1.5, regen: 0.008 }, cost: { money: 1.0 }, art: 'A large crowd of infantry soldiers, five soldiers in a tight marching formation with rifles and full packs, no banners.' },
  ru: { field: { kind: 'artillery', range: 2, atk: 1.1 }, art: 'A large eight-wheeled missile launcher truck carrying a long strategic missile tube raised high.' },
  de: { field: { kind: 'tank', def: 1.2, atk: 1.1, move: 0.85 }, art: 'A heavy angular tank with thick sloped steel armor and a long gun, dark grey.' },
  jp: { field: { kind: 'destroyer', vs: { kinds: ['fighter', 'drone'], v: 1.4 } }, art: 'A destroyer with a big flat radar panel on its tower and many missile hatches, light grey.' },
  uk: { field: { kind: 'infantry', ambush: 1.6, hidden: true }, art: 'A small team of special forces soldiers in dark grey with parachutes folded, crouching in fog.' },
  in: { field: { kind: 'infantry', terrain: { at: ['산', '숲'], atk: 1.3 } }, art: 'A squad of mountain infantry with climbing ropes and heavy packs on a rocky slope.' },
  kr: { field: { kind: 'artillery', atk: 1.15, move: 0.8 }, art: 'A tracked self-propelled howitzer with a long barrel, compact turret and ammo carrier behind.' },
  tr: { field: { kind: 'drone', atk: 1.4, hp: 1.2 }, cost: { money: 0.6 }, art: 'A medium armed drone with long straight wings and two small missiles under the wings.' },
  il: { field: { kind: 'aa', vs: { kinds: ['fighter', 'drone'], v: 1.5 }, range: 1 }, art: 'A missile defense battery with three launcher boxes and a tall rotating radar, desert sand color.' },
  ir: { field: { kind: 'destroyer', vs: { kinds: ['destroyer', 'cruiser', 'carrier'], v: 1.3 }, move: 0.7, hp: 0.8 }, cost: { money: 0.8 }, art: 'A swarm of three small fast attack boats with machine guns, white wakes behind them.' },
  ua: { field: { kind: 'drone', vs: { kinds: ['destroyer', 'cruiser', 'carrier', 'submarine'], v: 1.8 } }, art: 'A small black explosive sea drone boat skimming the waves with a camera mast.' },
  kp: { field: { kind: 'infantry', ambush: 1.5, terrain: { at: ['산'], atk: 1.2 } }, art: 'A squad of commandos emerging from a tunnel hatch in the ground at night.' },
  tw: { field: { kind: 'artillery', seaStrike: 2, vs: { kinds: ['destroyer', 'cruiser', 'carrier'], v: 1.5 } }, art: 'A truck-mounted anti-ship missile launcher with four box canisters raised toward the sea on a rocky coast.' },
  pl: { field: { kind: 'tank', def: 1.2, homeDef: 0.25 }, art: 'A modern main battle tank with a white eagle emblem on the turret side, grey-green camouflage, on a flat field.' },
  ph: { field: { kind: 'destroyer', move: 0.8, sight: 1, hp: 0.9 }, cost: { money: 0.7, power: 1.1 }, art: 'A white coast guard patrol ship with a blue stripe on the hull and a small gun on the bow, fast wake behind.' },
  pk: { field: { kind: 'infantry', terrain: { at: ['산'], atk: 1.25 }, taken: 0.9 }, art: 'A squad of mountain infantry in grey-green uniforms climbing a snowy rocky ridge with ropes.' },
  sa: { field: { kind: 'fighter', atk: 1.2, hp: 1.2 }, cost: { money: 1.5, power: 1.4 }, art: 'A pair of twin-engine multirole fighter jets in desert-sand camouflage flying low over dunes.' },
  // 11-27 새 나라 18개
  eg: { field: { kind: 'tank', terrain: { at: ['평지'], atk: 1.2 }, hp: 1.15 }, art: 'A heavy main battle tank in desert-sand paint with a wide turret, kicking up dust on a flat desert near distant pyramids shapes.' },
  ng: { field: { kind: 'infantry', terrain: { at: ['해안'], atk: 1.3 }, ambush: 1.3 }, art: 'A squad of special forces in green-brown camouflage riding a fast rigid inflatable boat through a mangrove river delta.' },
  za: { field: { kind: 'fighter', vs: { kinds: ['tank', 'artillery'], v: 1.3 }, hp: 1.1 }, art: 'A slim tandem-seat attack helicopter with stub wings full of rockets, painted olive drab, flying low over golden savanna.' },
  et: { field: { kind: 'infantry', terrain: { at: ['산'], atk: 1.3 }, taken: 0.9 }, art: 'A squad of highland infantry in green camouflage climbing a steep rocky mountain path with rifles, misty peaks behind.' },
  dz: { field: { kind: 'infantry', move: 0.75, sight: 1 }, art: 'A column of fast desert armored jeeps with mounted guns racing across Sahara sand dunes, dust trailing.' },
  br: { field: { kind: 'infantry', terrain: { at: ['숲'], atk: 1.35 }, ambush: 1.3 }, art: 'A squad of jungle soldiers in leaf-pattern camouflage wading through dense Amazon rainforest with rifles and machetes.' },
  ar: { field: { kind: 'tank', terrain: { at: ['평지'], atk: 1.2 }, move: 0.85 }, art: 'A medium tank in olive and tan camouflage racing across a wide flat grassland plain under a big sky.' },
  co: { field: { kind: 'infantry', terrain: { at: ['숲', '산'], atk: 1.3 }, ambush: 1.4 }, art: 'A squad of commandos in dark jungle camouflage with face paint moving through misty mountain forest.' },
  ve: { field: { kind: 'infantry', atk: 0.9 }, cost: { money: 0.65, hours: 0.6, power: 1.0 }, art: 'A crowd of militia volunteers in mixed red caps and plain uniforms with old rifles beside a pickup truck near oil derricks.' },
  cl: { field: { kind: 'submarine', hidden: true, ambush: 1.6 }, art: 'A compact diesel attack submarine surfacing in a dark fjord with steep snowy cliffs behind.' },
  au: { field: { kind: 'submarine', hp: 1.3, atk: 1.2, hidden: true }, cost: { money: 1.4, power: 1.35 }, art: 'A large sleek attack submarine surfacing in deep blue ocean, a tall sail with a small southern cross emblem shape.' },
  ca: { field: { kind: 'infantry', terrain: { at: ['숲', '산'], atk: 1.2 }, taken: 0.85 }, art: 'A team of arctic rangers in white winter camouflage on snowmobiles crossing a frozen tundra with rifles.' },
  mx: { field: { kind: 'infantry', homeDef: 0.35 }, cost: { money: 0.85 }, art: 'A squad of national guard soldiers in tan uniforms beside an armored pickup truck at a highway checkpoint.' },
  fr: { field: { kind: 'fighter', atk: 1.25, hp: 1.1 }, cost: { money: 1.4, power: 1.35 }, art: 'A pair of delta-wing twin-engine multirole fighter jets with canards in grey paint, flying over clouds.' },
  it: { field: { kind: 'carrier', hp: 1.1 }, cost: { money: 0.9 }, art: 'A medium aircraft carrier with a ski-jump bow ramp and a few jets on deck, cruising a calm blue sea.' },
  es: { field: { kind: 'infantry', terrain: { at: ['해안'], atk: 1.3 }, hp: 1.1 }, art: 'An eight-wheeled amphibious armored vehicle driving out of the surf onto a sandy beach with marines beside it.' },
  gr: { field: { kind: 'destroyer', move: 0.7 }, cost: { money: 0.75, power: 1.1 }, art: 'A fast missile patrol boat with a sharp bow and missile canisters racing between small white islands.' },
  fi: { field: { kind: 'infantry', terrain: { at: ['숲', '산'], atk: 1.35 }, ambush: 1.5 }, art: 'A pair of snipers in white snow camouflage on skis in a snowy pine forest, rifles slung.' },
};

export const SPECIALS: SpecialDef[] = [
  ...COUNTRIES.map((c): SpecialDef => {
    const f = FIRST_FIELD[c.id];
    return { id: `${c.id}-1`, country: c.id, slot: 1, name: c.specialUnit.name, base: c.specialUnit.base, effect: c.specialUnit.effect, cost: f.cost, field: f.field, art: f.art };
  }),
  ...SECOND,
];
const byId = new Map(SPECIALS.map((d) => [d.id, d]));
export const specialById = (id: string) => byId.get(id);
export const specialsOf = (country: string) => SPECIALS.filter((d) => d.country === country);
/** 그 나라이 이 병과의 특화 유닛을 가졌나 */
export const specialsFor = (country: string, base: string) => SPECIALS.filter((d) => d.country === country && d.base === base);
/** 지도 위 전투 말 종류 → 그 나라 특화 유닛 */
export const specialsByKind = (country: string, kind: FKind) => SPECIALS.filter((d) => d.country === country && d.field.kind === kind);

/** 독점 병과: 몇 나라만 만듦 */
export interface ExclusiveDef {
  name: string;
  only: string[];
  why: string;
  /** 지도 위 전투에서 */
  field: FieldMod;
  art: string;
  key: string;
}
export const EXCLUSIVES: ExclusiveDef[] = [
  {
    name: '강습상륙함',
    key: 'lhd',
    only: ['us', 'jp', 'kr'],
    why: '섬과 섬 사이 상륙전을 가장 먼저 익힌 태평양 연합 나라',
    field: { kind: 'destroyer', hp: 1.4, atk: 0.5, supply: 1, extraInfantry: 2 },
    art: 'A large amphibious assault ship with a flat deck, a well dock open at the stern and two landing craft beside it.',
  },
  {
    name: '원자력 잠수함',
    key: 'ssn',
    only: ['us', 'ru', 'cn', 'uk', 'in', 'fr'],
    why: '원자로 기술과 우라늄을 가진 큰 나라',
    field: { kind: 'submarine', hp: 1.4, atk: 1.25, hidden: true, move: 0.8, sight: 1 },
    art: 'A very long nuclear submarine with a tall sail and a faint glow near the stern, surfacing.',
  },
  {
    name: '레이저 방공함',
    key: 'ward',
    only: ['us', 'il', 'tr', 'ir'],
    why: '레이저·다층 방공 기술을 가진 나라',
    field: { kind: 'destroyer', hp: 1.2, def: 1.3, shield: { r: 2, v: 0.7 } },
    art: 'A futuristic warship with glowing blue crystal pylons on its deck projecting a faint dome-shaped shield.',
  },
];
export const exclusiveByName = (n: string) => EXCLUSIVES.find((x) => x.name === n);
/** 이 나라가 그 독점 병과를 만들 수 있나(독점 병과가 아니면 null = 누구나) */
export function exclusiveLock(country: string, unit: string): string | null {
  const x = exclusiveByName(unit);
  if (!x || x.only.includes(country)) return null;
  return `${x.only.map((id) => countryById(id).name).join('·')} 전용`;
}
