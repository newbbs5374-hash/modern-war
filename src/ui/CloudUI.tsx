// 카카오 로그인·서버 저장 화면 조각(설정 저장 칸·시작 화면·서로 다른 판 묻기)
import { useSyncExternalStore } from 'react';
import { cloudLabel, cloudView, infoOf, loginUrl, logout, readMeta, subscribeCloud } from '../game/cloud';
import type { GameState } from '../game/state';
import { countryById } from '../data/world';
import { Modal } from './kit';
import type { CloudAsk } from './useCloud';

export const useCloud = () => useSyncExternalStore(subscribeCloud, cloudView, cloudView);

const cname = (id: string) => {
  try {
    return countryById(id).name;
  } catch {
    return id;
  }
};

function KakaoButton({ label = '카카오로 로그인' }: { label?: string }) {
  return (
    <a className="kakao-btn" href={loginUrl()} target="_top">
      <span aria-hidden>💬</span> {label}
    </a>
  );
}

/** 설정 > 저장 칸 위쪽 */
export function CloudCard({ onSync }: { onSync: () => void }) {
  const v = useCloud();
  if (v.status === 'checking') return <p className="cloud-row small muted">☁️ 카카오 로그인 확인 중…</p>;
  if (v.status === 'off')
    return <p className="cloud-row small muted">☁️ 카카오 로그인: 서버 준비 중이에요(설정이 끝나면 여기에 로그인 버튼이 생겨요).</p>;
  if (v.status === 'out')
    return (
      <div className="cloud-row">
        <KakaoButton />
        <small className="muted">로그인하면 휴대폰·집 PC·회사 PC 어디서든 같은 판을 이어 해요. 지금 이 기기 저장은 서버로 옮겨져요.</small>
      </div>
    );
  const when = v.syncedAt ? new Date(v.syncedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div className="cloud-row is-in">
      <span className="cloud-who">
        <b>☁️ 카카오 {v.nick}</b>
        <small className="muted">
          {v.busy ? '서버와 맞추는 중…' : v.error || (when ? `서버 저장 ${when} · 다른 기기와 자동으로 맞춰요` : '다른 기기와 자동으로 맞춰요')}
        </small>
      </span>
      <span className="cloud-btns">
        <button disabled={v.busy} onClick={onSync}>
          🔄 지금 맞추기
        </button>
        <button onClick={() => void logout()}>로그아웃</button>
      </span>
    </div>
  );
}

/** 시작 화면(저장 없음): 카카오 로그인 / 서버 저장으로 이어 하기 */
export function CloudStartCard({ onContinue }: { onContinue: () => void }) {
  const v = useCloud();
  if (v.status === 'off' || v.status === 'checking') return null;
  if (v.status === 'out')
    return (
      <div className="cloud-start">
        <KakaoButton label="카카오로 로그인해서 이어 하기" />
        <small className="muted">다른 기기에서 하던 판이 있으면 로그인만 하면 이어져요.</small>
      </div>
    );
  const info = v.server?.info;
  return (
    <div className="cloud-start">
      {v.server?.rev ? (
        <button className="primary" disabled={v.busy} onClick={onContinue}>
          ☁️ 이어 하기: {cloudLabel(info, cname)}
        </button>
      ) : (
        <small className="muted">☁️ 카카오 {v.nick}로 로그인됨 · 서버에 저장된 판이 없어요. 새로 시작하면 서버에 저장돼요.</small>
      )}
    </div>
  );
}

/** 서로 다른 판이 부딪쳤을 때 */
export function CloudAskModal({ ask, local, onPick, onClose }: { ask: CloudAsk; local: GameState; onPick: (p: 'server' | 'local') => void; onClose: () => void }) {
  return (
    <Modal title="어느 판으로 할까요?" icon="☁️" onClose={onClose}>
      <p className="small">이 기기 저장과 카카오 서버 저장이 서로 다른 판이에요. 하나만 남아요.</p>
      <div className="cloud-pick">
        <button className="primary" onClick={() => onPick('server')}>
          ☁️ 서버 저장 (추천)
          <small>{cloudLabel(ask.head.info, cname)}</small>
        </button>
        <button onClick={() => onPick('local')}>
          📱 이 기기 저장
          <small>{cloudLabel(infoOf(local, readMeta().actAt || local.lastRealTime), cname)}</small>
        </button>
      </div>
      <p className="small muted">고르지 않은 판은 지워져요. 아깝다면 먼저 설정 &gt; 코드 만들기로 저장 코드를 복사해 두세요.</p>
    </Modal>
  );
}
