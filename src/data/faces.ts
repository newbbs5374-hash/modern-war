// 인물 얼굴 묶음(11-24 대장 결정: 나라별 40장, 모두 520장).
// 파일 이름: face-{묶음}-{성별}-{나이대}-{번호}.webp  예) face-kr-m-50-01.webp · face-us-bl-f-60-02.webp
//   묶음 = 나라 id(kr·kp·jp·cn·in·uk·de·ru·ua·ir·il·tr), 미국만 4갈래(us-we 백인 · us-bl 흑인 · us-hi 히스패닉 · us-as 아시아계)
//   나이대 50 = 59세까지, 60 = 60세부터
// 게임은 사람마다 "그 묶음·성별 안의 몇 번째 얼굴"(Person.face)을 하나씩 나눠 줘서, 묶음이 남아 있는 동안 같은 얼굴이 두 사람에게 가지 않아요.
// 이름은 묶음에 맞는 이름표에서 뽑아요(names.ts makeNameEth) → 이름과 인종이 어긋나지 않음.

export type FaceBand = '50' | '60';
export interface FacePlan {
  m50: number;
  m60: number;
  f50: number;
  f60: number;
}
const N = (m50: number, m60: number, f50: number, f60: number): FacePlan => ({ m50, m60, f50, f60 });

/** 나라 묶음마다 장 수(합 40). 정치인은 남자·중년이 많아서 남자 26 · 여자 14 */
const STD = N(14, 12, 9, 5);
export const FACE_PLAN: Record<string, FacePlan> = {
  kr: STD, kp: STD, jp: STD, cn: STD, in: STD, uk: STD, de: STD, ru: STD, ua: STD, ir: STD, il: STD, tr: STD,
  // 미국 40 = 백인 20 · 흑인 8 · 히스패닉 8 · 아시아계 4
  'us-we': N(7, 6, 4, 3),
  'us-bl': N(3, 2, 2, 1),
  'us-hi': N(3, 2, 2, 1),
  'us-as': N(1, 1, 1, 1),
};
export const US_ETH = ['we', 'bl', 'hi', 'as'] as const;
export type UsEth = (typeof US_ETH)[number];
export const US_ETH_NAME: Record<UsEth, string> = { we: '백인', bl: '흑인', hi: '히스패닉', as: '아시아계' };
/** 미국 인물이 어느 갈래일지(장 수 비율과 같게) */
export const US_ETH_WEIGHT: Record<UsEth, number> = { we: 0.5, bl: 0.2, hi: 0.2, as: 0.1 };

/** 사람의 얼굴 묶음 이름 */
export const faceTag = (country: string, eth?: string) => (country === 'us' ? `us-${eth && (US_ETH as readonly string[]).includes(eth) ? eth : 'we'}` : FACE_PLAN[country] ? country : 'us-we');

/**
 * 추가 얼굴(11-24 대장 결정 "나라별 더"): 나라마다 22장(남 13 · 여 9) → 모두 62장.
 * 번호는 기존 다음부터 이어 붙임(예: face-kr-m-50-15). 그림이 들어오면 FACE_EXTRA_READY를 true로 바꿔요.
 * 기존 얼굴 번호(0~39)는 그대로라 저장된 판의 얼굴이 바뀌지 않아요.
 */
const STD2 = N(7, 6, 6, 3);
export const FACE_EXTRA: Record<string, FacePlan> = {
  kr: STD2, kp: STD2, jp: STD2, cn: STD2, in: STD2, uk: STD2, de: STD2, ru: STD2, ua: STD2, ir: STD2, il: STD2, tr: STD2,
  // 미국 22 = 백인 11 · 흑인 5 · 히스패닉 5 · 아시아계 1
  'us-we': N(4, 3, 3, 1),
  'us-bl': N(2, 1, 1, 1),
  'us-hi': N(2, 1, 1, 1),
  'us-as': N(1, 0, 0, 0),
};
export const FACE_EXTRA_READY = true;

/**
 * 셋째 묶음(11-24 대장 "겹치는 인물이 없어야"): 한 판에 내 나라 사람이 약 110명(남 66~72 · 여 34~42)에
 * 장관·참모를 뽑을수록 더 늘어서, 나라마다 80장(남 50 · 여 30)을 더 넣어 142장으로 만듦.
 * 그림이 들어온 나라만 EXTRA2_READY에 넣어요(나라 id, 미국은 'us'). 번호는 둘째 묶음 다음부터 이어 붙임.
 */
