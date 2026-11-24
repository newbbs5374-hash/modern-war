// 화면 부품: 팝업 · 도움말(?) · 접기 · 탭 · 아이콘 타일 · 막대
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({ title, icon, onClose, children, footer, big }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; big?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  // 팝업은 늘 화면 맨 위(body)에 그린다. 카드(.card)의 각진 모서리(clip-path) 안에 그리면
  // 팝업이 카드 크기로 잘려 제목·'시작' 버튼이 안 보였음(11/24 임무 팝업).
  return createPortal(
    <div className="modal-back" onClick={onClose}>
      <div className={big ? 'modal modal-big' : 'modal'} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {icon && <span className="modal-ico">{icon}</span>}
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** (?) 버튼 → 설명 팝업 */
export function Help({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="help" onClick={(e) => (e.stopPropagation(), setOpen(true))} aria-label={`${title} 도움말`}>
        ?
      </button>
      {open && (
        <Modal title={title} icon="💡" onClose={() => setOpen(false)}>
          <div className="help-text">{children}</div>
        </Modal>
      )}
    </>
  );
}

export function Fold({ title, children, open }: { title: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="fold" open={open}>
      <summary>{title}</summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
  badge?: number | string | null;
  locked?: boolean;
}

/** 화면 안의 탭(마지막으로 본 탭을 기억) */
export function useTab<T extends string>(key: string, first: T): [T, (t: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (sessionStorage.getItem(`tab:${key}`) as T) || first;
    } catch {
      return first;
    }
  });
  return [
    v,
    (t: T) => {
      setV(t);
      try {
        sessionStorage.setItem(`tab:${key}`, t);
      } catch {
        /* 무시 */
      }
    },
  ];
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: TabDef<T>[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" className={`${value === t.id ? 'on' : ''} ${t.locked ? 'locked' : ''}`} onClick={() => onChange(t.id)}>
          <span className="tab-ico">{t.locked ? '🔒' : t.icon}</span>
          <small>{t.label}</small>
          {t.badge ? <i className="badge">{t.badge}</i> : null}
        </button>
      ))}
    </div>
  );
}

export function Tile({
  icon,
  label,
  sub,
  badge,
  locked,
  tone,
  onClick,
  children,
}: {
  icon: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  badge?: ReactNode;
  locked?: boolean;
  tone?: 'gold' | 'red' | 'blue' | 'green';
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <button className={`itile ${locked ? "locked" : ""} ${tone ? `t-${tone}` : ""}`} onClick={onClick}>
      {badge != null && badge !== '' && <i className="badge">{badge}</i>}
      <span className="itile-ico">{locked ? '🔒' : icon}</span>
      <b>{label}</b>
      {sub != null && <small>{sub}</small>}
      {children}
    </button>
  );
}

export function Meter({ value, max, tone }: { value: number; max: number; tone?: 'gold' | 'red' | 'blue' | 'green' }) {
  return (
    <span className={`meter ${tone ?? ''}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1e-9, max)) * 100))}%` }} />
    </span>
  );
}

/** 작은 숫자 칩(아이콘 + 값) */
export function Chip({ icon, value, label }: { icon: ReactNode; value: ReactNode; label?: string }) {
  return (
    <span className="ichip" title={label}>
      <span>{icon}</span>
      <b>{value}</b>
      {label && <small>{label}</small>}
    </span>
  );
}

export const stars = (n: number, max = 3) => '★'.repeat(Math.max(0, n)) + '☆'.repeat(Math.max(0, max - n));
