// 11-26 파병 전장(대장 요청 "파병 중 이벤트 전투 · 공중전·해상전·육상전과 그 조합 · 전장을 많이").
// 파병 이벤트 전투(data/deployOps.ts)가 고르는 큰 3D 전장 20곳. 일부(방어·호송·구출)는 본국 임무에도 돌아가며 쓴다.
import { BIG, HUGE, grid, makeField, squad } from './fields';
import type { Kind, Stage } from './sim';

export const LAND: Kind[] = ['inf', 'sf', 'ifv', 'hack', 'tank', 'spg', 'aa', 'aav', 'mlrs', 'bm', 'sam', 'csm', 'eng', 'hgv', 'cuas', 'ugv', 'marine'];
export const SEA: Kind[] = ['dd', 'cv', 'sub', 'lha', 'ssn', 'laser', 'usv', 'mlay'];
export const AIR: Kind[] = ['drone', 'heli', 'jet', 'bomber', 'missile', 'uav', 'f35', 'awacs', 'gunship', 'mpa', 'ewa', 'swarm', 'tanker'];

/** ① 인도양 해적 소굴: 온통 바다, 무장 고속정 떼 · 모선 */
export const PIRATES = makeField({
  id: 'pirates', name: '인도양 해적 소굴', op: 'BLUEWATER-31', goal: '목표: 해적선 모두 소탕', theme: 'ocean', win: 'all', sea: 'all', kinds: [...SEA, ...AIR], budget: 440,
  desc: '끝없는 인도양 한가운데예요. 무장 고속정 떼가 흩어져 있고 뒤쪽에 해적 모선이 있어요. 모두 소탕하면 이겨요.',
  enemy: [...squad([['boat', 6]], -7, -6, 1.6), ...squad([['boat', 6]], 7, -8, 1.6), ...squad([['boat', 3], ['dd', 1], ['lha', 1]], 0, -16, 2)],
  timed: [{ at: 50, list: squad([['boat', 5]], -13, -20, 1.5), msg: '서쪽에서 고속정이 더 몰려와요' }, { at: 110, list: [...squad([['boat', 4]], 13, -20, 1.5), ['sub', 0, -20]], msg: '해적이 빼앗은 잠수정까지 나왔어요' }],
  deploy: [['dd', -5, 17], ['dd', 0, 17], ['dd', 5, 17], ['laser', -2.5, 18.4], ['sub', 2.5, 18.4], ['heli', -7, 18.4], ['heli', 7, 18.4], ['drone', 0, 19.8], ['drone', 3, 19.8]],
});

/** ② 아덴만 상선 호위: 상선 2척을 북쪽 항로 끝까지 */
export const CONVOY_SEA = makeField({
  id: 'convoysea', name: '아덴만 상선 호위', op: 'SAFEPASSAGE-12', goal: '목표: 상선 2척을 북쪽 항로 끝까지', theme: 'ocean', win: 'escort', sea: 'all', kinds: [...SEA, ...AIR], budget: 420, timeLimit: 330,
  desc: '상선 2척이 아덴만을 지나요. 해적 고속정과 잠수정이 양옆에서 덮쳐요. 상선이 한 척이라도 가라앉으면 져요.',
  allies: [['cargo', -2, 13], ['cargo', 2, 14.6]], allyGoal: { x: 0, z: -18 },
  enemy: [...squad([['boat', 4]], -11, -2, 1.5), ...squad([['boat', 4]], 11, -6, 1.5), ['sub', -6, -12], ['boat', 6, -14], ['boat', -3, -15]],
  timed: [{ at: 35, list: squad([['boat', 4]], -14, 6, 1.4), msg: '서쪽에서 고속정이 상선을 노려요' }, { at: 90, list: squad([['boat', 4], ['sub', 1]], 14, -2, 1.4), msg: '동쪽에서 해적 떼가 다가와요' }, { at: 160, list: squad([['boat', 5], ['dd', 1]], 0, -22, 1.5), msg: '항로 끝에서 해적 모선이 길을 막아요' }],
});

