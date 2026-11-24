// 카카오 로그인 시작: 카카오 동의 화면으로 보낸다
import { STATE_COOKIE, kakaoKey, origin, redirect, setCookie } from '../_lib.js';

export async function GET(req: Request): Promise<Response> {
  const key = kakaoKey();
  if (!key) return redirect('/?kakao=fail&why=nokey#settings');
  const state = crypto.randomUUID();
  const u = new URL('https://kauth.kakao.com/oauth/authorize');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', key);
  u.searchParams.set('redirect_uri', `${origin(req)}/api/kakao/callback`);
  u.searchParams.set('state', state);
  return redirect(u.toString(), [setCookie(STATE_COOKIE, state, 600)]);
}
