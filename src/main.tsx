import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setupFrame } from './frame';
import './style.css';

// PC·휴대폰 가로에서는 412×891 틀 안(iframe)에서만 게임을 띄움(용흔과 같은 규칙)
if (setupFrame()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