/** ③ 호르무즈 해협 잠수함 사냥: 좁은 해협, 양쪽은 땅(사막 해안) */
export const STRAIT_SUB = makeField({
  id: 'hormuz', name: '호르무즈 해협', op: 'NARROWS-08', goal: '목표: 숨은 잠수함·고속정 모두 격침', theme: 'desert', win: 'all', sea: 'left', seaAt: 6, kinds: [...SEA, ...AIR], budget: 440,
  desc: '사막 해안을 낀 좁은 해협이에요. 적 잠수함이 물속에 숨어 있고 해안 쪽에서 고속정이 튀어나와요.',
  enemy: [...squad([['sub', 3]], -4, -8, 2.2), ['ssn', 0, -17], ...squad([['boat', 5]], 2, -4, 1.4), ['dd', -6, -15], ['dd', 3, -18]],
  timed: [{ at: 45, list: [['sub', -9, -21], ['boat', 3, -21], ['boat', 1, -21]], msg: '해협 깊은 곳에서 잠수함이 더 올라와요' }, { at: 100, list: [['dd', -4, -21], ['ssn', -10, -20], ['boat', 4, -20], ['boat', 2, -20]], msg: '적 호위함과 핵잠수함이 들어와요' }],
  deploy: [['dd', -6, 17], ['dd', -2, 17], ['dd', 2, 17], ['sub', -4, 18.4], ['laser', 0, 18.4], ['heli', 4, 18.4], ['heli', 8, 17], ['drone', 6, 19.8]],
});

/** ④ 해상 영공 초계: 바다 위 하늘에서 유조선단을 노리는 적 폭격기를 막음(공중전) */
export const SKY_SEA = makeField({
  id: 'skysea', name: '해상 영공 초계', op: 'SKYWALL-22', goal: '목표: 3분 동안 유조선 지키기', theme: 'ocean', win: 'survive', sea: 'all', kinds: AIR, budget: 400, timeLimit: 180,
  desc: '바다 위 하늘에서 싸우는 공중전이에요. 적 전투기와 폭격기가 아래 유조선을 노려요. 3분 동안 지키면 이겨요.',
  allies: [['cargo', -3, 6], ['cargo', 3, 8]],
  enemy: [['jet', -6, -14], ['jet', 6, -14], ['jet', 0, -16], ['drone', 0, -12]],
  foeAggr: true,
  timed: [{ at: 15, list: [['bomber', -8, -22], ['jet', -4, -22], ['jet', 4, -22], ['jet', 8, -22]] }, { at: 60, list: [['bomber', 8, -22], ['bomber', 0, -23], ['jet', -8, -22], ['jet', -12, -22], ['drone', 2, -22], ['drone', -2, -22]] },
    { at: 110, list: [['bomber', -6, -23], ['bomber', 6, -23], ['jet', 0, -22], ['jet', 10, -22], ['jet', -10, -22]], msg: '적 폭격기 편대가 마지막으로 몰려와요' }],
  deploy: [['jet', -6, 17], ['jet', -2, 17], ['jet', 2, 17], ['jet', 6, 17], ['heli', 0, 18.4], ['drone', -4, 18.4], ['drone', 4, 18.4]],
});

/** ⑤ 동유럽 국경 방어: 눈 내린 숲, 국경 초소를 4분 지킴 */
export const BORDER = makeField({
  id: 'border', name: '동유럽 국경 초소', op: 'EASTWALL-19', goal: '목표: 4분 동안 국경 초소 지키기', theme: 'snow', win: 'survive', timeLimit: 240, kinds: [...LAND, ...AIR], budget: 440,
  desc: '눈 내린 국경 숲이에요. 국경 너머에서 무장 세력이 네 차례 넘어와요. 초소가 무너지면 져요.',
  allies: [['vip', 0, 12.4]], woods: [[-8, 0, 3], [8, -2, 3], [-10, -12, 2.4], [10, -13, 2.4], [0, -6, 1.8]],
  roads: [[[0, 19], [0, -21]]],
  enemy: [...squad([['inf', 3], ['tech', 2]], -5, -14), ...squad([['inf', 3], ['tech', 2]], 5, -14)],
  timed: [{ at: 25, list: squad([['inf', 4], ['tech', 2], ['tank', 1]], -8, -20) }, { at: 80, list: squad([['tank', 2], ['ifv', 2], ['inf', 3]], 8, -20) },
    { at: 140, list: [...squad([['inf', 3], ['tank', 2]], 0, -20), ['heli', -4, -21], ['drone', 4, -21]] }, { at: 195, list: [...squad([['tank', 2], ['sf', 2]], -9, -20), ...squad([['tank', 2], ['tech', 2]], 9, -20)], msg: '국경 너머에서 마지막 공세!' }],
});

