// 정상 SNS 화면(11-26): 본부 오른쪽 📱 핸드폰을 누르면 핸드폰 화면처럼 정상들의 글이 흘러가요.
import { useEffect, useState } from 'react';
import { playerKeys } from '../data/looks';
import { LEADERS } from '../data/leaders';
import { countryById } from '../data/world';
import { answerPost, isArchPost, snsOf, snsSeen, type SnsPost } from '../game/leaderSns';
import type { GameState } from '../game/state';
import { fmtK } from './uiIcon';
import { Flag } from './flag';
import { Modal } from './kit';
import { PersonFace } from './People';
import type { GameActions } from './screens';

type Tab = 'all' | 'me' | 'arch';
const TABS: Array<[Tab, string]> = [
  ['all', '전체'],
  ['me', '우리 나라 언급'],
  ['arch', '🔥 숙적 설전'],
];

export function ago(ms: number): string {
  const m = Math.floor(ms / 60e3);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function who(state: GameState, id: string) {
  const mine = id === state.player.countryId;
  const title = mine ? '지도자' : (LEADERS[id]?.title ?? '정상');
  const name = mine ? state.player.name : (LEADERS[id]?.name ?? countryById(id).name);
  return { name, handle: `@${countryById(id).name}${title}`, mine };
}

function Post({ state, p, byId, onAnswer }: { state: GameState; p: SnsPost; byId: Map<number, SnsPost>; onAnswer: (id: number, counter: boolean) => void }) {
  const me = state.player.countryId;
  const w = who(state, p.from);
  const parent = p.replyTo ? byId.get(p.replyTo) : undefined;
  const canAnswer = p.to === me && !p.answered && (p.kind === 'diss' || p.kind === 'war' || p.kind === 'tariff');
  const hot = p.to === me && p.kind !== 'ally';
  return (
    <div className={`sns-post ${hot ? 'hot' : ''} ${w.mine ? 'mine' : ''}`}>
      <span className="sns-face">
        {w.mine ? (
          <PersonFace who={{ kind: 'player' }} keys={playerKeys(state.player)} fallback={<Flag id={me} />} />
        ) : (
          <PersonFace who={{ kind: 'leader', country: p.from }} keys={[`leader-${p.from}`]} fallback={<Flag id={p.from} />} />
        )}
      </span>
      <div className="sns-main">
        <div className="sns-head">
          <b>{w.name}</b>
          <span className="sns-flag">
            <Flag id={p.from} />
          </span>
          <small className="muted">
            {w.handle} · {ago(state.worldMs - p.t)}
          </small>
        </div>
        {parent && (
          <small className="sns-re muted">
            ↪ {who(state, parent.from).name}에게 답글
          </small>
        )}
        <p className="sns-text">{p.text.replace(/^"|"$/g, '')}</p>
        <div className="sns-foot">
          <small>♥ {fmtK(p.likes)}</small>
          <small>🔁 {fmtK(p.shares)}</small>
          {isArchPost(p) && <small className="sns-tag">🔥 숙적</small>}
          {p.kind === 'tariff' && <small className="sns-tag">📦 관세</small>}
          {p.kind === 'war' && <small className="sns-tag">⚔️ 전쟁</small>}
        </div>
        {canAnswer && (
          <div className="sns-act">
            <button className="primary small" onClick={() => onAnswer(p.id, true)}>
              🔥 맞받아치기
            </button>
            <button className="small" onClick={() => onAnswer(p.id, false)}>
              🤐 무시
            </button>
            <small className="muted">맞받아치면 명성 +3 · 긴장 +4</small>
          </div>
        )}
      </div>
    </div>
  );
}

export function SnsPhone({ state, actions, onClose }: { state: GameState; actions: GameActions; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('all');
  const [msg, setMsg] = useState('');
  const me = state.player.countryId;
  // 열면 읽음으로(본부 배지 지우기)
  useEffect(() => {
    actions.apply(snsSeen);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const posts = snsOf(state).posts;
  const byId = new Map(posts.map((p) => [p.id, p]));
  const shown = posts.filter((p) => (tab === 'me' ? p.to === me || p.from === me : tab === 'arch' ? isArchPost(p) : true));
  const onAnswer = (id: number, counter: boolean) => {
    const text = actions.applyWith((s) => {
      const r = answerPost(s, id, counter);
      return { state: r.state, out: r.text };
    });
    if (text) setMsg(text);
  };
  return (
    <Modal title="정상 SNS" icon="📱" onClose={onClose}>
      <div className="sns-phone">
        <div className="sns-bar">
          <b>🌐 World Leaders</b>
          <small className="muted">정상들이 15~30분마다 글을 올려요</small>
        </div>
        <div className="sns-tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {k === 'me' ? `📣 ${countryById(me).name} 언급` : label}
            </button>
          ))}
        </div>
        {msg && <p className="small sns-msg">{msg}</p>}
        <div className="sns-feed">
          {shown.length ? shown.map((p) => <Post key={p.id} state={state} p={p} byId={byId} onAnswer={onAnswer} />) : <p className="muted small sns-empty">아직 글이 없어요. 곧 정상들이 한마디씩 올려요.</p>}
        </div>
      </div>
    </Modal>
  );
}
