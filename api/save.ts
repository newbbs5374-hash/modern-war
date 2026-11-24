// 서버 저장: 카카오 회원 한 명당 저장 한 칸(mw:save:<회원번호>)
// GET ?head=1 → 번호·정보만 / GET → 저장 내용까지 / PUT → 올리기(다른 기기가 먼저 바꿨으면 409)
import { json, readSess, redis } from './_lib.js';

const MAX = 3 * 1024 * 1024; // 압축한 저장 3MB까지
const keyOf = (k: string) => `mw:save:${k}`;

// 번호(rev)가 같을 때만 바꿈(base -1 = 무조건 덮어쓰기)
const PUT_LUA = `
local cur = tonumber(redis.call('HGET', KEYS[1], 'rev') or '0')
if ARGV[1] ~= '-1' and tonumber(ARGV[1]) ~= cur then return {0, cur} end
cur = cur + 1
redis.call('HSET', KEYS[1], 'rev', cur, 'data', ARGV[2], 'at', ARGV[3], 'info', ARGV[4])
return {1, cur}`;

export async function GET(req: Request): Promise<Response> {
  const s = await readSess(req);
  if (!s) return json({ error: 'login' }, 401);
  try {
    const head = new URL(req.url).searchParams.get('head') === '1';
    const f = head ? ['rev', 'at', 'info'] : ['rev', 'at', 'info', 'data'];
    const [rev, at, info, data] = await redis<(string | null)[]>(['HMGET', keyOf(s.k), ...f]);
    if (!rev) return json({ rev: 0 });
    return json({ rev: Number(rev), at: Number(at), info: info ? JSON.parse(info) : null, ...(head ? {} : { data }) });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 503);
  }
}

export async function PUT(req: Request): Promise<Response> {
  const s = await readSess(req);
  if (!s) return json({ error: 'login' }, 401);
  try {
    const base = Number(req.headers.get('x-base-rev') ?? 'NaN');
    if (!Number.isFinite(base)) return json({ error: 'base' }, 400);
    let info = '{}';
    try {
      info = JSON.stringify(JSON.parse(decodeURIComponent(req.headers.get('x-info') ?? '%7B%7D')));
    } catch {
      /* 정보 없이 */
    }
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf.length || buf.length > MAX) return json({ error: 'size' }, 413);
    const at = Date.now();
    const [ok, rev] = await redis<[number, number]>(['EVAL', PUT_LUA, 1, keyOf(s.k), base, Buffer.from(buf).toString('base64'), at, info]);
    if (!ok) return json({ error: 'conflict', rev }, 409);
    return json({ rev, at });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 503);
  }
}