/** ⑥ 사헬 반군 소탕: 사막 반군 거점(무장 트럭 많음) */
export const SAHEL = makeField({
  id: 'sahel', name: '사헬 반군 거점', op: 'DUSTDEVIL-05', goal: '목표: 반군 지휘 천막 파괴 → 남은 반군 소탕', theme: 'desert', win: 'hqwaves', kinds: [...LAND, ...AIR], budget: 440,
  desc: '사하라 남쪽 사헬 사막이에요. 반군이 무장 트럭을 타고 빠르게 움직여요. 지휘 천막을 부수면 남은 반군이 몰려와요.',
  hills: [[-8, -6, 3, .6], [9, 2, 3, .5], [2, -15, 3, .4]], rough: .6,
  blocks: grid([[-4, -2], [3, 5]], [[-19, -17.5]], [], .7),
  enemy: [['hq', 0, -16], ...squad([['tech', 5], ['inf', 3]], -6, -6, 1.3), ...squad([['tech', 5], ['inf', 2]], 6, -8, 1.3), ...squad([['inf', 4], ['tech', 2], ['aa', 1]], 0, -12)],
  timed: [{ at: 45, list: squad([['tech', 5]], 13, -4, 1.3), msg: '동쪽 모래 언덕 너머에서 트럭 떼가 와요' }],
  waves: [[...squad([['tech', 4], ['inf', 2]], -12, -20), ...squad([['tech', 4], ['inf', 2]], 12, -20)]],
});

/** ⑦ 해적 해안 기지: 해안 절벽 위 해적 기지(해상-육상전) */
export const PIRATE_BASE = makeField({
  id: 'piratebase', name: '해적 해안 기지', op: 'SKULLBAY-14', goal: '목표: 해안 해적 기지 파괴', theme: 'dusk', win: 'hqwaves', sea: 'left', seaAt: -2, budget: 480,
  desc: '해적 소굴이 된 해안 마을이에요. 바다에는 고속정, 땅에는 무장 트럭과 해적들이 있어요. 배로 두드리고 땅으로 올라가 기지를 부숴요.',
  blocks: grid([[2, 4], [6, 8.5]], [[-16, -14], [-11, -9]], [], .8),
  woods: [[10, -2, 2.2], [9, 8, 2], [11, -16, 1.8]],
  enemy: [['hq', 5, -18], ...squad([['inf', 4], ['tech', 3]], 4, -6, 1.2), ...squad([['inf', 3], ['tech', 2], ['aa', 1]], 9, -12),
    ...squad([['boat', 6]], -8, -8, 1.5), ['boat', -9, 2], ['boat', -7, 4], ['dd', -10, -16]],
  timed: [{ at: 45, list: squad([['boat', 4]], -12, -21, 1.4), msg: '항구에서 고속정이 더 나와요' }, { at: 100, list: squad([['tech', 4], ['inf', 2]], 13, -4, 1.3), msg: '마을 뒤편에서 해적 트럭이 몰려와요' }],
  waves: [[...squad([['inf', 3], ['tech', 3]], 10, -20), ['boat', -9, -20], ['boat', -11, -20]]],
});

