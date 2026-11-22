import { CITIES } from '../data/cities';
import { BLOCS, CONTINENTS, COUNTRIES, HOLY_CITY, MAP_SIZE, type Relation } from '../data/world';
import { isAlive, relationOf, type WorldState } from '../game/world';

export type MapMode = '관계' | '묶음';

export const REL_COLORS: Record<Relation | '나', string> = {
  나: '#fde047',
  연합: '#3b82f6',
  전쟁: '#ef4444',
  휴전: '#f59e0b',
  중립: '#9ca3af',
};

interface Props {
  world: WorldState;
  playerCountryId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 관계 = 우리나라와의 관계 색, 묶음 = 처음 연합 묶음 색 */
  mode?: MapMode;
  /** 본부 화면의 작은 지도 */
  mini?: boolean;
}

/** 전략 지도(임시 도형). 대륙 = 둥근 네모, 나라 = 색 네모, 도시 = 점(지금 주인 색) */
export function WorldMap({ world, playerCountryId, selectedId, onSelect, mode = '관계', mini }: Props) {
  const colorOf = (id: string) =>
    mode === '묶음'
      ? BLOCS[COUNTRIES.find((c) => c.id === id)!.bloc].color
      : id === playerCountryId
        ? REL_COLORS['나']
        : REL_COLORS[relationOf(world, playerCountryId, id)];

  return (
    <svg
      className={mini ? 'map mini' : 'map'}
      viewBox={`0 40 ${MAP_SIZE.w} ${MAP_SIZE.h}`}
      role="img"
      aria-label="세계 지도"
    >
      <rect x="0" y="40" width={MAP_SIZE.w} height={MAP_SIZE.h} fill="#0c1a2b" />
      {CONTINENTS.map((ct) => (
        <g key={ct.id}>
          {ct.shapes.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="22" fill="#1e2b3c" stroke="#33475f" />
          ))}
          <text x={ct.label.x} y={ct.label.y} className="map-continent">
            {ct.name}
          </text>
        </g>
      ))}
      {COUNTRIES.map((c) => {
        const color = colorOf(c.id);
        const mine = c.id === playerCountryId;
        const sel = c.id === selectedId;
        const alive = isAlive(world, c.id);
        return (
          <g key={c.id} className="map-country" onClick={() => onSelect(c.id)}>
            {c.shapes.map((r, i) => (
              <rect
                key={i}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx="4"
                fill={color}
                fillOpacity={!alive ? 0.08 : sel ? 0.6 : 0.3}
                stroke={sel ? '#fff' : color}
                strokeWidth={mine || sel ? 2.5 : 1.25}
                strokeDasharray={alive ? undefined : '3 3'}
              />
            ))}
            <text
              x={c.label.x}
              y={c.label.y}
              textAnchor="middle"
              className="map-label"
              fontSize={c.name.length > 4 ? 10.5 : 12}
            >
              {mine ? '★ ' : ''}
              {c.name}
            </text>
          </g>
        );
      })}
      {CITIES.map((city) => {
        const owner = world.owner[city.id];
        const occupied = owner !== city.home;
        return (
          <circle
            key={city.id}
            className="map-city"
            cx={city.x}
            cy={city.y}
            r={city.capital ? 3.6 : 2.6}
            fill={colorOf(owner)}
            stroke={occupied ? '#fff' : '#0c1a2b'}
            strokeWidth={occupied ? 1.6 : 1}
            onClick={() => onSelect(city.home)}
          >
            <title>
              {city.name}
              {city.capital ? '(수도)' : ''} · {COUNTRIES.find((c) => c.id === owner)!.name}
              {occupied ? ' 점령 중' : ''}
            </title>
          </circle>
        );
      })}
      <g>
        <circle cx={HOLY_CITY.x} cy={HOLY_CITY.y} r="5" fill="#f59e0b" />
        <text x={HOLY_CITY.x} y={HOLY_CITY.y + 57} textAnchor="middle" className="map-continent">
          {HOLY_CITY.name}
        </text>
      </g>
    </svg>
  );
}
