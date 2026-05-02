precision highp float;

uniform vec3  u_lightDir;   // normalized, world-space sun direction
uniform vec3  u_eyePos;     // camera position, world-space
uniform float u_specPower;
uniform float u_noiseAmp;   // used to normalize height [0,1]

varying vec3  v_normal;
varying float v_height;
varying vec3  v_worldPos;

// ═══════════════════════════════════════════════════════════
// TERRAIN COLOR PALETTE
//
// t is the normalized height:
//   t = 0   → maximum depression  (deep ocean floor)
//   t = 0.5 → undisplaced sphere surface  (sea level)
//   t = 1   → maximum elevation  (mountain peak)
//
// ═══════════════════════════════════════════════════════════
vec3 terrainColor(float t) {
  vec3 deepOcean = vec3(0.063, 0.071, 0.176);   // #101230
  vec3 ocean     = vec3(0.071, 0.165, 0.388);   // #122a63
  vec3 shallows  = vec3(0.110, 0.310, 0.490);   // #1c4f7d
  vec3 beach     = vec3(0.875, 0.780, 0.565);   // #dfc790
  vec3 lowland   = vec3(0.255, 0.467, 0.294);   // #41774b
  vec3 highland  = vec3(0.380, 0.420, 0.235);   // #616b3c
  vec3 mountain  = vec3(0.498, 0.447, 0.376);   // #7f7260
  vec3 snow      = vec3(0.930, 0.940, 0.975);   // #edf0f8

  vec3 col = deepOcean;
  col = mix(col, ocean,    smoothstep(0.00, 0.24, t));
  col = mix(col, shallows, smoothstep(0.24, 0.38, t));
  col = mix(col, beach,    smoothstep(0.38, 0.44, t));
  col = mix(col, lowland,  smoothstep(0.44, 0.55, t));
  col = mix(col, highland, smoothstep(0.56, 0.70, t));
  col = mix(col, mountain, smoothstep(0.71, 0.84, t));
  col = mix(col, snow,     smoothstep(0.85, 0.94, t));
  return col;
}

void main() {
  vec3 N = normalize(v_normal);
  vec3 L = normalize(u_lightDir);
  vec3 V = normalize(u_eyePos - v_worldPos);
  vec3 H = normalize(L + V);           // Blinn-Phong half-vector

  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), u_specPower);

  // Normalized height: 0 = deepest depression, 0.5 = sea level, 1 = peak
  float t = clamp(v_height / (u_noiseAmp * 2.0) + 0.5, 0.0, 1.0);

  // Specular highlight only on water
  float waterMask = 1.0 - smoothstep(0.38, 0.46, t);

  vec3 base = terrainColor(t);

  vec3 lit = base * (0.18 + diff * 0.82)
           + vec3(0.85, 0.92, 1.0) * spec * waterMask * 0.55;

  // Atmospheric rim
  float rim = pow(1.0 - max(dot(N, V), 0.0), 5.0) * 0.06;
  lit += vec3(0.25, 0.45, 0.90) * rim;

  gl_FragColor = vec4(lit, 1.0);
}