/** ⑧ 항모 전단 결전: 바다 위 적 항모 전단(해상-공중전) */
export const CARRIER = makeField({
  id: 'carrier', name: '항모 전단 결전', op: 'TRIDENT-40', goal: '목표: 적 항모 전단 모두 격침', theme: 'ocean', win: 'all', sea: 'all', field: HUGE, kinds: [...SEA, ...AIR], budget: 560,
  desc: '넓은 바다에서 적 항모 전단과 맞붙어요. 적 함재기가 계속 떠오르고 구축함이 항모를 지켜요. 배와 비행기를 함께 써요.',
  enemy: [['cv', 0, -19], ...squad([['dd', 3], ['laser', 1]], 0, -13, 2.4), ['sub', -8, -8], ['sub', 8, -8], ['jet', -5, -18], ['jet', 5, -18], ['jet', 0, -21], ['heli', -9, -15], ['heli', 9, -15]],
  timed: [{ at: 50, list: [['jet', -14, -23], ['jet', 14, -23], ['bomber', 0, -23]], msg: '적 함재기 편대가 더 떠올라요' }, { at: 110, list: [['cv', -12, -23], ['dd', -8, -23], ['dd', -15, -21], ['laser', -10, -21]], msg: '적 2항모 전단이 서쪽에서 들어와요' }],
  deploy: [['cv', 0, 20.6], ['dd', -6, 18], ['dd', -3, 18], ['dd', 3, 18], ['dd', 6, 18], ['laser', 0, 18], ['sub', -8, 19.4], ['jet', -4, 19.4], ['jet', 4, 19.4], ['jet', 8, 19.4], ['missile', -10, 18]],
});

/** ⑨ 계곡 근접 항공 지원: 계곡 길을 지나는 평화유지군 차량을 하늘·땅에서 지킴(육상-공중전) */
export const CAS = makeField({
  id: 'cas', name: '계곡 근접 지원', op: 'GUARDIAN-16', goal: '목표: 평화유지군 차량 2대를 계곡 끝까지', theme: 'rock', win: 'escort', timeLimit: 330, kinds: [...LAND, ...AIR], budget: 440,
  desc: '붉은 바위 계곡 사이 길이에요. 평화유지군 차량이 계곡 끝 기지까지 가요. 절벽 위 방공포와 매복을 하늘과 땅에서 치워요.',
  hills: [[-12, -4, 4, 1.6], [12, -4, 4, 1.6], [-11, 12, 3, 1], [11, 12, 3, 1]], rough: 1.2,
  allies: [['vip', -1, 14], ['vip', 1, 15.4]], allyGoal: { x: 0, z: -18 }, roads: [[[0, 19], [0, -20]]],
  enemy: [...squad([['aa', 2], ['inf', 2]], -8, -2), ...squad([['aa', 2], ['inf', 2]], 8, -8), ...squad([['tech', 3], ['tank', 1]], -6, -12), ...squad([['tank', 2], ['spg', 2]], 6, -17), ['heli', 0, -20]],
  timed: [{ at: 60, list: squad([['tech', 4], ['inf', 2]], 13, 2), msg: '동쪽 절벽에서 매복이 튀어나와요' }, { at: 140, list: squad([['tech', 3], ['tank', 2]], -13, -14), msg: '서쪽 절벽 길로 적 전차가 내려와요' }],
});

/** ⑩ 북극해 초계: 얼음 바다, 잠수함과 구축함 */
export const ARCTIC_SEA = makeField({
  id: 'arcticsea', name: '북극해 초계', op: 'ICEFIELD-03', goal: '목표: 침입한 함대 모두 격침', theme: 'arctic', win: 'all', sea: 'left', seaAt: 11, kinds: [...SEA, ...AIR], budget: 460,
  desc: '얼음이 떠다니는 북극해예요. 오른쪽은 눈 덮인 섬이에요. 침입한 잠수함·구축함을 모두 쫓아내요.',
  hills: [[14, -6, 4, 1.4], [14, 8, 3, 1]],
  enemy: [...squad([['sub', 2], ['ssn', 1]], -6, -10, 2.4), ...squad([['dd', 3], ['laser', 1]], 2, -15, 2.4), ['lha', -2, -19], ['heli', 0, -20], ['jet', 4, -21]],
  timed: [{ at: 80, list: [['dd', -12, -22], ['sub', -8, -22], ['dd', 6, -22]], msg: '얼음 너머에서 적 함대가 더 와요' }],
  deploy: [['dd', -8, 17], ['dd', -4, 17], ['dd', 0, 17], ['sub', -6, 18.4], ['sub', 2, 18.4], ['laser', -2, 18.4], ['heli', 4, 17], ['jet', 6, 18.4]],
});

