import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setupFrame } from './frame';
import './style.css';
import './theme-console.css';

import { Safe, logError } from './ui/Safe';

// 어디서 난 오류든 기록만 하고 게임은 계속(11/25)
window.addEventListener('error', (e) => logError('창 오류', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => logError('비동기 오류', e.reason));
// 새 버전이 올라온 뒤 옛 화면에서 없는 파일을 부르면 한 번만 새로고침
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  try {
    if (sessionStorage.getItem('mw-reloaded')) return;
    sessionStorage.setItem('mw-reloaded', '1');
  } catch {
    return;
  }
  location.reload();
});

// PC·휴대폰 가로에서는 412×891 틀 안(iframe)에서만 게임을 띄움(용흔과 같은 규칙)
if (setupFrame()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Safe where="게임 전체" onExit={() => location.reload()} exitLabel="새로고침">
        <App />
      </Safe>
    </StrictMode>,
  );
}
