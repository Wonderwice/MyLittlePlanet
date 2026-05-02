precision highp float;

// ── Geometry attribute ──────────────────────────────────────
// Unnormalized cube-face direction.  normalize(a_dir) in main()
// gives the sphere surface point without any UV parameterization.
attribute vec3 a_dir;

// ── Transform ───────────────────────────────────────────────
uniform mat4 u_proj;
uniform mat4 u_view;

// ── Planet ──────────────────────────────────────────────────
uniform float u_radius;

// ── FBM noise ───────────────────────────────────────────────
uniform float u_noiseFreq;
uniform float u_noiseAmp;
uniform int   u_octaves;      // 1–10
uniform float u_lacunarity;
uniform float u_gain;

// ── Domain warp ─────────────────────────────────────────────
uniform float u_warpStrength;
uniform float u_warpFreq;
uniform int   u_warpOctaves;  // 1–6

// ── Varyings to fragment shader ─────────────────────────────
varying vec3  v_normal;
varying float v_height;
varying vec3  v_worldPos;

// Finite-difference step in sphere-tangent space.
// Corresponds to around 0.17 degree of arc — small enough for accuracy,
// large enough to stay above floating-point noise.
const float EPS = 0.003;

// ═══════════════════════════════════════════════════════════
// HASH  — Dave Hoskins 3D→1F hash.
// Avoids sin(), which has precision issues on some GPU drivers.
// ═══════════════════════════════════════════════════════════
float hash3(vec3 p) {
  p  = fract(p * 0.3183099 + vec3(0.1));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// ═══════════════════════════════════════════════════════════
// VALUE NOISE — trilinear, quintic-smoothstep kernel.
// Returns a value in [-1, 1].
// ═══════════════════════════════════════════════════════════
float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  // Quintic smoothstep: (C² continuity)
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float v000 = hash3(i);
  float v100 = hash3(i + vec3(1,0,0));
  float v010 = hash3(i + vec3(0,1,0));
  float v110 = hash3(i + vec3(1,1,0));
  float v001 = hash3(i + vec3(0,0,1));
  float v101 = hash3(i + vec3(1,0,1));
  float v011 = hash3(i + vec3(0,1,1));
  float v111 = hash3(i + vec3(1,1,1));
  float r = mix(
    mix(mix(v000, v100, u.x), mix(v010, v110, u.x), u.y),
    mix(mix(v001, v101, u.x), mix(v011, v111, u.x), u.y),
    u.z);
  return r * 2.0 - 1.0;  // remap [0,1] → [-1,1]
}

// ═══════════════════════════════════════════════════════════
// FBM — fractional Brownian motion over layered value noise.
// Normalized so output stays in [-1, 1] regardless of octave count.
// ═══════════════════════════════════════════════════════════
float fbm(vec3 p, int octaves) {
  float val  = 0.0;
  float amp  = 0.5;
  float freq = 1.0;
  float norm = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= octaves) break;
    val  += amp * valueNoise(p * freq);
    norm += amp;
    freq *= u_lacunarity;
    amp  *= u_gain;
  }
  return val / norm;
}

// ═══════════════════════════════════════════════════════════
// DISPLACEMENT — two-level domain warp (Inigo Quilez style),
// then FBM at the warped coordinate.
// ═══════════════════════════════════════════════════════════
float displace(vec3 p) {
  vec3 q = vec3(
    fbm(p * u_warpFreq,                               u_warpOctaves),
    fbm(p * u_warpFreq + vec3(5.2,  1.3,  2.8),      u_warpOctaves),
    fbm(p * u_warpFreq + vec3(1.7,  9.2,  5.1),      u_warpOctaves)
  );
  vec3 r = vec3(
    fbm(p * u_warpFreq + 4.0*q + vec3(1.7,  9.2,  2.8), u_warpOctaves),
    fbm(p * u_warpFreq + 4.0*q + vec3(8.3,  2.8,  5.1), u_warpOctaves),
    fbm(p * u_warpFreq + 4.0*q + vec3(3.1,  7.4,  1.9), u_warpOctaves)
  );
  return u_noiseAmp * fbm((p + u_warpStrength * r) * u_noiseFreq, u_octaves);
}

// ═══════════════════════════════════════════════════════════
// DUFF 2017 TANGENT FRAME
// Given unit normal n, returns orthogonal t and b such that
// cross(t, b) = n.  No singularities anywhere on the sphere.
// Reference: Duff et al., "Building an Orthonormal Basis,
// Revisited" (JCGT 2017).
// ═══════════════════════════════════════════════════════════
void duffFrame(vec3 n, out vec3 t, out vec3 b) {
  float s = (n.z >= 0.0) ? 1.0 : -1.0;
  float a = -1.0 / (s + n.z);
  float c = n.x * n.y * a;
  t = vec3(1.0 + s * n.x * n.x * a, s * c, -s * n.x);
  b = vec3(c, s + n.y * n.y * a, -n.y);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
void main() {
  vec3 n0 = normalize(a_dir);

  // Build a singularity-free tangent frame from the sphere normal.
  // t and b are orthonormal to n0; cross(t, b) = n0 (outward).
  vec3 t, b;
  duffFrame(n0, t, b);

  // Two offset sphere points for finite-difference normal estimation.
  // Re-normalizing keeps the sample points on the unit sphere.
  vec3 nt = normalize(n0 + EPS * t);
  vec3 nb = normalize(n0 + EPS * b);

  // Displacement heights at all three sample points.
  float h  = displace(n0);
  float ht = displace(nt);
  float hb = displace(nb);

  // Prevent radius inversion under extreme noise amplitudes.
  float r0 = max(0.05, u_radius + h);
  vec3  d0 = r0 * n0;
  vec3  dt = max(0.05, u_radius + ht) * nt;
  vec3  db = max(0.05, u_radius + hb) * nb;

  // Outward surface normal from the cross product of displaced tangents.
  // Because cross(t, b) = n0 points outward, cross(dt-d0, db-d0)
  // also points outward for small EPS.
  vec3 N = normalize(cross(dt - d0, db - d0));

  v_normal   = N;
  v_height   = h;
  v_worldPos = d0;
  gl_Position = u_proj * u_view * vec4(d0, 1.0);
}
