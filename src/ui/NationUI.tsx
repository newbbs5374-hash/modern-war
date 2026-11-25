// 나라 특징 상자(11-25 대장 요청 "나라별로 특징, 그 나라를 골라 실험해 볼 수 있게").
// 시작 화면 · 나라 정보창 · 대통령실(집무실) 위에서 같은 모양으로 보여 줌. 자료 data/nations.ts.
import { nationGov } from '../data/nations';
import { headTitle } from '../game/nation';
import { domArt } from './scenes';

export function NationTraits({ id, compact }: { id: string; compact?: boolean }) {
  const g = nationGov(id);
  return (
    <div className={`nation-traits ${compact ? 'compact' : ''}`}>
      {!compact && (
        <p className="small muted nt-style">
          🏛️ {headTitle(id)} · {g.office} — {g.style}
        </p>
      )}
      <div className="nt-row">
        {g.traits.map((t, i) => {
          const u = domArt(`trait-${id}-${i + 1}`);
          return (
            <div key={t.name} className={`nt-chip ${t.weak ? 'weak' : ''}`} title={t.text}>
              <span className="nt-ico">{u ? <img src={u} alt="" /> : t.icon}</span>
              <span className="nt-txt">
                <b>{t.name}</b>
                <small>{t.text}</small>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
