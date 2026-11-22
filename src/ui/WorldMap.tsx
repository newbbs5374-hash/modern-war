import { BLOCS, CONTINENTS, COUNTRIES, FRONTS, HOLY_CITY, MAP_SIZE } from '../data/world';

interface Props {
  playerCountryId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** 전략 지도(임시 도형). 대륙 = 둥근 네모, 나라 = 연합 색 네모 */
export function WorldMap({ playerCountryId, selectedId, onSelect }: Props) {
  return (
    <svg className="map" viewBox={`0 40 ${MAP_SIZE.w} ${MAP_SIZE.h}`} role="img" aria-label="세계 지도">
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
      {FRONTS.map((f) => (
        <line
          key={f.name}
          x1={f.x1}
          y1={f.y1}
          x2={f.x2}
          y2={f.y2}
          stroke={f.kind === '전쟁' ? '#f43f5e' : '#f59e0b'}
          strokeWidth="2.5"
          strokeDasharray="6 4"
        >
          <title>{f.name}</title>
        </line>
      ))}
      {COUNTRIES.map((c) => {
        const color = BLOCS[c.bloc].color;
        const mine = c.id === playerCountryId;
        const sel = c.id === selectedId;
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
                fillOpacity={sel ? 0.6 : 0.3}
                stroke={mine ? '#fde047' : color}
                strokeWidth={mine || sel ? 2.5 : 1.25}
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
      <g>
        <circle cx={HOLY_CITY.x} cy={HOLY_CITY.y} r="5" fill="#f59e0b" />
        <text x={HOLY_CITY.x} y={HOLY_CITY.y + 57} textAnchor="middle" className="map-continent">
          {HOLY_CITY.name}
        </text>
      </g>
    </svg>
  );
}
