// 설정 화면: 지도 위 전투 그림 칸이 얼마나 채워졌는지
import { fieldArt, fieldSlots } from './fieldArt';
import { iconSlots } from './iconArt';

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

/** 설정 화면: 부대·훈련·분쟁 섬 아이콘 그림 칸. 🗺️ = 아직 전투 말 그림을 빌려 쓰는 중 */
export function IconArtList() {
  const slots = iconSlots();
  const own = slots.filter((s) => s.own).length;
  return (
    <div className="portrait-list">
      <p className="small muted">
        넣은 그림 {own} / {slots.length}칸 · 폴더 src/assets/icons/ · 🗺️ 표시는 전투 말 그림을 빌려 쓰는 중
      </p>
      <div className="portrait-grid">
        {slots.map((s) => (
          <div key={s.key} className={`portrait-slot ${s.own ? 'on' : ''}`}>
            <span className="portrait-box">{s.url ? <img className="face-img" src={s.url} alt="" draggable={false} /> : '➕'}</span>
            <code>{s.key}</code>
            <small>
              {s.who}
              {s.url && !s.own ? ' 🗺️' : ''}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
