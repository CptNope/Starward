// Small procedural-modelling kit: lofted hulls, tapered wings and mirrored parts.
// Everything returns plain non-indexed BufferGeometry (positions only) ready for bake().
import * as THREE from 'three';

const chamfer = (c) => [[1, -1 + c], [1, 1 - c], [1 - c, 1], [-1 + c, 1], [-1, 1 - c], [-1, -1 + c], [-1 + c, -1], [1 - c, -1]];
const ngon = (n, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + i / n * Math.PI * 2; return [Math.cos(a), Math.sin(a)]; });
// Cross-sections in a unit square, counter-clockwise seen from the tail.
export const PROFILES = {
  box: [[1, -1], [1, 1], [-1, 1], [-1, -1]],
  oct: chamfer(0.45),
  slab: chamfer(0.22),
  hex: [[1, 0], [0.5, 1], [-0.5, 1], [-1, 0], [-0.5, -1], [0.5, -1]],
  hull: [[1, -0.25], [0.72, 0.55], [0.3, 1], [-0.3, 1], [-0.72, 0.55], [-1, -0.25], [-0.55, -1], [0.55, -1]],  // flat top, keeled belly
  wedge: [[1, -0.55], [0.86, 0.25], [0.4, 1], [-0.4, 1], [-0.86, 0.25], [-1, -0.55], [-0.68, -1], [0.68, -1]], // warship: wide waist
  diamond: [[1, 0], [0, 1], [-1, 0], [0, -1]],
  round: ngon(10),
  round6: ngon(6, Math.PI / 6),
};

// Flip triangle winding in place.
function flip(geo) {
  const p = geo.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  return geo;
}
// Make a closed mesh face outward (positive signed volume), whatever order it was built in.
export function orient(geo) {
  const p = geo.attributes.position.array; let v = 0, cx = 0, cy = 0, cz = 0; const n = p.length / 3;
  for (let i = 0; i < p.length; i += 3) { cx += p[i]; cy += p[i + 1]; cz += p[i + 2]; }
  cx /= n; cy /= n; cz /= n;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i] - cx, ay = p[i + 1] - cy, az = p[i + 2] - cz, bx = p[i + 3] - cx, by = p[i + 4] - cy, bz = p[i + 5] - cz, ex = p[i + 6] - cx, ey = p[i + 7] - cy, ez = p[i + 8] - cz;
    v += ax * (by * ez - bz * ey) - ay * (bx * ez - bz * ex) + az * (bx * ey - by * ex);
  }
  return v < 0 ? flip(geo) : geo;
}
// Stretch a skin over a list of rings (each ring: same number of Vector3s), capped at both ends.
export function skin(rings) {
  const out = [], n = rings[0].length;
  const tri = (a, b, c) => out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; tri(A[k], A[k2], B[k2]); tri(A[k], B[k2], B[k]); }
  }
  const cap = (R, rev) => {
    const c = R.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; rev ? tri(c, R[k2], R[k]) : tri(c, R[k], R[k2]); }
  };
  cap(rings[0], true); cap(rings[rings.length - 1], false);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
  return orient(g);
}
// Fuselage: sections are [z, width, height, y = 0, x = 0] from nose (-Z) to tail (+Z).
export function loft(sections, profile = PROFILES.hull) {
  return skin(sections.map(([z, w, h, y = 0, x = 0]) => profile.map(([px, py]) => new THREE.Vector3(x + px * w / 2, y + py * h / 2, z))));
}
// Tapered wing growing along +X from its root at the origin. sweep moves the tip back (+Z), dih lifts it.
export function wing({ span, cr, ct = cr * 0.4, sweep = 0, dih = 0, t = 0.14, tt = t * 0.5 }) {
  const ring = (x, c, th, z, y) => [
    new THREE.Vector3(x, y, z - c / 2), new THREE.Vector3(x, y + th / 2, z - c * 0.18), new THREE.Vector3(x, y + th * 0.3, z + c * 0.3),
    new THREE.Vector3(x, y, z + c / 2), new THREE.Vector3(x, y - th * 0.3, z + c * 0.3), new THREE.Vector3(x, y - th / 2, z - c * 0.18),
  ];
  return skin([ring(0, cr, t, 0, 0), ring(span, ct, tt, sweep, dih)]);
}
// Mirror a geometry across the YZ plane (returns a new geometry, facing outward).
export function mirrorX(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) p[i] = -p[i];
  return flip(g);
}
// Bare-position copies of the built-in shapes, so they merge with lofted parts.
export const prim = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (r1, r2, len, seg = 8) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2), // axis along Z: r1 is the +Z (tail) end, r2 the -Z (nose) end
  sph: (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h),
  cone: (r, len, seg = 6) => new THREE.ConeGeometry(r, len, seg),
};
