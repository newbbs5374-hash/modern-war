// 화면 기준 틀 — 용흔(dragon-rpg)의 screen-frame.js와 똑같은 규칙(용흔은 읽기만 하고 같은 숫자를 씀).
// 기준 기기: 갤럭시 S26+ 브라우저 412 × 891 (19.5 : 9). 숫자는 여기 한 곳만 고치면 된다.
// · 휴대폰을 세로로 들었을 때(터치 화면 + 세로): 게임이 화면을 꽉 채운다(여백 없음).
// · 그 밖(PC 창 · 휴대폰 가로): 안쪽 창(iframe)을 412 × 891로 고정하고 창 크기에 맞춰 비율 그대로 통째로 확대/축소해 가운데에 둔다.
//   안쪽 게임은 자기 화면이 진짜 412 × 891인 줄 알아서 글자·버튼·배치가 휴대폰과 똑같다.
export const FRAME = { w: 412, h: 891, device: '갤럭시 S26+', ratio: '19.5:9' };

/** true면 이 창에서 게임을 시작, false면 바깥 틀만 만들고 끝 */
export function setupFrame(): boolean {
  const q = location.search;
  const inner = window.top !== window || /[?&](inner|noframe)=1\b/.test(q);
  if (inner) {
    if (window.top !== window) {
      const tell = () => {
        try {
          parent.postMessage({ mwHash: location.hash }, location.origin);
        } catch {
          /* 무시 */
        }
      };
      addEventListener('hashchange', tell);
    }
    return true;
  }
  const u = new URL(location.href);
  u.searchParams.set('inner', '1');
  const root = document.documentElement;
  const body = document.body;
  root.setAttribute('data-frame-host', '');
  while (body.firstChild) body.removeChild(body.firstChild);
  Object.assign(root.style, { height: '100%', overflow: 'hidden', background: '#050607' });
  Object.assign(body.style, { margin: '0', height: '100%', overflow: 'hidden', background: '#050607' });
  const f = document.createElement('iframe');
  f.id = 'game-frame';
  f.title = document.title;
  f.src = u.pathname + u.search + u.hash;
  f.setAttribute('allow', 'clipboard-write');
  Object.assign(f.style, { position: 'fixed', left: '0', top: '0', border: '0', display: 'block', transformOrigin: '0 0', background: '#0b1220' });
  body.appendChild(f);
  // 카카오 로그인 결과(?kakao=ok)는 안쪽 게임에만 넘기고 바깥 주소에선 지움(새로고침해도 다시 안 뜨게)
  if (/[?&]kakao=/.test(q)) {
    const o = new URL(location.href);
    o.searchParams.delete('kakao');
    o.searchParams.delete('why');
    history.replaceState(history.state, '', o.pathname + o.search + o.hash);
  }
  const touch = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
  const fit = () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const fill = touch() && H >= W;
    if (fill) {
      Object.assign(f.style, { width: W + 'px', height: H + 'px', transform: 'none' });
    } else {
      const z = Math.min(W / FRAME.w, H / FRAME.h);
      Object.assign(f.style, {
        width: FRAME.w + 'px',
        height: FRAME.h + 'px',
        transform: `translate(${(W - FRAME.w * z) / 2}px,${(H - FRAME.h * z) / 2}px) scale(${z})`,
      });
    }
    root.setAttribute('data-frame', fill ? 'fill' : 'frame');
  };
  fit();
  addEventListener('resize', fit);
  addEventListener('orientationchange', fit);
  window.visualViewport?.addEventListener('resize', fit);
  f.addEventListener('load', () => {
    try {
      f.contentWindow?.focus();
    } catch {
      /* 무시 */
    }
  });
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || typeof e.data.mwHash !== 'string') return;
    try {
      history.replaceState(history.state, '', location.pathname + location.search + e.data.mwHash);
    } catch {
      /* 무시 */
    }
  });
  return false;
}
