// 카카오 로그인 + 서버 저장(11/24). 휴대폰·집 PC·회사 PC 어디서 열어도 같은 판을 이어 한다.
// 기기 안 저장(save.ts)은 그대로 두고, 그 위에 서버 저장을 하나 더 얹는다.
// - 버튼으로 뭔가 바꾸면(직접 한 일) 몇 초 뒤 서버로 올림. 시간만 흐른 것은 올리지 않음(어느 기기든 시계로 계산됨).
// - 창을 다시 볼 때·처음 열 때 서버 번호(rev)를 확인해서, 다른 기기가 더 나중에 했으면 그걸 받아 옴.
// - 서로 다른 판(이름·나라·세계가 다름)이면 묻는다.

import type { GameState } from './state';
import { parseSave } from './save';
import { gameClock } from './state';

/** 서버에 판 정보(목록에 보여 줄 것·같은 판인지 확인용) */
export interface CloudInfo {
  name: string;
  country: string;
  day: number;
  /** 저장 시각(lastRealTime) */
  at: number;
  /** 마지막으로 직접 한 일 시각 */
  actAt: number;
  seed: number;
}

/** 이 기기가 서버와 맞춘 기록(기기 안에 둠) */
export interface CloudMeta {
  /** 마지막으로 맞춘 서버 번호. 한 번도 안 맞췄으면 null */
  rev: number | null;
  /** 서버에 아직 안 올린 직접 한 일이 있음 */
  dirty: boolean;
  /** 마지막으로 직접 한 일 시각 */
  actAt: number;
}

export interface ServerHead {
  rev: number;
  at?: number;
  info?: CloudInfo | null;
}

export type Decision = 'none' | 'upload' | 'adopt' | 'ask' | 'force';

export function infoOf(s: GameState, actAt: number): CloudInfo {
  return {
    name: s.player.name,
    country: s.player.countryId,
    day: gameClock(s.worldMs).dayNumber,
    at: s.lastRealTime,
    actAt,
    seed: s.world.seed,
  };
}

export function sameGame(a: CloudInfo, b: CloudInfo | null | undefined): boolean {
  return !!b && a.seed === b.seed && a.name === b.name && a.country === b.country;
}

/** 이 기기 저장과 서버 저장을 견줘서 할 일 정하기 */
export function decide(local: GameState | null, meta: CloudMeta, server: ServerHead): Decision {
  if (!server.rev) return local ? 'upload' : 'none';
  if (!local) return 'adopt';
  if (meta.rev === server.rev) return meta.dirty ? 'upload' : 'none';
  const li = infoOf(local, meta.actAt);
  if (!sameGame(li, server.info)) return 'ask';
  const localAct = meta.actAt || local.lastRealTime;
  const serverAct = server.info?.actAt || server.info?.at || server.at || 0;
  if (meta.rev === null) return serverAct >= localAct ? 'adopt' : 'force';
  return meta.dirty && localAct > serverAct ? 'force' : 'adopt';
}

/* ───────── 압축(저장 약 90KB → 20KB) ───────── */
async function pipe(bytes: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(t));
  return new Uint8Array(await out.arrayBuffer());
}
export const gzip = (text: string) => pipe(new TextEncoder().encode(text), new CompressionStream('gzip'));
export async function gunzip(bytes: Uint8Array): Promise<string> {
  return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('gzip')));
}
export function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/* ───────── 이 기기 기록 ───────── */
const META_KEY = 'modern-war-cloud';
export function readMeta(): CloudMeta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || 'null') as CloudMeta | null;
    if (m && typeof m === 'object') return { rev: typeof m.rev === 'number' ? m.rev : null, dirty: !!m.dirty, actAt: Number(m.actAt) || 0 };
  } catch {
    /* 없음 */
  }
  return { rev: null, dirty: false, actAt: 0 };
}
export function writeMeta(m: CloudMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* 무시 */
  }
}

