import { defineConfig } from 'vitest/config';
// 균형 시뮬: 하루 3번 접속하는 사람이 소위 → 승리까지 몇 날 걸리는지(SKILL=1이면 직접 싸워 별 +1)
export default defineConfig({ root: '.', test: { include: ['sim/**/*.test.ts'] } });
