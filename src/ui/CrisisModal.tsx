// 돌발 사건 카드 창
import { Modal } from './kit';
import { timeLeft } from './officerScreens';
import { canChoose, chooseCrisis, crisisById, crisisOf, fill, fxText } from '../game/crisis';
import { FLAG } from './flag';
import type { GameState } from '../game/state';
import { METER_TEXT, SAGA_DAYS, sagaEndText, sagaInfo } from '../game/saga';
import { crisisArt, sceneArt } from './scenes';
import type { CrisisOption, Fx } from '../game/crisis';
import { advisorOf, type AdviceField } from '../game/advice';
import { PersonFace } from './CabinetUI';

// 11/28 디자인 개편 5단계: 결정 카드. 위 절반 장면 그림 + 굵은 제목, 선택마다 결과 딱지(+/−)를 고르기 전에 보여 주고,
// 담당 장관 추천 1개 + 다른 장관 생각 2개(프로스트펑크 2 회의 방식).
const SCENE_BY: Array<[RegExp, string]> = [
  [/파업|노조|임금/, 'strike'],
  [/시위|집회|폭동|반정부/, 'protest'],
  [/지진|홍수|태풍|산불|재난|사고|폭발/, 'disaster'],
  [/병원|감염|전염|백신|보건/, 'hospital'],
  [/학교|교육|학생/, 'school'],
  [/정상|회담|외교|대사|조약|협정/, 'summit'],
  [/의회|국회|법안|탄핵/, 'assembly'],
  [/공장|산업|기업|반도체/, 'factory'],
  [/항구|해군|함정|선박|바다|해상/, 'port'],
  [/미사일|도발|포격|전투기|영공|공군|군사|국경|침범/, 'airbase'],
  [/기자|언론|보도|스캔들|폭로/, 'press'],
];
export function crisisScene(text: string, night: boolean): string | null {
  const hit = SCENE_BY.find(([re]) => re.test(text));
  return sceneArt(hit ? hit[1] : 'cabinet', night);
}
/** 효과 하나의 좋고 나쁨(+1 좋음, -1 나쁨) */
const goodSign = (f: Fx) => (f.k === 'tension' ? -Math.sign(f.v) : Math.sign((f as { v: number }).v));
export function fxChips(fx: Fx[], target: string | null, isle?: string): Array<[string, string]> {
  const parts = fxText(fx, target, isle).split(' · ');
  return fx.map((f, i) => [goodSign(f) > 0 ? 'up' : goodSign(f) < 0 ? 'dn' : '', parts[i] ?? '']);
}
const W: Partial<Record<Fx['k'], number>> = { isle: 0.3, money: 1 / 3000, troops: 120, trust: 0.6, fame: 0.08, approval: 0.7, favor: 0.15, tension: 0.12, intel: 0.1, boost: 2, research: 0.4, merit: 0.05, res: 0.05 };
const scoreOf = (opt: CrisisOption, only?: Fx['k'][]) => opt.fx.reduce((a, f) => (only && !only.includes(f.k) ? a : a + goodSign(f) * Math.abs((f as { v: number }).v) * (W[f.k] ?? 0.1)), 0);


