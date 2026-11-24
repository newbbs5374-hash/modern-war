// 카카오가 돌려보낸 곳: 코드 → 토큰 → 회원번호·별명 → 로그인 표(쿠키)
import { SESS_COOKIE, STATE_COOKIE, cookie, kakaoKey, kakaoSecret, makeSess, origin, redirect, setCookie } from '../_lib.js';

const fail = (why: string) => redirect(`/?kakao=fail&why=${encodeURIComponent(why)}#settings`, [setCookie(STATE_COOKIE, '', 0)]);

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  if (q.get('error')) return fail(q.get('error') === 'access_denied' ? 'cancel' : q.get('error')!);
  const code = q.get('code');
  if (!code) return fail('nocode');
  if (!q.get('state') || q.get('state') !== cookie(req, STATE_COOKIE)) return fail('state');

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: kakaoKey(),
    redirect_uri: `${origin(req)}/api/kakao/callback`,
    code,
  });
  if (kakaoSecret()) form.set('client_secret', kakaoSecret());
  const tr = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: form,
  });
  const tok = (await tr.json().catch(() => ({}))) as { access_token?: string; error_code?: string; error?: string };
  if (!tok.access_token) return fail(tok.error_code || tok.error || `token${tr.status}`);

  const ur = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const me = (await ur.json().catch(() => ({}))) as {
    id?: number;
    properties?: { nickname?: string };
    kakao_account?: { profile?: { nickname?: string } };
  };
  if (!me.id) return fail(`me${ur.status}`);
  const nick = me.kakao_account?.profile?.nickname || me.properties?.nickname || '카카오 사용자';
  const sess = await makeSess({ k: String(me.id), n: nick.slice(0, 30), t: Date.now() });
  return redirect('/?kakao=ok#settings', [setCookie(SESS_COOKIE, sess), setCookie(STATE_COOKIE, '', 0)]);
}
