// 같은 씨앗이면 같은 결과가 나오는 난수(저장해 두면 다시 불러와도 세계가 똑같이 흘러감).
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

/** 상태 안의 씨앗을 쓰는 작은 도우미 */
export class Rng {
  constructor(public seed: number) {}
  next(): number {
    const [v, s] = nextRandom(this.seed);
    this.seed = s;
    return v;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  pick<T>(list: T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }
  /** 무게대로 하나 고르기 */
  weighted<T>(list: T[], weight: (x: T) => number): T | null {
    const total = list.reduce((s, x) => s + Math.max(0, weight(x)), 0);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const x of list) {
      r -= Math.max(0, weight(x));
      if (r <= 0) return x;
    }
    return list[list.length - 1];
  }
}
