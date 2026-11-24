// 대통령실 참모진 · 국무총리 · 기관장 화면(11-24 대장 요청 "참모진 직급 세분화·임명 직책 반영").
// 개인 → 대통령실 탭. 실마다 자리 카드 → 누르면 자리 창(효과·지금 사람·추천 후보 바로 임명).
import { useState } from 'react';
import { EFF_INFO, HEAD_BOOST, GUARD_COUNTER_AT, OFFICES, POSTS, effLine, postById, postsOf, type OfficeId, type PostEff, type PostId } from '../data/staff';
import {
  appointPost,
  autoFillOffice,
  cabinetOf,
  canAppointPost,
  personPostPower,
  postCandidates,
  postCount,
  postEff,
  postHolder,
  postPower,
  unpost,
  type Person,
} from '../game/cabinet';
import type { GameState } from '../game/state';
import { Card } from './common';
import { Help, Modal } from './kit';
import { PersonFace, PersonModal } from './CabinetUI';
import { useTab } from './kit';
import type { ScreenProps } from './screens';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** 지금 대통령실·기관장 효과 모음(0이 아닌 것만) */
function effSummary(s: GameState): string[] {
  return (Object.keys(EFF_INFO) as PostEff[])
    .map((k) => {
      const v = postEff(s, k);
      if (!v) return null;
      const info = EFF_INFO[k];
      return `${info.name} +${info.pct ? `${Math.round(v * 1000) / 10}%` : Math.round(v * 10) / 10}`;
    })
    .filter(Boolean) as string[];
}

