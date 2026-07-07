// src/components/CompetencyRadar.jsx
// One competency area: a small SVG radar of its skills' attained levels
// (unlabeled spokes; the category name is the only text). Categories with
// fewer than 3 skills can't form a polygon, so they render as a level gauge.
import { radarPoints, ringPolygonPoints } from '../lib/radar-geometry.js';

const GEO = { cx: 60, cy: 60, r: 50, max: 5.5 };
const RINGS = [1, 2, 3, 4, 5];

export function CompetencyRadar({ category, levels }) {
  if (!levels || levels.length === 0) return null;
  return (
    <figure className="competency-radar">
      <figcaption className="cr-title">{category}</figcaption>
      {levels.length >= 3
        ? <RadarSvg levels={levels} />
        : <GaugeSvg levels={levels} />}
    </figure>
  );
}

function RadarSvg({ levels }) {
  const count = levels.length;
  const pts = radarPoints(levels, GEO);
  // The filled shape connects each spoke's point; an unassessed (null) spoke
  // pinches to center so gaps read as "not yet assessed".
  const poly = pts
    // An unassessed (null) spoke pinches to the center, so gaps read as
    // "not yet assessed" rather than a rated value.
    .map(p => (p ? `${p.x.toFixed(2)},${p.y.toFixed(2)}` : `${GEO.cx.toFixed(2)},${GEO.cy.toFixed(2)}`))
    .join(' ');
  return (
    <svg className="cr-svg" viewBox="0 0 120 120" role="img" aria-label={`competency radar, ${count} skills`}>
      {RINGS.map(lvl => (
        <polygon key={lvl} className="cr-ring" points={ringPolygonPoints(lvl, { ...GEO, count })} />
      ))}
      {/* spokes */}
      {Array.from({ length: count }, (_, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
        return (
          <line
            key={i}
            className="cr-spoke"
            x1={GEO.cx} y1={GEO.cy}
            x2={(GEO.cx + GEO.r * Math.cos(a)).toFixed(2)}
            y2={(GEO.cy + GEO.r * Math.sin(a)).toFixed(2)}
          />
        );
      })}
      <polygon className="cr-shape" points={poly} />
      {pts.map((p, i) => (p ? <circle key={i} className="cr-dot" cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="1.6" /> : null))}
    </svg>
  );
}

function GaugeSvg({ levels }) {
  // A short L1-L5 scale with a dot per skill at its level (label-free).
  const W = 120, H = 28, padX = 8, y = 18;
  const x = lvl => padX + ((W - 2 * padX) * (lvl / 5));
  return (
    <svg className="cr-svg cr-gauge" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="competency level gauge">
      <line className="cr-gauge-axis" x1={padX} y1={y} x2={W - padX} y2={y} />
      {[1, 2, 3, 4, 5].map(l => <line key={l} className="cr-gauge-tick" x1={x(l)} y1={y - 3} x2={x(l)} y2={y + 3} />)}
      {levels.map((lvl, i) => (lvl == null ? null : <circle key={i} className="cr-dot" cx={x(lvl)} cy={y} r="2.4" />))}
    </svg>
  );
}