/* ───────── 화면에 보여 줄 상태(작은 가게) ───────── */
export interface CloudView {
  /** checking 확인 중 · off 서버 준비 안 됨 · out 로그인 안 함 · in 로그인함 */
  status: 'checking' | 'off' | 'out' | 'in';
  nick: string;
  /** 마지막으로 서버와 맞춘 시각(이 기기 기준) */
  syncedAt: number;
  busy: boolean;
  /** 서버 저장 정보(시작 화면에서 '이어 하기'로 보여 줌) */
  server: ServerHead | null;
  error: string;
}
let view: CloudView = { status: 'checking', nick: '', syncedAt: 0, busy: false, server: null, error: '' };
const subs = new Set<() => void>();
export const cloudView = () => view;
export function subscribeCloud(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}
function setView(p: Partial<CloudView>) {
  view = { ...view, ...p };
  subs.forEach((f) => f());
}

/* ───────── 서버와 주고받기 ───────── */
async function getJson<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T | null }> {
  const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  const ct = r.headers.get('content-type') ?? '';
  return { status: r.status, body: ct.includes('json') ? ((await r.json()) as T) : null };
}

/** 로그인했는지 확인 */
export async function checkLogin(): Promise<CloudView['status']> {
  try {
    const { body } = await getJson<{ ready: boolean; in: boolean; nick: string }>('/api/me');
    const st: CloudView['status'] = !body || !body.ready ? 'off' : body.in ? 'in' : 'out';
    setView({ status: st, nick: body?.nick ?? '' });
    return st;
  } catch {
    setView({ status: 'off' });
    return 'off';
  }
}

export async function fetchHead(): Promise<ServerHead | null> {
  const { status, body } = await getJson<ServerHead>('/api/save?head=1');
  if (status === 401) setView({ status: 'out' });
  if (status !== 200 || !body) return null;
  setView({ server: body });
  return body;
}

export async function fetchSave(): Promise<{ head: ServerHead; state: GameState | null } | null> {
  const { status, body } = await getJson<ServerHead & { data?: string }>('/api/save');
  if (status !== 200 || !body) return null;
  const head = { rev: body.rev, at: body.at, info: body.info };
  setView({ server: head });
  if (!body.data) return { head, state: null };
  try {
    return { head, state: parseSave(await gunzip(fromB64(body.data))) };
  } catch {
    return { head, state: null };
  }
}

/** 올리기. 다른 기기가 먼저 바꿨으면 'conflict' */
export async function pushSave(s: GameState, meta: CloudMeta, force = false): Promise<'ok' | 'conflict' | 'fail'> {
  try {
    const body = await gzip(JSON.stringify(s));
    const { status, body: r } = await getJson<{ rev: number; at: number }>('/api/save', {
      method: 'PUT',
      keepalive: body.length < 60000,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Base-Rev': force ? '-1' : String(meta.rev ?? 0),
        'X-Info': encodeURIComponent(JSON.stringify(infoOf(s, meta.actAt))),
      },
      body: body as BodyInit,
    });
    if (status === 409) return 'conflict';
    if (status === 401) setView({ status: 'out' });
    if (status !== 200 || !r) return 'fail';
    const cur = readMeta();
    // 올리는 사이 또 직접 한 일이 생겼으면 dirty 유지
    writeMeta({ rev: r.rev, dirty: cur.actAt > meta.actAt, actAt: cur.actAt });
    setView({ syncedAt: Date.now(), server: { rev: r.rev, at: r.at, info: infoOf(s, meta.actAt) }, error: '' });
    return 'ok';
  } catch {
    return 'fail';
  }
}

export async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* 무시 */
  }
  writeMeta({ ...readMeta(), rev: null });
  setView({ status: 'out', nick: '', server: null, syncedAt: 0 });
}

export function loginUrl() {
  return '/api/kakao/login';
}

export function setCloudBusy(busy: boolean, error = '') {
  setView({ busy, error });
}

/** 카카오에서 돌아왔을 때 주소에 붙은 결과 읽고 지우기 */
export function takeLoginResult(): { ok: boolean; why: string } | null {
  try {
    const q = new URLSearchParams(location.search);
    const k = q.get('kakao');
    if (!k) return null;
    const why = q.get('why') ?? '';
    q.delete('kakao');
    q.delete('why');
    const rest = q.toString();
    history.replaceState(history.state, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
    return { ok: k === 'ok', why };
  } catch {
    return null;
  }
}

export function cloudLabel(i: CloudInfo | null | undefined, countryName: (id: string) => string): string {
  if (!i) return '서버 저장';
  const when = new Date(i.actAt || i.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${countryName(i.country)} ${i.name} · ${i.day}일째 · ${when}`;
}
