precision highp float;

uniform mat4  u_invProj;
uniform mat4  u_invView;
uniform vec3  u_eyePos;
uniform vec3  u_lightDir;
uniform float u_time;
uniform float u_cloudInner;
uniform float u_cloudOuter;
uniform float u_coverage;
uniform float u_density;
uniform float u_cloudFreq;
uniform float u_cloudSpeed;

varying vec2 v_ndc;

// ── Noise ─────────────────────────────────────────────────────

float hash3(vec3 p) {
  p  = fract(p * 0.3183099 + vec3(0.1));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
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
    mix(mix(v000,v100,u.x), mix(v010,v110,u.x), u.y),
    mix(mix(v001,v101,u.x), mix(v011,v111,u.x), u.y),
    u.z);
  return r * 2.0 - 1.0;
}

// Full-quality FBM (6 octaves) for primary density samples
float fbm(vec3 p) {
  float val=0., amp=0.5, freq=1., norm=0.;
  for (int i = 0; i < 6; i++) {
    val  += amp * valueNoise(p * freq);
    norm += amp; freq *= 2.0; amp *= 0.5;
  }
  return val / norm;
}

// Cheap FBM (3 octaves) used only in shadow light-march
float fbmFast(vec3 p) {
  float val=0., amp=0.5, freq=1., norm=0.;
  for (int i = 0; i < 3; i++) {
    val  += amp * valueNoise(p * freq);
    norm += amp; freq *= 2.0; amp *= 0.5;
  }
  return val / norm;
}

// ── Density ───────────────────────────────────────────────────

vec3 cloudScroll(vec3 p) {
  return p + vec3(u_time * u_cloudSpeed, 0.0, u_time * u_cloudSpeed * 0.7);
}

float densityAt(float r, float noise) {
  float h       = (r - u_cloudInner) / (u_cloudOuter - u_cloudInner);
  float falloff = smoothstep(0.0, 0.15, h) * smoothstep(1.0, 0.85, h);
  return max(0.0, noise - (1.0 - u_coverage)) * u_density * falloff;
}

float sceneDensity(vec3 p) {
  float r = length(p);
  if (r < u_cloudInner || r > u_cloudOuter) return 0.0;
  return densityAt(r, fbm(cloudScroll(p) * u_cloudFreq));
}

float sceneDensityFast(vec3 p) {
  float r = length(p);
  if (r < u_cloudInner || r > u_cloudOuter) return 0.0;
  return densityAt(r, fbmFast(cloudScroll(p) * u_cloudFreq));
}

// ── Geometry ──────────────────────────────────────────────────

vec2 raySphereIntersect(vec3 ro, vec3 rd, float r) {
  float b    = dot(ro, rd);
  float c    = dot(ro, ro) - r * r;
  float disc = b * b - c;
  if (disc < 0.0) return vec2(-1.0);
  float sq = sqrt(disc);
  return vec2(-b - sq, -b + sq);
}

bool raySphereShellIntersect(vec3 ro, vec3 rd,
                              float rInner, float rOuter,
                              out float tEnter, out float tExit) {
  vec2 outer = raySphereIntersect(ro, rd, rOuter);
  if (outer.y < 0.0) return false;
  vec2 inner = raySphereIntersect(ro, rd, rInner);
  tEnter = max(outer.x, 0.0);
  tExit  = (inner.x > 0.0) ? inner.x : outer.y;
  return tExit > tEnter;
}

// ── Lighting ──────────────────────────────────────────────────

// March toward sun with cheap density; returns Beer-Lambert transmittance
float lightmarch(vec3 p) {
  float stepSz = (u_cloudOuter - u_cloudInner) / 6.0;
  float shadow = 0.0;
  for (int i = 0; i < 6; i++) {
    p      += u_lightDir * stepSz;
    shadow += sceneDensityFast(p) * stepSz;
  }
  return exp(-shadow * 40.0);
}

// HG phase normalized to 1.0 at cosTheta=0 (side scatter); forward peak clamped to 3
float henyeyGreenstein(float cosTheta, float g) {
  float g2    = g * g;
  float p     = (1.0 - g2) / pow(max(0.0001, 1.0 + g2 - 2.0*g*cosTheta), 1.5);
  float pSide = (1.0 - g2) / pow(1.0 + g2, 1.5);
  return clamp(p / pSide, 0.0, 3.0);
}

// ── Ray reconstruction ────────────────────────────────────────

vec3 reconstructRayDir() {
  vec4 clip    = vec4(v_ndc, 1.0, 1.0);
  vec4 view4   = u_invProj * clip;
  vec3 viewDir = view4.xyz / view4.w;
  vec4 world4  = u_invView * vec4(viewDir, 0.0);
  return normalize(world4.xyz);
}

// ── Primary raymarch ──────────────────────────────────────────

// Absorption scale: density=1 over cloudHeight gives around 98 percent extinction.
// Raised so each thin step contributes meaningful radiance.
const float SIGMA = 40.0;

vec4 raymarch(vec3 ro, vec3 rd) {
  float tEnter, tExit;
  if (!raySphereShellIntersect(ro, rd, u_cloudInner, u_cloudOuter, tEnter, tExit))
    return vec4(0.0);

  float stepSz = (tExit - tEnter) / 64.0;
  float jitter = hash3(vec3(gl_FragCoord.xy, u_time)) * stepSz;
  float t      = tEnter + jitter;
  float T      = 1.0;
  vec3  L      = vec3(0.0);

  float cosTheta = dot(rd, u_lightDir);
  float phase    = henyeyGreenstein(cosTheta, 0.65);

  for (int i = 0; i < 64; i++) {
    if (t >= tExit || T < 0.01) break;

    vec3 p = ro + rd * t;

    // Skip marching once we reach the planet — no clouds inside the inner sphere
    if (length(p) < u_cloudInner) break;

    float density = sceneDensity(p);

    if (density > 0.001) {
      float sunLight = lightmarch(p);

      float lum      = clamp(sunLight * phase, 0.0, 1.0);
      vec3  cloudCol = mix(vec3(0.50, 0.55, 0.65),  // shadow: cool blue-grey
                           vec3(1.00, 0.98, 0.95),  // lit:    warm white
                           lum);

      float absorb = density * stepSz * SIGMA;
      L += T * cloudCol * absorb;
      T *= exp(-absorb);
    }
    t += stepSz;
  }

  return vec4(L, 1.0 - T);
}

void main() {
  vec3 rd = reconstructRayDir();
  if(u_coverage < 0.01) {
    gl_FragColor = vec4(0.0);
    return;
  }
  gl_FragColor = raymarch(u_eyePos, rd);
}