/** ⑪ 지중해 난민선 구조: 밤바다, 난민선 2척을 항구까지(밀수 조직 방해) */
export const REFUGEE = makeField({
  id: 'refugee', name: '지중해 밤바다 구조', op: 'LIFEBOAT-09', goal: '목표: 난민선 2척을 남쪽 항구까지', theme: 'night', win: 'escort', sea: 'all', kinds: [...SEA, ...AIR], budget: 400, timeLimit: 330,
  desc: '깜깜한 지중해 밤바다예요. 밀수 조직이 난민선을 붙잡으려 해요. 난민선 2척을 우리 쪽(남쪽) 항구까지 데려와요.',
  allies: [['cargo', -2, -12], ['cargo', 2, -13.6]], allyGoal: { x: 0, z: 17 },
  enemy: [...squad([['boat', 3]], -13, -8, 1.4), ...squad([['boat', 3]], 13, -10, 1.4), ['boat', 0, -21], ['boat', -3, -21]],
  timed: [{ at: 40, list: squad([['boat', 4]], -14, -4, 1.4), msg: '밀수선이 옆에서 따라붙어요' }, { at: 110, list: squad([['boat', 4], ['sub', 1]], 14, 4, 1.4), msg: '밀수 조직 잠수정이 나타났어요' }],
});

/** ⑫ 산호섬 기지 탈환: 우리는 바다, 섬 해안에 적 기지(상륙) */
export const ISLAND = makeField({
  id: 'island', name: '산호섬 기지 탈환', op: 'CORALREEF-11', goal: '목표: 섬 기지 지휘소 파괴', theme: 'jungle', win: 'hq', sea: 'amph', seaAt: -3.5, budget: 480, timeLimit: 360,
  desc: '남태평양 산호섬이에요. 우리 배는 아래쪽 바다에, 무장 세력 기지는 섬 위 밀림에 있어요. 상륙해 지휘소를 부숴요.',
  woods: [[6, -10, 2.6], [-3, -17, 2.4], [10, -18, 2], [2, -3, 1.6]], hills: [[4, -16, 4, .9]],
  enemy: [['hq', 4, -16], ...squad([['inf', 4], ['tech', 2]], 6, -4), ...squad([['inf', 3], ['aa', 2], ['spg', 1]], 0, -10), ...squad([['tank', 2], ['inf', 3]], 6, -14),
    ['boat', -8, 2], ['boat', -6, 6], ['boat', -10, 8], ['dd', -12, 4]],
  timed: [{ at: 60, list: squad([['inf', 3], ['tech', 2]], 12, -21), msg: '섬 뒤편에서 무장 세력이 더 와요' }],
});

/** ⑬ 대사관 철수: 좁은 도시, 대사관 차량을 남쪽 공항 길까지(구출) */
export const EMBASSY = makeField({
  id: 'embassy', name: '대사관 철수', op: 'EVAC-07', goal: '목표: 대사관 차량을 남쪽 집결지까지', theme: 'green', win: 'escort', urban: true, timeLimit: 330, kinds: [...LAND, 'drone', 'heli', 'jet'], budget: 420,
  desc: '폭동이 난 도시 한가운데 대사관이 있어요. 길목의 무장 세력을 치우면 대사관 차량이 남쪽 집결지로 빠져나와요.',
  blocks: grid([[-14, -8.5], [-6.5, -1.6], [1.6, 6.5], [8.5, 14]], [[-21, -16], [-14, -8.5], [-6.5, -1.5], [.5, 6]], [[1, 1], [2, 1]], 1.2),
  allies: [['vip', 0, -11]], allyGoal: { x: 0, z: 15 },
  enemy: [...squad([['inf', 3], ['tech', 2]], 0, -5.6, 1), ...squad([['inf', 3], ['tech', 1]], -7.5, -.4, 1), ...squad([['inf', 3], ['tech', 1]], 7.5, -.4, 1), ...squad([['inf', 2], ['aa', 1], ['tank', 1]], 0, 7.4, 1), ['inf', -3, -15], ['inf', 3, -15]],
  timed: [{ at: 70, list: [['tech', -12, -7.5], ['tech', -11, -7.5], ['inf', -13, -7.5]], msg: '서쪽 골목에서 폭도가 몰려와요' }, { at: 150, list: [['tech', 12, -7.5], ['tank', 11, -7.5], ['inf', 13, -7.5]], msg: '동쪽 골목에서 무장 차량이 와요' }],
  setup: (S) => { for (const u of S.units) if (u.d.ally) { u.waitT = 1e9; u.hidden = true; } },
  tick: (S) => {
    const a = S.units.find((u) => u.d.ally && u.alive && u.waitT);
    if (!a || (S.simT * 20 | 0) % 10) return;
    if (!S.units.some((u) => u.alive && u.side === 'foe' && Math.hypot(u.x - a.x, u.z - a.z) < 7)) { a.waitT = 0; a.hidden = false; S.hooks.log?.('대사관 길이 열렸어요! 차량이 빠져나와요', 'k'); }
  },
});

