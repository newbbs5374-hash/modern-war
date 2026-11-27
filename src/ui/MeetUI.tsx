// 11-27 인물 만남(현장 만남 카드) · 부탁 · 인맥 수첩 화면. 계산은 game/meet.ts.
import { useState } from 'react';
import { Modal, Meter } from './kit';
import { Card } from './common';
import { sceneArt, SCENES } from './scenes';
import { countryFaceUrl, portraitUrl } from './Portrait';
import { lookOf } from '../game/cabinet';
import { timeLeft } from './officerScreens';
import { routeTo, type Screen } from './nav';
import type { GameState } from '../game/state';
import type { ScreenProps } from './screens';
import {
  BOND_MINE,
  BOOK_GOALS,
  BOOK_GROUPS,
  FAVORS,
  SPOTS,
  answerBond,
  answerMeet,
  bondStage,
  bookList,
  claimBook,
  dealGift,
  dropFavor,
  favorFor,
  meetOf,
  skipMeet,
  whoOf,
  willAsk,
  type Answer,
  type MeetKey,
  type Who,
} from '../game/meet';

const isNight = () => {
  const h = new Date().getHours();
  return h >= 19 || h < 6;
};

export function whoFace(w: Who | null): string | null {
  if (!w) return null;
  if (w.person) return countryFaceUrl(w.person, lookOf(w.person));
  return portraitUrl(w.faceKey, `aide-${w.name}`, `rival-${w.name}`);
}

function Face({ w, className }: { w: Who | null; className?: string }) {
  const url = whoFace(w);
  return url ? <img className={className} src={url} alt="" draggable={false} /> : <span className={`${className} meet-face-ico`}>{w?.icon ?? '👤'}</span>;
}

function BondBar({ state, k }: { state: GameState; k: string }) {
  const m = meetOf(state);
  const b = m.bond[k] ?? 0;
  const mine = m.mine.includes(k);
  const st = bondStage(b, mine);
  return (
    <div className="meet-bond">
      <div className="meet-bond-lbl">
        <span>
          {st.icon} {st.name}
        </span>
        <span>{mine ? '★ 내 사람' : `인연 ${Math.round(b)} / ${BOND_MINE}`}</span>
      </div>
      <Meter value={mine ? BOND_MINE : b} max={BOND_MINE} tone="gold" />
    </div>
  );
}

/** 현장 만남 카드(콘텐츠를 끝내면 자동으로 뜸) */
export function MeetModal({ state, apply, onClose }: { state: GameState; apply: (f: (s: GameState) => GameState) => void; onClose: () => void }) {
  const card = meetOf(state).card;
  const w = card ? whoOf(state, card.key) : null;
  if (!card || !w) return null;
  const spot = SPOTS[card.spot];
  const line = spot.lines[Math.min(2, card.step)];
  const bg = sceneArt(spot.scene, isNight());
  const pick = (a: Answer) => {
    apply((s) => answerMeet(s, a));
    onClose();
  };
  const opt = (a: Answer, icon: string, label: string) => {
    const r = answerBond(state, card, a);
    const ask = willAsk(state, card, a);
    const extra = [r.bond ? `인연 +${r.bond}${r.like ? ' (성향 맞음)' : ''}` : '인연 +0', a === 'deal' ? dealGift(state, card.spot).text : '', ask ? `📩 부탁: ${FAVORS[favorFor(state, card)].text}` : '']
      .filter(Boolean)
      .join(' · ');
    return (
      <button key={a} className="wide meet-opt" onClick={() => pick(a)}>
        <b>
          {icon} "{label}"
        </b>
        <small>{extra}</small>
      </button>
    );
  };
  return (
    <Modal title={`${spot.icon} ${spot.name} · 만남`} onClose={onClose}>
      <div className="meet-card">
        <div className="meet-scene" style={bg ? undefined : { background: SCENES[spot.scene]?.bg }}>
          {bg && <img className="meet-bg" src={bg} alt="" draggable={false} />}
          <Face w={w} className="meet-who" />
          <div className="meet-name">
            <b>{w.name}</b> · {w.icon} {w.title}
            <small>
              {w.group === '정적' ? '🎭 정적' : w.faction ?? ''} · {card.step === 0 ? '처음 만남' : `${card.step + 1}번째 만남`}
            </small>
          </div>
        </div>
        <p className="meet-say">"{line}"</p>
        {opt('warm', '🤝', spot.warm)}
        {opt('deal', '🎁', spot.deal)}
        {opt('no', '🙅', '지금은 바쁩니다.')}
        <BondBar state={state} k={card.key} />
        <p className="small muted">
          ⏳ {timeLeft(card.untilMs - state.worldMs)} 안에 고르지 않으면 지나가요. 닫아도 📒 인맥 수첩에서 다시 볼 수 있어요.
        </p>
        <button className="ghost small" onClick={() => (apply(skipMeet), onClose())}>
          그냥 지나치기
        </button>
      </div>
    </Modal>
  );
}

