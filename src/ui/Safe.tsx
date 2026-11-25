// 오류 방지 장치(11/25): 한 화면·한 팝업에서 오류가 나도 게임 전체가 꺼지지(흰 화면) 않게 그 부분만 막는다.
import { Component, useState, type ErrorInfo, type ReactNode } from 'react';

const LOG_KEY = 'modern-war-errors';

/** 최근 오류 20개를 브라우저에 남김(설정 화면에서 볼 수 있음) */
export function logError(where: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const stack = err instanceof Error ? (err.stack ?? '').split('\n').slice(0, 6).join('\n') : '';
  console.error(`[게임 오류] ${where}:`, err);
  try {
    const list = readErrors();
    if (list[0]?.msg === msg && list[0]?.where === where) return;
    list.unshift({ t: Date.now(), where, msg, stack });
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* 무시 */
  }
}

export function readErrors(): Array<{ t: number; where: string; msg: string; stack: string }> {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function clearErrors() {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* 무시 */
  }
}

interface Props {
  /** 어디서 난 오류인지(기록용) */
  where: string;
  children: ReactNode;
  /** 오류 칸 대신 보여 줄 것(없으면 기본 안내 칸). 팝업 안 등 작은 자리는 small */
  small?: boolean;
  /** 「돌아가기」 버튼(예: 본부로) */
  onExit?: () => void;
  exitLabel?: string;
}

export class Safe extends Component<Props, { err: unknown }> {
  state: { err: unknown } = { err: null };

  static getDerivedStateFromError(err: unknown) {
    return { err: err ?? new Error('알 수 없는 오류') };
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    logError(this.props.where, err);
    if (info.componentStack) console.error(info.componentStack.split('\n').slice(0, 8).join('\n'));
  }

  render() {
    if (!this.state.err) return this.props.children;
    const e = this.state.err;
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div className={`card safe-err ${this.props.small ? 'small' : ''}`} role="alert">
        <b>⚠️ 이 부분을 그리다 문제가 생겼어요</b>
        <p className="muted small">게임은 멈추지 않았어요. 다시 시도하거나 다른 탭으로 가 주세요. (오류는 자동으로 기록돼요)</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="primary" onClick={() => this.setState({ err: null })}>
            다시 시도
          </button>
          {this.props.onExit && <button onClick={this.props.onExit}>{this.props.exitLabel ?? '본부로'}</button>}
        </div>
        <details className="small muted">
          <summary>자세히</summary>
          <code style={{ wordBreak: 'break-all' }}>
            {this.props.where}: {msg}
          </code>
        </details>
      </div>
    );
  }
}

/** 설정 > 시험 도구: 최근 오류 기록(복사해서 보내 주면 고치기 쉬움) */
export function ErrorLog() {
  const [list, setList] = useState(readErrors);
  if (!list.length) return null;
  const text = list.map((e) => `${new Date(e.t).toLocaleString('ko-KR')} · ${e.where} · ${e.msg}\n${e.stack}`).join('\n\n');
  return (
    <details className="fold small">
      <summary>⚠️ 최근 오류 기록 {list.length}개</summary>
      <div className="fold-body">
        {list.map((e, i) => (
          <div key={i} className="muted" style={{ wordBreak: 'break-all' }}>
            {new Date(e.t).toLocaleString('ko-KR')} · <b>{e.where}</b> · {e.msg}
          </div>
        ))}
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <button onClick={() => void navigator.clipboard?.writeText(text).catch(() => {})}>복사</button>
          <button onClick={() => (clearErrors(), setList([]))}>지우기</button>
        </div>
      </div>
    </details>
  );
}