/** ⑭ 사막 유전 방어: 유전 시설을 4분 지킴 */
export const OASIS = makeField({
  id: 'oasis', name: '사막 유전 방어', op: 'OILWELL-25', goal: '목표: 4분 동안 유전 지키기', theme: 'desert', win: 'survive', timeLimit: 240, budget: 480,
  desc: '오아시스 옆 유전이에요. 무장 세력이 사방에서 몰려와요. 유전 통제 차량이 무너지면 져요. 4분을 버티세요.',
  hills: [[-10, -10, 3.5, .7], [10, -6, 3.5, .6], [0, -18, 3, .5]], rough: .6,
  allies: [['vip', 0, 8]], blocks: grid([[-3.5, -1.5], [1.5, 3.5]], [[9.6, 11]], [], .6),
  enemy: [...squad([['tech', 3], ['inf', 2]], -6, -10), ...squad([['tech', 3], ['inf', 2]], 6, -10)],
  timed: [{ at: 20, list: squad([['tech', 5], ['inf', 2]], -12, -20, 1.3) }, { at: 70, list: squad([['tech', 4], ['tank', 2], ['inf', 2]], 12, -20, 1.3) },
    { at: 125, list: [...squad([['tank', 3], ['tech', 3]], 0, -21), ['heli', -5, -21], ['drone', 5, -21]] }, { at: 185, list: [...squad([['tech', 4], ['tank', 1]], -13, -2), ...squad([['tech', 4], ['tank', 1]], 13, -2)], msg: '양옆에서 마지막 돌격!' }],
});

/** ⑮ 다리 사수: 강 위 다리 하나를 4분 지킴 */
export const BRIDGEHOLD = makeField({
  id: 'bridgehold', name: '다리 사수', op: 'IRONBRIDGE-13', goal: '목표: 4분 동안 다리 건너 진지 지키기', theme: 'green', win: 'survive', timeLimit: 240, budget: 500,
  desc: '넓은 강 위 다리 하나가 생명줄이에요. 적이 다리를 건너 우리 진지로 밀고 와요. 진지 차량이 무너지면 져요.',
  river: { z: -2, amp: .5, bridges: [0] }, woods: [[-9, -10, 3], [9, -12, 3], [-10, 6, 2.4], [10, 7, 2.4]],
  allies: [['vip', 0, 9]], roads: [[[0, 19], [0, -21]]],
  enemy: [...squad([['inf', 3], ['tank', 1]], -4, -10), ...squad([['inf', 3], ['ifv', 1]], 4, -10), ['spg', -6, -18], ['spg', 6, -18]],
  timed: [{ at: 25, list: squad([['tank', 2], ['ifv', 2], ['inf', 3]], 0, -20) }, { at: 85, list: squad([['tank', 3], ['inf', 3], ['heli', 1]], -6, -21) },
    { at: 145, list: squad([['tank', 3], ['ifv', 2], ['inf', 2]], 6, -21) }, { at: 195, list: [...squad([['tank', 3], ['sf', 2]], 0, -21), ['jet', -4, -21], ['drone', 4, -21]], msg: '마지막으로 다리를 향해 총공격!' }],
});