/** 📒 인맥 수첩(개인 → 인맥) */
export function MeetBook({ state, actions, go }: ScreenProps) {
  const m = meetOf(state);
  const [grp, setGrp] = useState<(typeof BOOK_GROUPS)[number]['id'] | 'all'>('all');
  const [cardOpen, setCardOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const goTo = (screen: string, tab: string) => go(routeTo(screen, screen, tab) as Screen);
  const cw = m.card ? whoOf(state, m.card.key) : null;
  const groups = grp === 'all' ? BOOK_GROUPS.map((g) => g.id) : [grp];
  const all = groups.flatMap((g) => bookList(state, g));
  const rank = (w: Who) => (m.mine.includes(w.key) ? 0 : m.met.includes(w.key) ? 1 : 2);
  const list = all.sort((a, b) => rank(a) - rank(b) || (m.bond[b.key] ?? 0) - (m.bond[a.key] ?? 0)).slice(0, grp === 'all' ? 60 : 80);
  const selW = sel ? whoOf(state, sel) : null;
  const hint = (w: Who) => BOOK_GROUPS.find((g) => g.id === w.group)?.hint ?? '';
  return (
    <>
      {m.card && cw && (
        <Card title="지금 기다리는 사람" icon="💬">
          <button className="wide meet-wait" onClick={() => setCardOpen(true)}>
            <Face w={cw} className="meet-mini" />
            <span>
              <b>{cw.name}</b> · {cw.title}
              <small>
                {SPOTS[m.card.spot].icon} {SPOTS[m.card.spot].name} · {timeLeft(m.card.untilMs - state.worldMs)} 남음
              </small>
            </span>
          </button>
        </Card>
      )}
      {cardOpen && <MeetModal state={state} apply={actions.apply} onClose={() => setCardOpen(false)} />}

      <Card title={`받은 부탁 ${m.favors.length}`} icon="📩" help={<p>두 번째 만남부터 인물이 부탁을 해요. 실제 24시간 안에 들어주면 인연 +30, 못 하면 −10.</p>}>
        {!m.favors.length && <p className="small muted">아직 받은 부탁이 없어요. 같은 사람을 두 번 만나면 부탁을 건네요.</p>}
        {m.favors.map((f) => {
          const w = whoOf(state, f.key);
          const d = FAVORS[f.id];
          return (
            <div key={f.key} className="meet-favor">
              <Face w={w} className="meet-mini" />
              <div className="meet-favor-body">
                <b>{d.text}</b>
                <small>
                  {w?.name} · "{d.ask}"
                </small>
                <small className="muted">
                  {f.have}/{d.need} · ⏳ {timeLeft(f.untilMs - state.worldMs)}
                </small>
                <div className="meet-favor-btns">
                  <button className="small" onClick={() => goTo(d.go[0], d.go[1])}>
                    ➡️ 바로 가기
                  </button>
                  <button className="ghost small" onClick={() => actions.apply((s) => dropFavor(s, f.key as MeetKey))}>
                    거절
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      <Card title={`📒 인맥 수첩 · 만난 사람 ${m.met.length} · 내 사람 ${m.mine.length}`} icon="👥" help={<p>법안 통과·도시 점령·시설 올리기·정상회담 같은 일을 끝내면 그 자리에 있던 인물이 말을 걸어와요. 인연 100이면 내 사람이 되어 영입비 없이 들어오고 충성 80으로 시작해요.</p>}>
        <div className="meet-tabs">
          <button className={grp === 'all' ? 'on' : ''} onClick={() => setGrp('all')}>
            전부
          </button>
          {BOOK_GROUPS.map((g) => (
            <button key={g.id} className={grp === g.id ? 'on' : ''} onClick={() => setGrp(g.id)}>
              {g.icon} {g.id}
            </button>
          ))}
        </div>
        <div className="meet-grid">
          {list.map((w) => {
            const mine = m.mine.includes(w.key);
            const met = m.met.includes(w.key);
            return (
              <button key={w.key} className={`meet-cell${mine ? ' mine' : ''}${met ? '' : ' no'}`} onClick={() => setSel(w.key)}>
                <Face w={w} className="meet-cell-face" />
                <b>{met ? w.name : '???'}</b>
                <small>{mine ? '★ 내 사람' : met ? `인연 ${Math.round(m.bond[w.key] ?? 0)}` : w.title}</small>
              </button>
            );
          })}
        </div>
        {!list.length && <p className="small muted">이 묶음에는 아직 사람이 없어요.</p>}
      </Card>

      <Card title="모으기 보상" icon="🎁">
        {BOOK_GOALS.map((g) => {
          const [have, need] = g.prog(m);
          const got = m.got.includes(g.id);
          return (
            <div key={g.id} className="meet-goal">
              <span>
                {g.icon} {g.text} <small className="muted">💎{g.ruby} · ⏩{g.boosts}</small>
              </span>
              <span className="meet-goal-r">
                <small>
                  {Math.min(have, need)}/{need}
                </small>
                <button className="small" disabled={got || have < need} onClick={() => actions.apply((s) => claimBook(s, g.id))}>
                  {got ? '받음' : '받기'}
                </button>
              </span>
            </div>
          );
        })}
      </Card>

      {!!m.log.length && (
        <Card title="최근 인연 소식" icon="📰">
          {m.log.slice(0, 8).map((t, i) => (
            <p key={i} className="small">
              {t}
            </p>
          ))}
        </Card>
      )}

      {selW && (
        <Modal title={m.met.includes(selW.key) ? selW.name : '아직 못 만난 사람'} icon={selW.icon} onClose={() => setSel(null)}>
          <div className="meet-sel">
            <Face w={selW} className={`meet-sel-face${m.met.includes(selW.key) ? '' : ' no'}`} />
            <p>
              <b>{selW.title}</b> {selW.faction ? `· ${selW.faction}` : ''}
            </p>
            <BondBar state={state} k={selW.key} />
            <p className="small muted">
              {m.mine.includes(selW.key)
                ? '내 사람이에요. 개인 → 인재 → 내 사람에서 장관·참모·장군 자리에 앉힐 수 있어요.'
                : `만날 수 있는 곳: ${hint(selW)}. 만난 횟수 ${m.times[selW.key] ?? 0}번.`}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

/** 위 아이콘 배지 */
export function meetBadge(s: GameState): number | null {
  const m = s.meet;
  if (!m) return null;
  const ready = BOOK_GOALS.filter((g) => !m.got.includes(g.id) && g.prog(m)[0] >= g.prog(m)[1]).length;
  return (m.card ? 1 : 0) + ready || null;
}
