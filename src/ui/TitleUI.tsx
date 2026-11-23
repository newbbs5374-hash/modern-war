// 호칭 카드(11-23 대장 결정): 승급 버튼 대신 "신뢰도 + 명성 점수 = 호칭". 11-24: 호칭(평판)은 재신임 국민투표에만 영향.
import { useState } from 'react';
import { TITLES } from '../data/ranks';
import { TITLE_MAX, TITLE_SLACK, famePts, nextTitle, tierNow, titleOf, titleScore } from '../game/title';
import type { GameState } from '../game/state';
import { Meter, Modal } from './kit';

export function TitleBox({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const tier = tierNow(state);
  const t = titleOf(state);
  const score = titleScore(state);
  const trust = Math.round(state.officer.trust);
  const fp = Math.round(famePts(state.officer));
  const nx = nextTitle(state);
  return (
    <>
      <button className="ttl-box" onClick={() => setOpen(true)}>
        <span className="ttl-ico">{t.icon}</span>
        <span className="ttl-main">
          <b>
            {t.name} <small className="muted">· 호칭 {tier + 1}/{TITLES.length}</small>
          </b>
          <Meter value={score} max={TITLE_MAX} tone="green" />
          <small className="muted">
            🤝 신뢰도 {trust} + 📣 명성 {fp} = <b>{score}</b>/{TITLE_MAX}
            {nx ? ` · 다음 「${nx.title.name}」까지 ${nx.need}점` : ' · 가장 높은 호칭'}
          </small>
        </span>
        <span className="ttl-more">▸</span>
      </button>
      {open && (
        <Modal title="호칭" icon="🎖️" onClose={() => setOpen(false)}>
          <p className="small">
            승급은 없어요. <b>의회 신뢰도(0~100) + 명성 점수(0~100)</b>를 더한 점수(최대 {TITLE_MAX})로 호칭이 저절로 정해져요. 명성 점수는 명성 ÷ 10이에요(명성 1,000 = 100점).
          </p>
          <p className="small muted">
            점수가 오르면 바로 호칭이 오르고, 떨어지면({TITLE_SLACK}점 여유) 호칭도 내려가요. 탄핵·재신임 실패·불신임은 신뢰도·명성을 깎아요.
          </p>
          <p className="small">
            🗳️ 호칭(평판)은 <b>재신임 국민투표 통과 확률에만</b> 영향을 줘요(가장 낮은 호칭 −25%p ~ 가장 높은 호칭 +25%p). 장관·장군·부관 자리, 만들 수 있는 병과, 작전·외교 같은 기능은 처음부터 모두 열려 있어요.
          </p>
          <div className="ttl-list">
            {TITLES.map((x, i) => {
              return (
                <div key={x.name} className={`ttl-row ${i === tier ? 'now' : i < tier ? 'done' : ''}`}>
                  <span>{x.icon}</span>
                  <b>{x.name}</b>
                  <small className="muted">{x.min}점~</small>
                  <small>재신임 {x.min >= 100 ? '+' : '−'}{Math.abs(Math.round((x.min - 100) / 4))}%p</small>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