const STD3 = N(27, 23, 18, 12);
export const FACE_EXTRA2: Record<string, FacePlan> = {
  kr: STD3, kp: STD3, jp: STD3, cn: STD3, in: STD3, uk: STD3, de: STD3, ru: STD3, ua: STD3, ir: STD3, il: STD3, tr: STD3,
  // 미국 80 = 백인 40 · 흑인 16 · 히스패닉 16 · 아시아계 8
  'us-we': N(14, 11, 9, 6),
  'us-bl': N(5, 5, 3, 3),
  'us-hi': N(5, 5, 3, 3),
  'us-as': N(3, 2, 2, 1),
};
export const EXTRA2_READY: readonly string[] = ['kr', 'kp', 'jp', 'cn'];
const tagCountry = (tag: string) => (tag.startsWith('us-') ? 'us' : tag);
const extra2On = (tag: string) => EXTRA2_READY.includes(tagCountry(tag));

const part = (p: FacePlan, sex: 'm' | 'f') => (sex === 'm' ? [p.m50, p.m60] : [p.f50, p.f60]);

/** 묶음·성별 안 얼굴 수(extra: 추가 얼굴까지) */
export function deckSize(tag: string, sex: 'm' | 'f', extra = FACE_EXTRA_READY, extra2 = extra && extra2On(tag)): number {
  const [a, b] = part(FACE_PLAN[tag] ?? STD, sex);
  const [c, d] = extra ? part(FACE_EXTRA[tag] ?? STD2, sex) : [0, 0];
  const [e, f] = extra2 ? part(FACE_EXTRA2[tag] ?? STD3, sex) : [0, 0];
  return a + b + c + d + e + f;
}
/** i번째 얼굴의 나이대·번호: 0~(기존 수−1)은 기존 얼굴, 그다음은 추가 얼굴 */
export function deckSlot(tag: string, sex: 'm' | 'f', i: number, extra = FACE_EXTRA_READY, extra2 = extra && extra2On(tag)): { band: FaceBand; n: number } {
  const [b50, b60] = part(FACE_PLAN[tag] ?? STD, sex);
  const [e50, e60] = part(FACE_EXTRA[tag] ?? STD2, sex);
  const [g50] = part(FACE_EXTRA2[tag] ?? STD3, sex);
  const size = deckSize(tag, sex, extra, extra2);
  const k = ((i % size) + size) % size;
  if (k < b50) return { band: '50', n: k + 1 };
  if (k < b50 + b60) return { band: '60', n: k - b50 + 1 };
  const j = k - b50 - b60;
  if (j < e50) return { band: '50', n: b50 + j + 1 };
  if (j < e50 + e60) return { band: '60', n: b60 + (j - e50) + 1 };
  const q = j - e50 - e60;
  return q < g50 ? { band: '50', n: b50 + e50 + q + 1 } : { band: '60', n: b60 + e60 + (q - g50) + 1 };
}
export const pad2 = (n: number) => String(n).padStart(2, '0');
/** i번째 얼굴의 파일 이름(확장자 없이) */
export const faceFile = (tag: string, sex: 'm' | 'f', i: number, extra = FACE_EXTRA_READY, extra2 = extra && extra2On(tag)) => {
  const { band, n } = deckSlot(tag, sex, i, extra, extra2);
  return `face-${tag}-${sex}-${band}-${pad2(n)}`;
};
/** 모든 얼굴 파일 이름(명령문·시험용) */
export function allFaceFiles(extra = FACE_EXTRA_READY, extra2?: boolean): string[] {
  const out: string[] = [];
  for (const tag of Object.keys(FACE_PLAN)) {
    const e2 = extra2 ?? (extra && extra2On(tag));
    for (const sex of ['m', 'f'] as const) for (let i = 0; i < deckSize(tag, sex, extra, e2); i++) out.push(faceFile(tag, sex, i, extra, e2));
  }
  return out;
}

