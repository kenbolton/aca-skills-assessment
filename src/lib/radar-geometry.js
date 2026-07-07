// src/lib/radar-geometry.js
// Pure geometry for the competency radars. Spokes are evenly spaced clockwise
// starting at 12 o'clock; a point's radius is proportional to value/max.

function angleFor(i, n) {
  return -Math.PI / 2 + (2 * Math.PI * i) / n;
}

export function radarPoints(values, { cx, cy, r, max }) {
  const n = values.length;
  return values.map((v, i) => {
    if (v == null) return null;
    const rad = r * (v / max);
    const a = angleFor(i, n);
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
  });
}

export function ringPolygonPoints(level, { cx, cy, r, max, count }) {
  const rad = r * (level / max);
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = angleFor(i, count);
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
