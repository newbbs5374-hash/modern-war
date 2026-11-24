// 지금 로그인했는지
import { json, readSess, ready } from './_lib.js';

export async function GET(req: Request): Promise<Response> {
  const s = await readSess(req);
  return json({ ready: ready(), in: !!s, nick: s?.n ?? '' });
}