/* ───────── 젊은 얼굴(부관, 11-24 대장 "부관들은 젊은 나이의 인물로") ───────── */
// 파일 이름: face-{묶음}-{성별}-30-{번호}.webp(20~30대). 장관·참모 얼굴(50·60)과 파일이 달라 서로 겹치지 않아요.
// 한국은 이미 있는 이름 부관 그림 20장(남 11 · 여 9)을 앞 번호로 씀 → 새로 16장(남 9 · 여 7)만 더.
export interface YoungPlan {
  m: number;
  f: number;
}
export const YOUNG_PLAN: Record<string, YoungPlan> = {
  kr: { m: 20, f: 16 },
  kp: { m: 20, f: 12 }, jp: { m: 20, f: 12 }, cn: { m: 20, f: 12 }, in: { m: 20, f: 12 }, uk: { m: 20, f: 12 }, de: { m: 20, f: 12 },
  ru: { m: 20, f: 12 }, ua: { m: 20, f: 12 }, ir: { m: 20, f: 12 }, il: { m: 20, f: 12 }, tr: { m: 20, f: 12 },
  // 미국 32 = 백인 16 · 흑인 6 · 히스패닉 6 · 아시아계 4
  'us-we': { m: 10, f: 6 },
  'us-bl': { m: 4, f: 2 },
  'us-hi': { m: 4, f: 2 },
  'us-as': { m: 2, f: 2 },
};
/** 지금 게임에 들어 있는 젊은 얼굴 수(그림이 오면 늘림). 없는 나라는 부관이 옛 방식(장관 얼굴 묶음)으로 */
export const YOUNG_READY: Record<string, YoungPlan> = {
  kr: { m: 20, f: 16 },
  kp: { m: 20, f: 12 },
  jp: { m: 20, f: 12 },
  cn: { m: 20, f: 12 },
  'us-we': { m: 10, f: 6 },
  'us-bl': { m: 4, f: 2 },
  'us-hi': { m: 4, f: 2 },
  'us-as': { m: 2, f: 2 },
  uk: { m: 20, f: 12 },
  de: { m: 20, f: 12 },
  ru: { m: 20, f: 12 },
  ua: { m: 20, f: 12 },
  in: { m: 20, f: 12 },
  ir: { m: 20, f: 12 },
  il: { m: 20, f: 12 },
  tr: { m: 20, f: 12 },
};
/** 한국 이름 부관 그림 → 젊은 얼굴 번호(옛 저장의 이름 부관이 같은 얼굴을 계속 쓰게) */
export const KR_NAMED_YOUNG: Record<string, string> = {
  남궁현: 'face-kr-m-30-01', 류지후: 'face-kr-m-30-02', 문하람: 'face-kr-m-30-03', 백시우: 'face-kr-m-30-04', 서도윤: 'face-kr-m-30-05', 송재민: 'face-kr-m-30-06',
  윤태오: 'face-kr-m-30-07', 임건우: 'face-kr-m-30-08', 정민재: 'face-kr-m-30-09', 최도현: 'face-kr-m-30-10', 황이든: 'face-kr-m-30-11',
  강하린: 'face-kr-f-30-01', 권나래: 'face-kr-f-30-02', 박서진: 'face-kr-f-30-03', 배수아: 'face-kr-f-30-04', 신다온: 'face-kr-f-30-05',
  오세라: 'face-kr-f-30-06', 조은결: 'face-kr-f-30-07', 한유나: 'face-kr-f-30-08', 홍라온: 'face-kr-f-30-09',
};
export const youngSize = (tag: string, sex: 'm' | 'f') => YOUNG_READY[tag]?.[sex] ?? 0;
export const youngFile = (tag: string, sex: 'm' | 'f', i: number) => `face-${tag}-${sex}-30-${pad2(i + 1)}`;
export const isYoungFace = (key?: string) => !!key && /^face-.+-[mf]-30-\d+$/.test(key);
/** 그 나라에 젊은 얼굴이 (한 성별이라도) 들어 있나 */
export const youngReady = (country: string) => {
  const tags = country === 'us' ? US_ETH.map((e) => `us-${e}`) : [country];
  return tags.some((t) => youngSize(t, 'm') + youngSize(t, 'f') > 0);
};
/** 모든 젊은 얼굴 파일(계획 전체) */
export function allYoungFiles(): string[] {
  const out: string[] = [];
  for (const [tag, p] of Object.entries(YOUNG_PLAN)) for (const sex of ['m', 'f'] as const) for (let i = 0; i < p[sex]; i++) out.push(youngFile(tag, sex, i));
  return out;
}