/** ⑯ 눈 덮인 산길 호송: 바위 사이 산길로 보급 차량 2대 */
export const MOUNTAIN_PASS = makeField({
  id: 'mountainpass', name: '눈 덮인 산길 호송', op: 'HIGHPASS-20', goal: '목표: 보급 차량 2대를 고개 너머까지', theme: 'snow', win: 'escort', timeLimit: 330, budget: 480,
  desc: '눈 덮인 바위산 사이 고갯길이에요. 보급 차량 2대가 고개 너머 마을까지 가야 해요. 바위 뒤에 매복이 있어요.',
  blocks: [...grid([[-14, -4], [4, 14]], [[-6, 2]], [], 1.3, true), ...grid([[-14, -6], [6, 14]], [[-16, -11]], [], 1.3, true)],
  hills: [[-11, -2, 4, 1.4], [11, -2, 4, 1.4], [-12, -14, 3, 1.2], [12, -14, 3, 1.2]],
  allies: [['vip', -1, 14], ['vip', 1, 15.4]], allyGoal: { x: 0, z: -19 }, roads: [[[0, 19], [0, -21]]],
  enemy: [...squad([['inf', 3], ['tech', 1]], 0, 6), ...squad([['inf', 3], ['tank', 1], ['aa', 1]], 0, -8.5), ...squad([['tank', 2], ['inf', 2], ['spg', 1]], 0, -18), ['heli', -4, -20]],
  timed: [{ at: 70, list: squad([['inf', 3], ['sf', 2]], -12, 8), msg: '서쪽 눈밭에서 매복이 나타났어요' }, { at: 150, list: squad([['tech', 3], ['tank', 1]], 12, -8.5), msg: '동쪽 고개에서 적이 길을 막아요' }],
});

/** ⑰ 밀림 마약 조직: 강을 낀 밀림 속 조직 기지(육상-공중전) */
export const CARTEL = makeField({
  id: 'cartel', name: '밀림 마약 조직', op: 'CANOPY-27', goal: '목표: 조직 본부 파괴 → 남은 조직원 소탕', theme: 'jungle', win: 'hqwaves', kinds: [...LAND, ...AIR], budget: 460,
  desc: '빽빽한 밀림과 갈색 강이 흐르는 곳이에요. 마약 조직 본부가 강 건너에 있어요. 헬기와 지상군으로 함께 쳐요.',
  river: { z: -4, amp: 1.1, bridges: [-7, 6] },
  woods: [[-10, 4, 3], [10, 5, 3], [-6, -12, 2.6], [7, -14, 2.6], [0, 8, 1.8], [-12, -18, 2.2], [12, -19, 2.2]],
  enemy: [['hq', 0, -16], ...squad([['inf', 4], ['tech', 2]], -7, -8), ...squad([['inf', 4], ['tech', 2]], 6, -9), ...squad([['inf', 3], ['aa', 2], ['tech', 2]], 0, -13), ['heli', -3, -19]],
  timed: [{ at: 45, list: squad([['inf', 4], ['tech', 2]], 13, -14), msg: '밀림 속 비밀 통로에서 조직원이 나와요' }, { at: 95, list: squad([['inf', 3], ['tech', 2], ['heli', 1]], -13, -12), msg: '서쪽 강가에서 조직 지원대가 와요' }],
  waves: [[...squad([['inf', 4], ['tech', 2]], -12, -20), ...squad([['inf', 3], ['tech', 3]], 12, -20)]],
});

/** ⑱ 산악 영공 방어: 바위산 위 하늘, 우리 레이더 기지를 노리는 적기(공중전) */
export const SKY_LAND = makeField({
  id: 'skyland', name: '산악 영공 방어', op: 'EAGLENEST-12', goal: '목표: 3분 동안 레이더 기지 지키기', theme: 'rock', win: 'survive', timeLimit: 180, kinds: [...AIR, 'aa'], budget: 400,
  desc: '바위산 꼭대기 레이더 기지를 지키는 공중전이에요. 적 전투기·폭격기·자폭 드론이 계속 날아와요.',
  hills: [[0, 9, 5, 1.2], [-11, -8, 4, 1.4], [11, -10, 4, 1.4]], rough: 1.2,
  allies: [['vip', 0, 9]], foeAggr: true,
  enemy: [['jet', -6, -15], ['jet', 6, -15], ['jet', 0, -17], ['drone', -2, -12], ['drone', 2, -12]],
  timed: [{ at: 20, list: [['bomber', 0, -22], ['jet', -6, -22], ['drone', 6, -22], ['drone', 3, -22]] }, { at: 70, list: [['bomber', -8, -22], ['bomber', 8, -22], ['jet', 0, -22], ['heli', -3, -21], ['heli', 3, -21]] },
    { at: 120, list: [['bomber', 0, -23], ['jet', -10, -22], ['jet', 10, -22], ['drone', -5, -22], ['drone', 5, -22], ['drone', 0, -21]], msg: '적 편대가 마지막으로 몰려와요' }],
  deploy: [['jet', -6, 17], ['jet', -2, 17], ['jet', 2, 17], ['jet', 6, 17], ['aa', -3, 15.6], ['aa', 3, 15.6], ['heli', 0, 18.4]],
});