export function StaffPanel(props: ScreenProps) {
  const { state, actions } = props;
  const c = cabinetOf(state);
  const [office, setOffice] = useTab<OfficeId>('staff-office', 'sec');
  const [open, setOpen] = useState<PostId | null>(null);
  const of = OFFICES.find((o) => o.id === office) ?? OFFICES[0];
  const posts = postsOf(of.id);
  const free = c.people.filter((p) => p.group === '내각' && !p.seat && !p.post).length;
  const empty = posts.filter((p) => !postHolder(c, p.id)).length;
  const sum = effSummary(state);
  return (
    <>
      <Card
        title={`대통령실·기관장 ${postCount(c)}/${POSTS.length}`}
        icon="🏢"
        right={
          <Help title="대통령실 참모진">
            <p>실제 대통령실처럼 비서실·정책실·국가안보실 3실장과 수석비서관, 안보실 차장, 경호처장을 둬요. 국무총리와 기관장(검찰총장·경찰청장·국세청장·감사원장·한국은행 총재·방위사업청장)도 여기서 임명해요.</p>
            <p>👤 영입한 내 사람만 앉힐 수 있어요(개인 → 인재). 청문회 없이 바로 임명돼요. 장관·차관과 겹쳐 앉을 수는 없어요.</p>
            <p>💪 자리 힘 = 보는 스탯 2개 평균 ÷ 12(보통 사람 100%). 특화가 맞으면 ×1.3, 충성 80↑ ×1.1, 30↓ 절반.</p>
            <p>🗝️ 실장 덤: 비서실장·정책실장·안보실장의 힘 1(100%)마다 그 실 참모 힘 +{Math.round(HEAD_BOOST * 100)}%.</p>
            <p>🕶️ 경호처장 힘이 {pct(GUARD_COUNTER_AT)} 넘으면 정적의 방해 공작을 막아요.</p>
            <p>🏛️ 국무총리는 모든 장관의 힘을 올려 줘요.</p>
          </Help>
        }
      >
        <p className="small muted" style={{ margin: '0 0 4px' }}>
          {sum.length ? `📈 ${sum.join(' · ')}` : '아직 비어 있어요. 내 사람을 자리에 앉혀 보세요.'}
        </p>
        <div className="seg cab-seg">
          {OFFICES.map((o) => {
            const n = postsOf(o.id).filter((p) => postHolder(c, p.id)).length;
            return (
              <button key={o.id} className={o.id === of.id ? 'on' : ''} onClick={() => setOffice(o.id)}>
                {o.icon}
                {o.name.replace('·기관장', '')} {n}/{postsOf(o.id).length}
              </button>
            );
          })}
        </div>
        <p className="small" style={{ margin: '2px 0 4px' }}>
          {of.text}
        </p>
        <div className="cab-mins staff-grid">
          {posts.map((p) => {
            const h = postHolder(c, p.id);
            const head = of.head === p.id;
            return (
              <button key={p.id} className={`cab-min${head ? ' staff-head' : ''}`} onClick={() => setOpen(p.id)}>
                <span className="cab-min-ico">{h ? <PersonFace p={h} size={30} /> : p.icon}</span>
                <span className="cab-main">
                  <b>
                    {p.icon} {p.name}
                  </b>
                  <small>{h ? h.name : '빈 자리'}</small>
                  <small className="muted">{p.role}</small>
                </span>
                <b className="cab-pow">{h ? pct(postPower(state, p.id)) : '-'}</b>
              </button>
            );
          })}
        </div>
        {empty > 0 && (
          <button className="wide" disabled={!free} onClick={() => actions.apply((s) => autoFillOffice(s, of.id))}>
            ✨ 빈 자리 {empty}곳 추천 인물로 채우기 <small>{free ? `쉬는 내 사람 ${free}명` : '쉬는 내 사람이 없어요(인재 탭에서 영입)'}</small>
          </button>
        )}
      </Card>
      {open && <PostModal state={state} actions={actions} id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function PostModal({ state, actions, id, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { id: PostId; onClose: () => void }) {
  const post = postById(id);
  const c = cabinetOf(state);
  const h = postHolder(c, id);
  const office = OFFICES.find((o) => o.id === post.office)!;
  const cands = postCandidates(state, id, 4);
  const [who, setWho] = useState<number | null>(null);
  const pw = postPower(state, id);
  const row = (p: Person, right: React.ReactNode) => (
    <div key={p.id} className="cab-cand">
      <button className="cab-row" onClick={() => setWho(p.id)}>
        <PersonFace p={p} />
        <span className="cab-main">
          <b>{p.name}</b>
          <small>
            {p.spec} · {p.trait} · 충성 {Math.round(p.loyalty)}
          </small>
        </span>
      </button>
      <span className="cab-cand-acts">{right}</span>
    </div>
  );
  return (
    <Modal title={post.name} icon={post.icon} onClose={onClose}>
      <p className="small">
        {office.icon} {office.name} · {post.level} · {post.role}
      </p>
      <div className="cab-kv small">
        <span>🎯 효과(보통 사람)</span>
        <b>{effLine(post.eff)}</b>
        <span>📊 보는 스탯</span>
        <b>
          {post.stats.join('·')} · 특화 {post.spec.join('·')}
        </b>
        {h && (
          <>
            <span>💪 지금 힘</span>
            <b>
              {pct(pw)} → {effLine(post.eff, pw)}
            </b>
          </>
        )}
        {office.head === id && (
          <>
            <span>🗝️ 실장 덤</span>
            <b>
              {office.name} 참모 힘 +{Math.round((h ? personPostPower(h, id) : 1) * HEAD_BOOST * 100)}%
            </b>
          </>
        )}
        {id === 'guard' && (
          <>
            <span>🧲 방첩</span>
            <b>{pw >= GUARD_COUNTER_AT ? '✅ 정적 방해 공작을 막는 중' : `힘 ${pct(GUARD_COUNTER_AT)}부터 정적 방해 공작을 막음`}</b>
          </>
        )}
      </div>
      <h4 className="cab-h">지금 자리</h4>
      {h ? (
        row(h, <button onClick={() => actions.apply((s) => unpost(s, h.id))}>내리기</button>)
      ) : (
        <p className="small muted cab-empty">빈 자리예요</p>
      )}
      <h4 className="cab-h">추천 후보(쉬는 내 사람)</h4>
      {cands.map((p) =>
        row(
          p,
          <button disabled={!!canAppointPost(state, p.id, id)} onClick={() => actions.apply((s) => appointPost(s, p.id, id))}>
            {pct(personPostPower(p, id))}
            <br />
            {h ? '교체' : '임명'}
          </button>,
        ),
      )}
      {!cands.length && <p className="small muted">👤 개인 → 인재 탭에서 사람을 먼저 영입하세요. 장관·차관·다른 자리에 앉은 사람은 먼저 내려와야 해요.</p>}
      {who !== null && <PersonModal state={state} actions={actions} pid={who} onClose={() => setWho(null)} />}
    </Modal>
  );
}

/** 인물 창 안: 이 사람을 어느 자리에 앉힐지 */
export function PostPick({ state, actions, p, onDone }: Pick<ScreenProps, 'state' | 'actions'> & { p: Person; onDone: () => void }) {
  const c = cabinetOf(state);
  return (
    <div className="staff-pick">
      {OFFICES.map((o) => (
        <div key={o.id}>
          <small className="muted">
            {o.icon} {o.name}
          </small>
          <div className="cab-pick">
            {postsOf(o.id).map((post) => {
              const why = canAppointPost(state, p.id, post.id);
              const h = postHolder(c, post.id);
              const fit = post.spec.includes(p.spec);
              return (
                <button key={post.id} disabled={!!why} title={why ?? (h ? `${h.name}과(와) 교체` : '')} onClick={() => (actions.apply((s) => appointPost(s, p.id, post.id)), onDone())}>
                  <span>{post.icon}</span>
                  <small>{post.name.replace('안보실 ', '').replace('한국은행 ', '한은 ')}</small>
                  <small className={fit ? 'gold-t' : 'muted'}>
                    {pct(personPostPower(p, post.id))}
                    {h ? '·교체' : ''}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="small muted">숫자는 그 자리에서 낼 힘(100% = 보통), 노란색은 특화가 맞는 곳. 청문회 없이 바로 앉아요.</p>
    </div>
  );
}
