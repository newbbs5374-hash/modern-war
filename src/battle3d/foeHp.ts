/** 대전투 난이도 → 3D 공성전 적 체력 배수(0.8~1.15) */
export const foeHpOf = (d: number) => Math.max(0.8, Math.min(1.15, 0.9 + 0.15 * (d - 1)));
