// 호칭 카드(11-23 대장 결정): 승급 버튼 대신 "신뢰도 + 명성 점수 = 호칭". 누르면 15단계 표와 단계마다 열리는 자리.
import { useState } from 'react';
import { ministerSlots } from '../data/cabinet';
import { aideSlots, generalSlots } from '../data/officers';
import { TITLES, rankOfTier } from '../data/ranks';
import { TITLE_MAX, TITLE_SLACK, famePts, nextTitle, tierNow, titleOf, titleScore } from '../game/title';
import type { GameState } from '../game/state';
import { Meter, Modal } from './kit';

/** 단계 r에서 처음 열리는 것(앞 단계와 비교) */
function opens(r: number): string {
  if (r === 0) return `장관 ${ministerSlots(0)}석 · 차관 9석`;
  const out: string[] = [];
  if (ministerSlots(r) > ministerSlots(r - 1)) out.push(`장관 ${ministerSlots(r)}석`);
  if (generalSlots(r) > generalSlots(r - 1)) out.push(`장군 ${generalSlots(r)}석`);
  if (aideSlots(r) > aideSlots(r - 1)) out.push(`부관 ${aideSlots(r)}명`);
  return out.join(' · ') || '봉급·스탯 상한 ↑';
}

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
            점수가 오르면 바로 호칭이 오르고, 떨어지면({TITLE_SLACK}점 여유) 호칭도 내려가요. 탄핵·재신임 실패·불신임은 신뢰도·명성을 깎아요. 이미 앉힌 장관·장군은 호칭이 내려가도 그대로지만, 새로 앉힐 자리는 지금 호칭을 따라요.
          </p>
          <div className="ttl-list">
            {TITLES.map((x, i) => {
              const r = rankOfTier(i);
              const first = i === 0 || rankOfTier(i - 1) < r;
              return (
                <div key={x.name} className={`ttl-row ${i === tier ? 'now' : i < tier ? 'done' : ''}`}>
                  <span>{x.icon}</span>
                  <b>{x.name}</b>
                  <small className="muted">{x.min}점~</small>
                  <small>{first ? opens(r) : ''}</small>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
