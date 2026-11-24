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

/** 묶음·성별 안 얼굴 수와 i번째 얼굴의 나이대·번호 */
export function deckSize(tag: string, sex: 'm' | 'f'): number {
  const p = FACE_PLAN[tag] ?? STD;
  return sex === 'm' ? p.m50 + p.m60 : p.f50 + p.f60;
}
export function deckSlot(tag: string, sex: 'm' | 'f', i: number): { band: FaceBand; n: number } {
  const p = FACE_PLAN[tag] ?? STD;
  const n50 = sex === 'm' ? p.m50 : p.f50;
  const size = deckSize(tag, sex);
  const k = ((i % size) + size) % size;
  return k < n50 ? { band: '50', n: k + 1 } : { band: '60', n: k - n50 + 1 };
}
export const pad2 = (n: number) => String(n).padStart(2, '0');
/** i번째 얼굴의 파일 이름(확장자 없이) */
export const faceFile = (tag: string, sex: 'm' | 'f', i: number) => {
  const { band, n } = deckSlot(tag, sex, i);
  return `face-${tag}-${sex}-${band}-${pad2(n)}`;
};
/** 모든 얼굴 파일 이름(명령문·시험용) */
export function allFaceFiles(): string[] {
  const out: string[] = [];
  for (const tag of Object.keys(FACE_PLAN)) for (const sex of ['m', 'f'] as const) for (let i = 0; i < deckSize(tag, sex); i++) out.push(faceFile(tag, sex, i));
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
}

/**
 * 얼굴 나눠 주기: 우선순위 순서로, 이미 받은 얼굴은 그대로 두고(겹치면 다시),
 * 새 사람은 나이대가 맞는 빈 얼굴 → 다른 나이대 빈 얼굴 → (다 쓰면) 가장 적게 쓴 얼굴.
 * 결과: id → 얼굴 번호
 */
export function assignFaces(people: FacePerson[]): Map<number, number> {
  const out = new Map<number, number>();
  const used = new Map<string, number[]>();
  const order = [...people].sort((a, b) => b.rank - a.rank || a.id - b.id);
  for (const p of order) {
    const tag = faceTag(p.country, p.eth);
    const key = `${tag}-${p.sex}`;
    const size = deckSize(tag, p.sex);
    const cnt = used.get(key) ?? new Array(size).fill(0);
    used.set(key, cnt);
    let i = p.face !== undefined && p.face >= 0 && p.face < size && cnt[p.face] === 0 ? p.face : -1;
    if (i < 0) {
      const want: FaceBand = p.age >= 60 ? '60' : '50';
      const free = cnt.map((c, k) => (c === 0 ? k : -1)).filter((k) => k >= 0);
      i = free.find((k) => deckSlot(tag, p.sex, k).band === want) ?? free[0] ?? -1;
      if (i < 0) {
        const min = Math.min(...cnt);
        const same = cnt.map((c, k) => (c === min ? k : -1)).filter((k) => k >= 0);
        i = same.find((k) => deckSlot(tag, p.sex, k).band === want) ?? same[0];
      }
    }
    cnt[i]++;
    out.set(p.id, i);
  }
  return out;
}

/** 그림 한 장(3×3 = 9명, 마지막 장은 2×2 = 4명)에 들어갈 얼굴 파일들. 나라마다 9·9·9·9·4 = 5장 */
export interface FaceSheet {
  /** 저장할 그림 이름(확장자 없이) 예) sheet-kr-1 */
  sheet: string;
  country: string;
  grid: 2 | 3;
  cells: Array<{ file: string; tag: string; sex: 'm' | 'f'; band: FaceBand }>;
}
export const SHEET_COUNTRIES = ['kr', 'kp', 'jp', 'cn', 'us', 'uk', 'de', 'ru', 'ua', 'in', 'ir', 'il', 'tr'];
export function faceSheets(): FaceSheet[] {
  const out: FaceSheet[] = [];
  for (const c of SHEET_COUNTRIES) {
    const tags = c === 'us' ? US_ETH.map((e) => `us-${e}`) : [c];
    const cells: FaceSheet['cells'] = [];
    for (const tag of tags)
      for (const sex of ['m', 'f'] as const)
        for (let i = 0; i < deckSize(tag, sex); i++) cells.push({ file: faceFile(tag, sex, i), tag, sex, band: deckSlot(tag, sex, i).band });
    // 한 장 안에 남녀·나이가 섞이게 골고루 펼침
    const mixed: typeof cells = [];
    const step = 9;
    for (let k = 0; k < step; k++) for (let j = k; j < cells.length; j += step) mixed.push(cells[j]);
    for (let s = 0, n = 1; s < mixed.length; n++) {
      const left = mixed.length - s;
      const size = left >= 9 ? 9 : 4;
      out.push({ sheet: `sheet-${c}-${n}`, country: c, grid: size === 9 ? 3 : 2, cells: mixed.slice(s, s + size) });
      s += size;
    }
  }
  return out;
}
