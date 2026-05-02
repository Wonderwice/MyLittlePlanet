// Planet parameters — the single source of truth for all sliders.
export const params = {
  radius:       1.0,
  noiseFreq:    1.8,
  noiseAmp:     0.25,
  octaves:      6,
  lacunarity:   2.0,
  gain:         0.5,
  warpStrength: 0.45,
  warpFreq:     1.2,
  warpOctaves:  3,
  lightAzimuth: 45,
  lightElev:    60,
  specPower:    32.0,
  autoRotate:   false,
  rotateSpeed:  0.003,
  cloudCoverage: 0.45,
  cloudDensity:  1.2,
  cloudHeight:   0.12,
  cloudFreq:     2.5,
  cloudSpeed:    0.03,
};

// [group, paramKey, label, min, max, step, defaultValue]
export const SLIDER_DEFS = [
  ['Geometry', 'radius',       'Radius',        0.3, 2.0,  0.01, 1.0 ],
  ['Noise',    'noiseFreq',    'Frequency',     0.1, 8.0,  0.05, 1.8 ],
  ['Noise',    'noiseAmp',     'Amplitude',     0.0, 0.8,  0.01, 0.25],
  ['Noise',    'octaves',      'Octaves',       1,   10,   1,    6   ],
  ['Noise',    'lacunarity',   'Lacunarity',    1.0, 4.0,  0.05, 2.0 ],
  ['Noise',    'gain',         'Gain',          0.1, 0.9,  0.01, 0.5 ],
  ['Warp',     'warpStrength', 'Strength',      0.0, 2.5,  0.05, 0.45],
  ['Warp',     'warpFreq',     'Frequency',     0.1, 4.0,  0.05, 1.2 ],
  ['Warp',     'warpOctaves',  'Octaves',       1,   6,    1,    3   ],
  ['Lighting', 'lightAzimuth', 'Sun Azimuth', -180, 180,   1,    45  ],
  ['Lighting', 'lightElev',    'Sun Elevation',  5,  85,   1,    60  ],
  ['Lighting', 'specPower',    'Specular Pwr',   1, 128,   1,    32  ],
  ['Clouds',   'cloudCoverage','Coverage',      0.0, 1.0, 0.01, 0.45],
  ['Clouds',   'cloudDensity', 'Density',       0.1, 5.0, 0.05, 1.2 ],
  ['Clouds',   'cloudHeight',  'Height',        0.01,0.3, 0.01, 0.12],
  ['Clouds',   'cloudFreq',    'Frequency',     0.5, 8.0, 0.05, 2.5 ],
  ['Clouds',   'cloudSpeed',   'Speed',         0.0, 0.2, 0.005,0.03],
];

export function getLightDir() {
  const az = params.lightAzimuth * Math.PI / 180;
  const el = params.lightElev    * Math.PI / 180;
  return [
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ];
}

export function buildPanel() {
  const panel  = document.getElementById('panel');
  const btns   = panel.querySelector('.btns');
  const groups = {};

  for (const [grp, key, label, mn, mx, step, def] of SLIDER_DEFS) {
    if (!groups[grp]) {
      const fs  = document.createElement('fieldset');
      const leg = document.createElement('legend');
      leg.textContent = grp;
      fs.appendChild(leg);
      panel.insertBefore(fs, btns);
      groups[grp] = fs;
    }

    const row = document.createElement('div');
    row.className = 'row';

    const lbl = document.createElement('label');
    lbl.textContent = label;

    const val = document.createElement('span');
    val.className   = 'val';
    val.id          = 'v_' + key;
    val.textContent = formatVal(def, step);

    const sl  = document.createElement('input');
    sl.type   = 'range';
    sl.id     = 's_' + key;
    sl.min    = mn;
    sl.max    = mx;
    sl.step   = step;
    sl.value  = def;

    sl.addEventListener('input', () => {
      const v = parseFloat(sl.value);
      params[key]     = (step >= 1) ? Math.round(v) : v;
      val.textContent = formatVal(params[key], step);
    });

    row.appendChild(lbl);
    row.appendChild(val);
    groups[grp].appendChild(row);
    groups[grp].appendChild(sl);
  }

  document.getElementById('btnReset').addEventListener('click', () => {
    for (const [, key, , , , step, def] of SLIDER_DEFS) {
      params[key] = def;
      const sl  = document.getElementById('s_' + key);
      const val = document.getElementById('v_' + key);
      if (sl)  sl.value       = def;
      if (val) val.textContent = formatVal(def, step);
    }
  });

  const btnRot = document.getElementById('btnRotate');
  btnRot.addEventListener('click', () => {
    params.autoRotate = !params.autoRotate;
    btnRot.classList.toggle('active', params.autoRotate);
  });
}

function formatVal(v, step) {
  return step < 1 ? v.toFixed(2) : String(Math.round(v));
}