export interface FacePerson {
  id: number;
  sex: 'm' | 'f';
  age: number;
  country: string;
  eth?: string;
  face?: number;
  /** 우선순위가 높을수록 겹치지 않는 얼굴을 먼저 받음(자리에 앉은 사람 등) */
  rank: number;
  /** 한 화면에 같이 나오는 무리(같은 무리 안에서는 얼굴이 절대 겹치지 않게) */
  screen?: string;
}

/**
 * 얼굴 나눠 주기: 우선순위 순서로, 이미 받은 얼굴은 그대로 두고(겹치면 다시),
 * 새 사람은 나이대가 맞는 빈 얼굴 → 다른 나이대 빈 얼굴 → (다 쓰면) 가장 적게 쓴 얼굴.
 * 결과: id → 얼굴 번호
 */
/** 사람 번호·얼굴 번호로 섞는 값 */
const mix = (id: number, k: number) => (Math.imul(id * 2654435761 + k * 40503, 2246822519) >>> 0) % 100003;

export function assignFaces(people: FacePerson[]): Map<number, number> {
  const out = new Map<number, number>();
  const used = new Map<string, number[]>();
  /** 묶음·성별·화면 → 그 화면에서 쓴 얼굴 */
  const onScreen = new Map<string, Set<number>>();
  const order = [...people].sort((a, b) => b.rank - a.rank || a.id - b.id);
  for (const p of order) {
    const tag = faceTag(p.country, p.eth);
    const key = `${tag}-${p.sex}`;
    const size = deckSize(tag, p.sex);
    const cnt = used.get(key) ?? new Array(size).fill(0);
    used.set(key, cnt);
    const sk = `${key}|${p.screen ?? ''}`;
    const scr = onScreen.get(sk) ?? new Set<number>();
    onScreen.set(sk, scr);
    const want: FaceBand = p.age >= 60 ? '60' : '50';
    // 빈 얼굴은 사람마다 다른 순서로(명단을 새로 받아도 방금 나간 얼굴이 같은 자리에 다시 나오지 않게)
    const free = cnt
      .map((c, k) => (c === 0 ? k : -1))
      .filter((k) => k >= 0)
      .sort((x, y) => mix(p.id, x) - mix(p.id, y));
    const okOld = p.face !== undefined && p.face >= 0 && p.face < size && !scr.has(p.face) && (cnt[p.face] === 0 || free.length === 0);
    let i = okOld ? p.face! : -1;
    if (i < 0) i = free.find((k) => deckSlot(tag, p.sex, k).band === want) ?? free[0] ?? -1;
    if (i < 0) {
      // 얼굴을 다 썼으면: 같은 화면에 없는 얼굴 중 가장 적게 쓴 것(나이대 맞는 쪽 먼저)
      const cand = cnt.map((_, k) => k).filter((k) => !scr.has(k));
      const pool = cand.length ? cand : cnt.map((_, k) => k);
      const min = Math.min(...pool.map((k) => cnt[k]));
      const same = pool.filter((k) => cnt[k] === min);
      i = same.find((k) => deckSlot(tag, p.sex, k).band === want) ?? same[0];
    }
    cnt[i]++;
    scr.add(i);
    out.set(p.id, i);
  }
  return out;
}