/** ⑲ 해상 초계기 출격: 바다 위 적 함정을 하늘에서만 공격(해상-공중전, 공군만) */
export const SEA_STRIKE = makeField({
  id: 'seastrike', name: '해상 초계 공습', op: 'SEAHAWK-18', goal: '목표: 무장 함정 모두 격침', theme: 'dusk', win: 'all', sea: 'all', kinds: AIR, budget: 400,
  desc: '해 질 녘 바다 위로 우리 비행기만 출격해요. 아래 무장 함정과 적 방공함이 응사해요. 하늘에서 모두 격침해요.',
  enemy: [...squad([['boat', 6]], -6, -8, 1.6), ...squad([['dd', 1], ['boat', 4]], 6, -12, 1.8), ['jet', 0, -20]],
  timed: [{ at: 60, list: [['boat', -12, -21], ['boat', -9, -21], ['boat', -6, -21], ['jet', 4, -22]], msg: '적 함정이 더 나왔어요' }, { at: 120, list: [['dd', 10, -21], ['boat', 8, -21], ['boat', 12, -21]], msg: '적 호위함이 나타났어요' }],
  deploy: [['jet', -6, 17], ['jet', 6, 17], ['bomber', -2, 17], ['bomber', 2, 17], ['heli', -8, 18.4], ['heli', 8, 18.4], ['drone', 0, 18.4], ['missile', -4, 19.8], ['missile', 4, 19.8]],
});

/** ⑳ 해안 반격 지원: 해안 도시를 노리는 적 상륙군을 바다·땅·하늘에서 막음(육해공) */
export const COAST_DEFENSE = makeField({
  id: 'coastdef', name: '해안 상륙 저지', op: 'SEAWALL-30', goal: '목표: 상륙하는 적 모두 격퇴', theme: 'steppe', win: 'all', sea: 'foesea', seaAt: 1, budget: 500, foeAggr: true,
  desc: '적 함대가 위쪽 바다에서 해안으로 상륙해 와요. 우리는 아래쪽 땅에서 막아요. 상륙군과 함대를 모두 물리쳐요.',
  woods: [[8, 6, 2.4], [-6, 12, 2], [11, -4, 2]],
  enemy: [['lha', -4, -14], ['lha', 4, -17], ...squad([['dd', 3]], -2, -18, 2.4), ['sub', -8, -12], ...squad([['inf', 3], ['tank', 2]], 8, -8), ['jet', 0, -21], ['heli', 6, -19]],
  timed: [{ at: 60, list: [['lha', -10, -21], ['dd', -6, -21], ['boat', -3, -21], ['boat', 0, -21]], msg: '적 2차 상륙 선단이 다가와요' }, { at: 130, list: [...squad([['tank', 2], ['inf', 3]], 12, -14), ['bomber', 0, -22]], msg: '적 상륙군 주력이 해안에 내렸어요' }],
});

/** 파병 전장 20곳 */
export const DEPLOY_FIELDS: Stage[] = [PIRATES, CONVOY_SEA, STRAIT_SUB, SKY_SEA, BORDER, SAHEL, PIRATE_BASE, CARRIER, CAS, ARCTIC_SEA, REFUGEE, ISLAND, EMBASSY, OASIS, BRIDGEHOLD, MOUNTAIN_PASS, CARTEL, SKY_LAND, SEA_STRIKE, COAST_DEFENSE];
void BIG;