export function CrisisModal({ state, apply, onClose }: { state: GameState; apply: (f: (s: GameState) => GameState) => void; onClose: () => void }) {
  const o = crisisOf(state).open;
  if (!o) return null;
  const d = crisisById(o.def);
  const art = o.def.startsWith('fin-') ? crisisArt(o.def.slice(4) as 'coalition' | 'nuke' | 'coup') : null;
  const sg = sagaInfo(state, o.def);
  const night = new Date().getHours() < 6 || new Date().getHours() >= 19;
  const pic = art ?? crisisScene(`${d.title} ${d.text}`, night);
  const ok = d.options.map((opt) => !canChoose(state, opt));
  const bestBy = (only?: Fx['k'][]) => {
    let bi = -1;
    d.options.forEach((opt, i) => {
      if (ok[i] && (bi < 0 || scoreOf(opt, only) > scoreOf(d.options[bi], only))) bi = i;
    });
    return bi;
  };
  const rec = bestBy();
  const field: AdviceField = d.options.some((o2) => o2.fx.some((f) => f.k === 'troops' || f.k === 'tension')) ? 'defense' : 'society';
  const lead = advisorOf(state, field);
  const others: Array<{ who: string; f: AdviceField; pick: number; why: string }> = [
    { who: '경제', f: 'economy', pick: bestBy(['money', 'res']), why: '돈·자원에 가장 좋아요' },
    { who: '외교', f: 'diplo', pick: bestBy(['favor', 'tension']), why: '다른 나라 관계에 가장 좋아요' },
  ];
  return (
    <Modal title={d.title} icon={d.icon} onClose={onClose}>
      <div className="crisis gx-crisis">
        {pic && (
          <div className="gx-crisis-art">
            <img src={pic} alt="" draggable={false} />
            <span className="gx-crisis-tags">
              <span className="gx-chip dn">⚠ 결정 필요</span>
              <span className="gx-chip">⏱ {timeLeft(o.untilMs - state.worldMs)}</span>
            </span>
            <b className="gx-title">{d.title}</b>
          </div>
        )}
        {sg && (
          <div className={`saga-bar saga-${sg.grade}`}>
            <b>
              📚 연속 위기 · {sg.day}/{SAGA_DAYS}일째
            </b>
            <span className="saga-dots">
              {Array.from({ length: SAGA_DAYS }, (_, i) => (
                <i key={i} className={i < sg.day ? 'on' : ''} />
              ))}
            </span>
            <small>상황: {METER_TEXT[sg.grade]}</small>
            <small className="muted">고른 답이 다음 날과 마지막 결과를 바꿔요 · 잘 끝내면 {sagaEndText(sg.def, 'good')}</small>
          </div>
        )}
        <p className="gx-crisis-text">
          {o.target && <span style={{ marginRight: 4 }}>{FLAG[o.target]}</span>}
          {fill(d.text, o.target, o.isle)}
        </p>
        {rec >= 0 && (
          <div className="gx-crisis-rec">
            {lead ? <PersonFace p={lead.p} size={34} /> : <span className="gx-crisis-noface">💼</span>}
            <span>
              <b>{lead ? `${lead.where} 추천` : '비서실 추천'}</b> · {rec + 1}번 「{d.options[rec].label}」
            </span>
          </div>
        )}
        {d.options.map((opt, i) => {
          const why = canChoose(state, opt);
          return (
            <button
              key={i}
              className={`wide crisis-opt gx-opt ${i === rec ? 'rec' : ''}`}
              disabled={!!why}
              title={why ?? ''}
              onClick={() => {
                apply((s) => chooseCrisis(s, i));
                onClose();
              }}
            >
              <span className="gx-opt-head">
                <em>{'①②③④⑤'[i] ?? i + 1}</em>
                <b>{opt.label}</b>
                {i === rec && <span className="gx-opt-tag">추천</span>}
                {i === d.auto && <span className="gx-opt-auto">안 고르면 이것</span>}
              </span>
              {why ? (
                <small className="muted">{why}</small>
              ) : (
                <span className="gx-chips">
                  {fxChips(opt.fx, o.target, o.isle).map(([c, t], k) => (
                    <span key={k} className={`gx-chip ${c}`}>
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
        <p className="rec-sub" style={{ marginTop: 8 }}>다른 장관 생각</p>
        <div className="gx-crisis-others">
          {others.map((x) => {
            const a = advisorOf(state, x.f);
            return (
              <span key={x.who} className="glass">
                {a ? <PersonFace p={a.p} size={30} /> : <span className="gx-crisis-noface">💼</span>}
                <small>
                  <b>{x.who}</b>: {x.pick >= 0 ? `${x.pick + 1}번이 ${x.why}` : '고를 게 없어요'}
                </small>
              </span>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
