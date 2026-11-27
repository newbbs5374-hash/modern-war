// 정상 SNS 화면(11-26): 본부 오른쪽 📱 핸드폰을 누르면 핸드폰 화면처럼 정상들의 글이 흘러가요.
import { useEffect, useState } from 'react';
import { playerKeys } from '../data/looks';
import { LEADERS } from '../data/leaders';
import { countryById } from '../data/world';
import { answerPost, isArchPost, myCooldown, myTargets, previewPost, snsOf, snsSeen, suggestText, toneById, TONES, writePost, MY_TEXT_MAX, type MyTone, type SnsPost } from '../game/leaderSns';
import { favorName, favorOf } from '../game/civ';
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

function Post({ state, p, byId, onAnswer, onReply }: { state: GameState; p: SnsPost; byId: Map<number, SnsPost>; onAnswer: (id: number, counter: boolean) => void; onReply: (p: SnsPost) => void }) {
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
          {p.tone && <small className="sns-tag mine">{toneById(p.tone).icon} {toneById(p.tone).name}</small>}
          {!w.mine && myTargets(state).includes(p.from) && (
            <button className="sns-re-btn" onClick={() => onReply(p)}>
              ✍️ 답글
            </button>
          )}
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

type Draft = { to?: string; tone: MyTone; text: string; edited: boolean; n: number; replyTo?: number };

function Composer({ state, draft, setDraft, onSend, onClose }: { state: GameState; draft: Draft; setDraft: (d: Draft) => void; onSend: () => void; onClose: () => void }) {
  const t = toneById(draft.tone);
  const targets = myTargets(state);
  const pv = previewPost(state, draft.tone, draft.to);
  const cd = myCooldown(state);
  const need = t.side !== 'self' && !draft.to;
  const re = (d: Partial<Draft>) => {
    const nd = { ...draft, ...d };
    if (!nd.edited) nd.text = suggestText(state, nd.tone, toneById(nd.tone).side === 'self' ? undefined : nd.to, nd.n);
    setDraft(nd);
  };
  const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  return (
    <div className="sns-compose">
      <div className="sns-c-head">
        <b>✍️ 내 글 쓰기</b>
        <button className="small" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="sns-tones">
        {TONES.map((x) => (
          <button key={x.id} className={`t-${x.side} ${draft.tone === x.id ? 'on' : ''}`} onClick={() => re({ tone: x.id })}>
            <span>{x.icon}</span>
            {x.name}
          </button>
        ))}
      </div>
      {t.side !== 'self' && (
        <div className="sns-targets">
          {targets.map((id) => {
            const f = favorName(favorOf(state, id));
            return (
              <button key={id} className={draft.to === id ? 'on' : ''} onClick={() => re({ to: id, replyTo: draft.to === id ? draft.replyTo : undefined })}>
                <Flag id={id} />
                <small>{countryById(id).name}</small>
                <i title={f.name}>{f.icon}</i>
              </button>
            );
          })}
        </div>
      )}
      <textarea className="sns-input" maxLength={MY_TEXT_MAX} rows={3} value={draft.text} placeholder={need ? '먼저 나라를 골라 주세요' : '하고 싶은 말을 써 보세요'} onChange={(e) => setDraft({ ...draft, text: e.target.value, edited: true })} />
      <div className="sns-c-row">
        <button className="small" onClick={() => setDraft({ ...draft, edited: false, n: draft.n + 1, text: suggestText(state, draft.tone, t.side === 'self' ? undefined : draft.to, draft.n + 1) })}>
          🔄 다른 문구
        </button>
        <small className="muted">
          {draft.text.length}/{MY_TEXT_MAX}
        </small>
      </div>
      <p className="sns-pv small">
        {t.icon} <b>{t.name}</b> · {t.hint}
        <br />
        {t.side === 'self' ? (
          <>지지도 +1 · 명성 +{pv.fame}</>
        ) : !draft.to ? (
          <span className="muted">👆 글을 보낼 나라를 골라 주세요</span>
        ) : (
          <>
            {countryById(draft.to).name} 호감 <b className={pv.favor > 0 ? 'up' : 'down'}>{sign(pv.favor)}</b> · 긴장 {sign(pv.tension)} · 명성 +{pv.fame}
            {pv.rivalIds.length > 0 && pv.rivals !== 0 && (
              <>
                <br />
                숙적 {pv.rivalIds.map((r) => countryById(r).name).join('·')} 호감 <b className={pv.rivals > 0 ? 'up' : 'down'}>{sign(pv.rivals)}</b>
              </>
            )}
            {pv.mult < 1 && <small className="muted"> (같은 나라에 자주 쓰면 효과 절반)</small>}
            {pv.mult > 1 && <small className="up"> (효과 2배!)</small>}
          </>
        )}
      </p>
      <button className="primary" disabled={need || cd > 0} onClick={onSend}>
        {cd > 0 ? `⏳ ${Math.ceil(cd / 60e3)}분 뒤에 쓸 수 있어요` : '📤 올리기'}
      </button>
    </div>
  );
}

export function SnsPhone({ state, actions, onClose }: { state: GameState; actions: GameActions; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('all');
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
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
  const openDraft = (to?: string, tone: MyTone = 'praise', replyTo?: number) => {
    const side = toneById(tone).side;
    setDraft({ to, tone, replyTo, edited: false, n: 0, text: to || side === 'self' ? suggestText(state, tone, side === 'self' ? undefined : to, 0) : '' });
  };
  const onReply = (p: SnsPost) => {
    const bad = p.to === me && (p.kind === 'diss' || p.kind === 'war' || p.kind === 'tariff' || p.kind === 'reply');
    openDraft(p.from, bad ? 'criticize' : p.kind === 'ally' ? 'thanks' : 'praise', p.id);
  };
  const onSend = () => {
    if (!draft) return;
    const text = actions.applyWith((s) => {
      const r = writePost(s, draft.tone, draft.to, draft.text, draft.replyTo);
      return { state: r.state, out: r.text };
    });
    if (text) setMsg(text);
    if (text && !text.startsWith('⏳') && !text.startsWith('글을')) {
      setDraft(null);
      setTab('all');
    }
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
        {draft ? (
          <Composer state={state} draft={draft} setDraft={setDraft} onSend={onSend} onClose={() => setDraft(null)} />
        ) : (
          <button className="primary sns-write" onClick={() => openDraft()}>
            ✍️ 내 글 쓰기 <small>칭찬·응원·감사·비판·조롱·경고·자랑</small>
          </button>
        )}
        {msg && <p className="small sns-msg">{msg}</p>}
        <div className="sns-feed">
          {shown.length ? shown.map((p) => <Post key={p.id} state={state} p={p} byId={byId} onAnswer={onAnswer} onReply={onReply} />) : <p className="muted small sns-empty">아직 글이 없어요. 곧 정상들이 한마디씩 올려요.</p>}
        </div>
      </div>
    </Modal>
  );
}
