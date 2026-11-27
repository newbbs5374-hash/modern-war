/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 평소 시험은 src만. 균형 시뮬(sim/)은 `npm run sim`으로 따로
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000 }, // 11-27 나라 36개: 긴 모의가 느려져 기본 30초
});
