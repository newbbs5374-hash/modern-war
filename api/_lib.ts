// 서버 공용 도구(카카오 로그인·서버 저장). 파일 이름이 _로 시작해서 주소(api)로는 열리지 않는다.
// 서버 저장소는 이 게임 전용 Upstash Redis(Vercel Storage에서 만든 것). 열쇠 이름은 mw: 로 시작.

const env = (k: string) => (process.env[k] ?? '').trim();

/** Vercel Storage가 넣어 준 Redis 주소·열쇠(이름 앞부분이 달라도 찾음) */
function redisEnv(): { url: string; token: string } | null {
  const pairs: [string, string][] = [
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  ];
  for (const k of Object.keys(process.env)) {
    if (k.endsWith('_KV_REST_API_URL')) pairs.push([k, k.replace(/_URL$/, '_TOKEN')]);
    else if (k.endsWith('_REDIS_REST_URL')) pairs.push([k, k.replace(/_URL$/, '_TOKEN')]);
  }
  for (const [u, t] of pairs) if (env(u) && env(t)) return { url: env(u).replace(/\/$/, ''), token: env(t) };
  return null;
}

export const kakaoKey = () => env('KAKAO_REST_KEY') || env('KAKAO_REST_API_KEY');
export const kakaoSecret = () => env('KAKAO_CLIENT_SECRET');
export const ready = () => !!kakaoKey() && !!redisEnv();

export async function redis<T = unknown>(cmd: (string | number)[]): Promise<T> {
  const r = redisEnv();
  if (!r) throw new Error('서버 저장소가 아직 없어요');
  const res = await fetch(r.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${r.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd.map(String)),
  });
  const j = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || j.error) throw new Error(j.error || `redis ${res.status}`);
  return j.result as T;
}

/* ───── 로그인 표(쿠키): 카카오 번호·별명에 서명을 붙여 둔다(서버에 따로 적지 않음) ───── */
export interface Sess {
  k: string; // 카카오 회원번호
  n: string; // 별명
  t: number; // 만든 시각
}
export const SESS_COOKIE = 'mw_sess';
export const STATE_COOKIE = 'mw_kst';
const YEAR = 365 * 24 * 3600;

function secret(): string {
  return env('SESSION_SECRET') || kakaoSecret() || redisEnv()?.token || 'mw-dev';
}
const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');
async function hmac(text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))));
}
export async function makeSess(s: Sess): Promise<string> {
  const body = Buffer.from(JSON.stringify(s)).toString('base64url');
  return `${body}.${await hmac(body)}`;
}
export async function readSess(req: Request): Promise<Sess | null> {
  const v = cookie(req, SESS_COOKIE);
  if (!v) return null;
  const [body, sig] = v.split('.');
  if (!body || !sig || (await hmac(body)) !== sig) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as Sess;
    return s && typeof s.k === 'string' ? s : null;
  } catch {
    return null;
  }
}

export function cookie(req: Request, name: string): string | null {
  const all = req.headers.get('cookie') ?? '';
  for (const part of all.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}
export function setCookie(name: string, value: string, maxAge = YEAR): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

/** 이 주소의 맨 앞(https://modern-war-pi.vercel.app) */
export function origin(req: Request): string {
  if (env('PUBLIC_ORIGIN')) return env('PUBLIC_ORIGIN').replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
  const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function redirect(to: string, cookies: string[] = []): Response {
  const h = new Headers({ Location: to, 'Cache-Control': 'no-store' });
  for (const c of cookies) h.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers: h });
}
