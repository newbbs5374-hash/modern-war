/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 평소 시험은 src만. 균형 시뮬(sim/)은 `npm run sim`으로 따로
  test: { include: ['src/**/*.test.ts'] },
});
