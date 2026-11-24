// 로그아웃: 로그인 표(쿠키)를 지운다. 서버 저장은 그대로 남음
import { SESS_COOKIE, json, setCookie } from './_lib.js';

export async function POST(): Promise<Response> {
  return json({ ok: true }, 200, { 'Set-Cookie': setCookie(SESS_COOKIE, '', 0) });
}
