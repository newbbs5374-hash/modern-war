// 명단 새로 받기(11-26 대장 요청): 성향·필요 분야를 골라 그 조건에 맞는 인재 16명을 받는다.
// 계산은 src/game/cabinet.ts refreshPool(want)
import { useState } from 'react';
import { FACTIONS, type Faction, type SpecId } from '../data/cabinet';
import { POOL_SIZE, REFRESH_RUBY, refreshPool } from '../game/cabinet';
import type { GameState } from '../game/state';
import { Modal } from './kit';
import type { ScreenProps } from './screens';

/** 필요 분야 11가지(인물 특화와 같음) */
export const SPEC_PICKS: Array<{ id: SpecId; icon: string; name: string; hint: string }> = [
  { id: '경제통', icon: '📈', name: '경제', hint: '기재부·산업부' },
  { id: '외교통', icon: '🌐', name: '외교', hint: '외교부·통일부' },
  { id: '행정통', icon: '🗂️', name: '행정', hint: '행안부·법무부' },
  { id: '복지통', icon: '🏥', name: '복지', hint: '복지부·노동부' },
  { id: '과학자', icon: '🔬', name: '과학', hint: '과기부·연구' },
  { id: '홍보통', icon: '📣', name: '홍보', hint: '문체부·홍보수석' },
  { id: '육군통', icon: '🪖', name: '육군', hint: '국방부·육군총장' },
  { id: '해군통', icon: '⚓', name: '해군', hint: '해군총장·해수부' },
  { id: '공군통', icon: '✈️', name: '공군', hint: '공군총장' },
  { id: '정보통', icon: '🕵️', name: '정보', hint: '국정원·정보사' },
  { id: '군수통', icon: '📦', name: '군수', hint: '군수사·방산' },
];
const specName = (id: SpecId) => SPEC_PICKS.find((x) => x.id === id)?.name ?? id;

/** 버튼(누르면 고르는 창) */
export function PoolRefreshButton({ state, actions, label, suggest, onDone, className }: Pick<ScreenProps, 'state' | 'actions'> & { label?: React.ReactNode; suggest?: SpecId | null; onDone?: (msg: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const ruby = state.goals?.ruby ?? 0;
  return (
    <>
      <button className={className ?? 'wide'} disabled={ruby < REFRESH_RUBY} onClick={() => setOpen(true)}>
        {label ?? '🔄 명단 새로 받기'} <small>💎{REFRESH_RUBY}</small>
      </button>
      {open && <PoolRefreshModal state={state} actions={actions} suggest={suggest} onDone={onDone} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PoolRefreshModal({ state, actions, suggest, onDone, onClose }: Pick<ScreenProps, 'state' | 'actions'> & { suggest?: SpecId | null; onDone?: (msg: string) => void; onClose: () => void }) {
  const [faction, setFaction] = useState<Faction | null>(null);
  const [spec, setSpec] = useState<SpecId | null>(suggest ?? null);
  const ruby = state.goals?.ruby ?? 0;
  const tag = [faction, spec && specName(spec)].filter(Boolean).join(' · ');
  const go = () => {
    actions.apply((s: GameState) => refreshPool(s, { faction, spec }));
    onDone?.(tag ? `🔄 ${tag} 인재 ${POOL_SIZE}명을 새로 받았어요` : '🔄 인재 명단을 새로 받았어요');
    onClose();
  };
  return (
    <Modal title="명단 새로 받기" icon="🔄" onClose={onClose}>
      <p className="small muted pr-lead">각하, 어떤 분을 찾을까요? 고르시면 {POOL_SIZE}명 모두 그 조건으로 모셔 오겠습니다. 안 고르면 아무나 섞여 와요.</p>
      <h4 className="pr-h">🧭 성향</h4>
      <div className="pr-grid pr-fac">
        <button className={faction === null ? 'on' : ''} onClick={() => setFaction(null)}>
          🎲<b>상관없음</b>
        </button>
        {FACTIONS.map((f) => (
          <button key={f.id} className={faction === f.id ? 'on' : ''} onClick={() => setFaction(f.id)}>
            {f.icon}
            <b>{f.id.replace('파', '')}</b>
            <small>{f.bonus}</small>
          </button>
        ))}
      </div>
      <h4 className="pr-h">🎯 필요 분야{suggest ? <small className="muted"> · 비서 추천: {specName(suggest)}(빈 자리에 가장 많이 필요)</small> : null}</h4>
      <div className="pr-grid pr-spec">
        <button className={spec === null ? 'on' : ''} onClick={() => setSpec(null)}>
          🎲<b>상관없음</b>
        </button>
        {SPEC_PICKS.map((x) => (
          <button key={x.id} className={spec === x.id ? 'on' : ''} onClick={() => setSpec(x.id)}>
            {x.icon}
            <b>{x.name}</b>
            <small>{x.hint}</small>
          </button>
        ))}
      </div>
      <p className="small pr-sum">📋 {tag ? `${tag} 인재 ${POOL_SIZE}명` : `아무 인재 ${POOL_SIZE}명`} · 지금 명단은 사라져요</p>
      <button className="wide primary" disabled={ruby < REFRESH_RUBY} onClick={go}>
        🔄 이 조건으로 받기 <small>💎{REFRESH_RUBY} · 가진 루비 {ruby}</small>
      </button>
    </Modal>
  );
}