/** 그림 한 장(3×3 = 9명, 마지막 장은 2×2 = 4명)에 들어갈 얼굴 파일들. 나라마다 9·9·9·9·4 = 5장 */
export interface FaceSheet {
  /** 저장할 그림 이름(확장자 없이) 예) sheet-kr-1 */
  sheet: string;
  country: string;
  /** 한 줄 칸 수(1 = 한 사람 그림, 2×2 · 3×3 · 4×4) */
  grid: 1 | 2 | 3 | 4;
  /** band 30 = 20~30대 부관, 20 = 20대 수행비서 */
  cells: Array<{ file: string; tag: string; sex: 'm' | 'f'; band: FaceBand | '30' | '20' }>;
}
export const SHEET_COUNTRIES = ['kr', 'kp', 'jp', 'cn', 'us', 'uk', 'de', 'ru', 'ua', 'in', 'ir', 'il', 'tr'];
/** 기존 40장 그림: 나라마다 9·9·9·9·4 = 5장(sheet-kr-1~5) */
export function faceSheets(): FaceSheet[] {
  return makeSheets(false);
}
/** 추가 22장 그림: 나라마다 9·9·4 = 3장(sheet-kr-6~8) */
export function faceSheetsExtra(): FaceSheet[] {
  return makeSheets(true);
}
function makeSheets(extra: boolean): FaceSheet[] {
  const out: FaceSheet[] = [];
  for (const c of SHEET_COUNTRIES) {
    const tags = c === 'us' ? US_ETH.map((e) => `us-${e}`) : [c];
    const cells: FaceSheet['cells'] = [];
    for (const tag of tags)
      for (const sex of ['m', 'f'] as const) {
        const from = extra ? deckSize(tag, sex, false) : 0;
        const to = extra ? deckSize(tag, sex, true, false) : deckSize(tag, sex, false, false);
        for (let i = from; i < to; i++) cells.push({ file: faceFile(tag, sex, i, true, false), tag, sex, band: deckSlot(tag, sex, i, true, false).band });
      }
    // 한 장 안에 남녀·나이가 섞이게 골고루 펼침
    const mixed: typeof cells = [];
    const step = extra ? 3 : 9;
    for (let k = 0; k < step; k++) for (let j = k; j < cells.length; j += step) mixed.push(cells[j]);
    for (let s = 0, n = extra ? 6 : 1; s < mixed.length; n++) {
      const left = mixed.length - s;
      const size = left >= 9 ? 9 : 4;
      out.push({ sheet: `sheet-${c}-${n}`, country: c, grid: size === 9 ? 3 : 2, cells: mixed.slice(s, s + size) });
      s += size;
    }
  }
  return out;
}

/** 골고루 섞어 16명씩(4×4) 나눔. 끝에 남으면 9(3×3)·4(2×2)로 */
function cut16(c: string, cells: FaceSheet['cells'], first: number, prefix = ''): FaceSheet[] {
  const out: FaceSheet[] = [];
  const step = Math.max(1, Math.ceil(cells.length / 16));
  const mixed: typeof cells = [];
  for (let k = 0; k < step; k++) for (let j = k; j < cells.length; j += step) mixed.push(cells[j]);
  for (let s = 0, n = first; s < mixed.length; n++) {
    const left = mixed.length - s;
    const size = left >= 16 ? 16 : left >= 9 ? 9 : 4;
    out.push({ sheet: `sheet-${c}-${prefix}${n}`, country: c, grid: size === 16 ? 4 : size === 9 ? 3 : 2, cells: mixed.slice(s, s + size) });
    s += size;
  }
  return out;
}
const tagsOf = (c: string) => (c === 'us' ? US_ETH.map((e) => `us-${e}`) : [c]);

/** 셋째 묶음 80장: 나라마다 4×4 다섯 장(sheet-kr-9~13) */
export function faceSheetsExtra2(): FaceSheet[] {
  const out: FaceSheet[] = [];
  for (const c of SHEET_COUNTRIES) {
    const cells: FaceSheet['cells'] = [];
    for (const tag of tagsOf(c))
      for (const sex of ['m', 'f'] as const)
        for (let i = deckSize(tag, sex, true, false); i < deckSize(tag, sex, true, true); i++) cells.push({ file: faceFile(tag, sex, i, true, true), tag, sex, band: deckSlot(tag, sex, i, true, true).band });
    out.push(...cut16(c, cells, 9));
  }
  return out;
}
/** 젊은 부관 얼굴(아직 없는 것): 나라마다 4×4 두 장(sheet-kr-y1…), 한국은 한 장 */
export function youngSheets(): FaceSheet[] {
  const out: FaceSheet[] = [];
  for (const c of SHEET_COUNTRIES) {
    const cells: FaceSheet['cells'] = [];
    for (const tag of tagsOf(c))
      for (const sex of ['m', 'f'] as const) for (let i = youngSize(tag, sex); i < (YOUNG_PLAN[tag]?.[sex] ?? 0); i++) cells.push({ file: youngFile(tag, sex, i), tag, sex, band: '30' });
    out.push(...cut16(c, cells, 1, 'y'));
  }
  return out;
}
/** 수행비서 13명: 한 사람씩 한 장(secretary-kr…) */
export function secretarySheets(): FaceSheet[] {
  return SHEET_COUNTRIES.map((c) => ({ sheet: `secretary-${c}`, country: c, grid: 1 as const, cells: [{ file: `secretary-${c}`, tag: c === 'us' ? 'us-we' : c, sex: 'f' as const, band: '20' as const }] }));
}
