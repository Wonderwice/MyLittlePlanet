// Cube-sphere geometry with multi-level LOD.
//
// Each vertex stores the unnormalized cube-face direction (vec3 a_dir).
// The vertex shader calls normalize(a_dir) to get the sphere point.
// This avoids the UV sphere's pole singularity and seam duplication.
//
// Face winding: tl-tr-bl / tr-br-bl (CCW from outside).
// Each face is defined so that cross(right, up) = fwd (verified per face),
// which makes cross(tangU, tangV) point outward for the Duff tangent frame.

const FACES = [
  { fwd: [ 1, 0, 0], r: [ 0, 0,-1], u: [0, 1, 0] },  // +X
  { fwd: [-1, 0, 0], r: [ 0, 0, 1], u: [0, 1, 0] },  // -X
  { fwd: [ 0, 1, 0], r: [ 1, 0, 0], u: [0, 0,-1] },  // +Y  (top)
  { fwd: [ 0,-1, 0], r: [ 1, 0, 0], u: [0, 0, 1] },  // -Y  (bottom)
  { fwd: [ 0, 0, 1], r: [ 1, 0, 0], u: [0, 1, 0] },  // +Z
  { fwd: [ 0, 0,-1], r: [-1, 0, 0], u: [0, 1, 0] },  // -Z
];

function buildFace(res, { fwd, r, u }) {
  const verts = (res + 1) * (res + 1);
  // max index = (res+1) squr-1; stays < 65 535 for res less than 254
  const dirData = new Float32Array(verts * 3);
  const indices = new Uint16Array(res * res * 6);

  for (let i = 0; i <= res; i++) {
    for (let j = 0; j <= res; j++) {
      const s    = j / res * 2 - 1;   // [-1, 1]
      const t    = i / res * 2 - 1;   // [-1, 1]
      const base = (i * (res + 1) + j) * 3;
      dirData[base    ] = fwd[0] + r[0]*s + u[0]*t;
      dirData[base + 1] = fwd[1] + r[1]*s + u[1]*t;
      dirData[base + 2] = fwd[2] + r[2]*s + u[2]*t;
    }
  }

  let ii = 0;
  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      const tl = i * (res + 1) + j;
      const tr = tl + 1;
      const bl = (i + 1) * (res + 1) + j;
      const br = bl + 1;
      indices[ii++] = tl; indices[ii++] = tr; indices[ii++] = bl;
      indices[ii++] = tr; indices[ii++] = br; indices[ii++] = bl;
    }
  }

  return { dirData, indices };
}

// Returns an array of 6 face objects for the given resolution.
export function buildCubeSphere(res) {
  return FACES.map(face => buildFace(res, face));
}

// LOD levels, ordered finest to coarsest.
// A level is active when cam.distance less than maxDist.
export const LOD_LEVELS = [
  { res: 128, maxDist:  2.0, label: '128' },
  { res:  64, maxDist:  3.5, label:  '64' },
  { res:  32, maxDist:  6.0, label:  '32' },
  { res:  16, maxDist: Infinity, label: '16' },
];

export function getLODIndex(dist) {
  for (let i = 0; i < LOD_LEVELS.length; i++) {
    if (dist <= LOD_LEVELS[i].maxDist) return i;
  }
  return LOD_LEVELS.length - 1;
}
