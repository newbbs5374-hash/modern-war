// 설정 화면: 지도 위 전투 그림 칸이 얼마나 채워졌는지
import { fieldArt, fieldSlots } from './fieldArt';

export function FieldArtList() {
  const slots = fieldSlots();
  const filled = slots.filter((s) => fieldArt(s.key)).length;
  return (
    <div className="portrait-list">
      <p className="small muted">
        넣은 그림 {filled} / {slots.length}칸 · 폴더 src/assets/field/ · 프롬프트는 폴더 안 README
      </p>
      <div className="portrait-grid">
        {slots.map((s) => {
          const url = fieldArt(s.key);
          return (
            <div key={s.key} className={`portrait-slot ${url ? 'on' : ''}`}>
              <span className="portrait-box">{url ? <img className="face-img" src={url} alt="" draggable={false} /> : '➕'}</span>
              <code>{s.key}</code>
              <small>{s.who}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}
