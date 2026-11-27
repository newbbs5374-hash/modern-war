// 11-27 한 손가락 미니 훈련(2차 ③) — "고르기" 10개: 장면 그림 + 보기 셋.
import { useRef, useState } from 'react';
import { Hud, useRng, type MiniProps } from './kit';
import { sceneArt, SCENES } from '../../scenes';
import { JUGGLE_ADD, QUIZ_INFO, juggleScore, juggleStart, juggleStep, quizSet, type QuizKind } from '../../../battle/easyQuiz';

function Head({ scene, night, text }: { scene: string; night?: boolean; text: string }) {
  const art = sceneArt(scene, !!night);
  return (
    <div className="eg-qhead" style={art ? { backgroundImage: `url(${art})` } : { background: SCENES[scene]?.bg }}>
      <b>{text}</b>
    </div>
  );
}

function QuizGame({ seed, report, finish, kind }: MiniProps & { kind: QuizKind }) {
  const rng = useRng(seed);
  const ROUNDS = 5;
  const set = useRef(quizSet(kind, rng, ROUNDS)).current;
  const info = QUIZ_INFO[kind];
  const [st, setSt] = useState({ n: 0, ok: 0, pick: -1 });
  const q = set[Math.min(st.n, set.length - 1)];
  const choose = (i: number) => {
    if (st.pick >= 0) return;
    const ok = st.ok + (i === q.ok ? 1 : 0);
    setSt({ ...st, pick: i, ok });
    report(ok / ROUNDS);
    setTimeout(() => {
      if (st.n + 1 >= ROUNDS) return finish(ok / ROUNDS);
      setSt({ n: st.n + 1, ok, pick: -1 });
    }, 1500);
  };
  return (
    <>
      <Hud items={[['문제', `${st.n + 1}/${ROUNDS}`], ['맞힘', st.ok]]} />
      <div className="mg-stage eg-liar eg-quiz">
        <Head scene={info.scene} night={info.night} text={info.ask} />
        {q.head && <p className="eg-qme">{q.head}</p>}
        <p className="eg-qq">{q.q}</p>
        {q.opts.map((f, i) => (
          <button key={`${st.n}-${i}`} className={st.pick < 0 ? '' : i === q.ok ? 'good' : i === st.pick ? 'bad' : 'dim'} onClick={() => choose(i)}>
            {f}
          </button>
        ))}
        <p className="eg-liar-a">{st.pick < 0 ? ' ' : st.pick === q.ok ? `✅ 맞아요 · ${q.why}` : `❌ 아니에요 · ${q.why}`}</p>
      </div>
    </>
  );
}

interface JuggleSkin { scene: string; night?: boolean; ask: string; items: Array<[string, string]>; unit: string; turns: number; act: string }
function JuggleGame({ level, seed, report, finish, skin }: MiniProps & { skin: JuggleSkin }) {
  const rng = useRng(seed);
  const [j, setJ] = useState(() => juggleStart(rng, level));
  const [flash, setFlash] = useState(-1);
  const pick = (i: number) => {
    if (j.turn >= skin.turns) return;
    const n = juggleStep(j, i, rng, level);
    setJ(n);
    setFlash(i);
    report(juggleScore(n, skin.turns));
    if (n.turn >= skin.turns) setTimeout(() => finish(juggleScore(n, skin.turns)), 700);
  };
  return (
    <>
      <Hud items={[[skin.unit, `${Math.min(skin.turns, j.turn + 1)}/${skin.turns}`], ['바닥남', j.fails]]} />
      <div className="mg-stage eg-liar eg-quiz">
        <Head scene={skin.scene} night={skin.night} text={skin.ask} />
        <div className="eg-jug">
          {skin.items.map(([icon, name], i) => (
            <button key={i} className={flash === i ? 'on' : ''} onClick={() => pick(i)}>
              <span className="eg-jug-ic">{icon}</span>
              <b>{name}</b>
              <i className="eg-jug-bar">
                <em style={{ height: `${j.v[i]}%`, background: j.v[i] - j.next[i] <= 0 ? '#ff5a4a' : j.v[i] < 40 ? '#ffb020' : '#5dff8a' }} />
              </i>
              <small>{j.v[i]}</small>
              <small className="eg-jug-next">다음 −{j.next[i]}</small>
              <span className="eg-jug-act">{skin.act} +{JUGGLE_ADD}</span>
            </button>
          ))}
        </div>
        <p className="eg-liar-a">빨간 막대는 이번에 안 챙기면 바닥나요. 하나만 고를 수 있어요.</p>
      </div>
    </>
  );
}

const quiz = (kind: QuizKind) => (p: MiniProps) => <QuizGame {...p} kind={kind} />;
export const EDisguise = quiz('disguise');
export const EPredict = quiz('predict');
export const EReview = quiz('review');
export const EMole = quiz('mole');
export const EMind = quiz('mind');
export const ESpeech = quiz('speech');
export const EJudge = quiz('judge');
export const ESchool = quiz('school');
export const ECold = (p: MiniProps) => <JuggleGame {...p} skin={{ scene: 'disaster', night: true, ask: '혹한의 밤, 지금 챙길 것 하나를 골라요', items: [['🔥', '체온'], ['🍲', '식량'], ['😴', '잠']], unit: '시간', turns: 9, act: '챙기기' }} />;
export const EDepot = (p: MiniProps) => <JuggleGame {...p} skin={{ scene: 'factory', ask: '전선에 이번에 보낼 것 하나를 골라요', items: [['🧨', '탄약'], ['🍞', '식량'], ['⛽', '연료']], unit: '날', turns: 9, act: '보내기' }} />;
