# MyLittlePlanet

A self-contained procedural planet renderer built with WebGL.

**[Live demo on GitHub Pages →](https://wonderwice.github.io/MyLittlePlanet/)**

---

## Features

- **UV sphere** generated in JavaScript — parametric (φ, θ) coordinates, 128×128 quad resolution
- **Vertex displacement** via FBM noise sampled at the undisplaced sphere surface
- **Domain warping** (two-level Inigo Quilez warp) for organic, non-isotropic terrain
- **Finite-difference normals** computed in the vertex shader — three displacement samples per vertex, correct curvature across all terrain heights
- **Blinn-Phong lighting** with a height-based terrain color palette (deep ocean → ocean → beach → lowland → highland → mountain → snow)
- **Mouse orbit** (drag) + **scroll zoom** + **touch pinch-zoom** for mobile
- **HTML sliders**: radius, noise frequency/amplitude/octaves/lacunarity/gain, warp strength/frequency/octaves, sun azimuth/elevation, specular power
- **Auto-rotate** toggle and **Reset** button
- **FPS counter**
- **blog.html** — educational companion explaining the math: parametric surfaces, FBM, domain warping, and the limits of vertex displacement vs ray marching

---

## File Structure

```
MyLittlePlanet/
├── index.html         
├── css/
│   └── style.css       
├── shaders/
│   ├── vertex.glsl     UV sphere → displacement → normals
│   └── fragment.glsl   Terrain palette + Blinn-Phong lighting
├── js/
│   ├── math.js         mat4Perspective, mat4LookAt
│   ├── sphere.js       buildSphere() — UV buffer + index buffer
│   ├── glUtils.js      compileShader(), createProgram()
│   ├── camera.js       Orbit state, view matrix, mouse/touch controls
│   ├── controls.js     params, SLIDER_DEFS, buildPanel(), getLightDir()
│   └── main.js         Entry point: fetch shaders, WebGL init, render loop
├── blog.html           Educational companion page
├── README.md
```

## Controls Reference

| Slider group | Slider | Range | What it does |
|---|---|---|---|
| Geometry | Radius | 0.3 – 2.0 | Base sphere radius |
| Noise | Frequency | 0.1 – 8.0 | Spatial frequency of the main noise |
| Noise | Amplitude | 0.0 – 0.8 | Max displacement height |
| Noise | Octaves | 1 – 10 | Number of FBM layers |
| Noise | Lacunarity | 1.0 – 4.0 | Frequency multiplier per octave (2 = each octave is 2× finer) |
| Noise | Gain | 0.1 – 0.9 | Amplitude multiplier per octave (0.5 = each octave is half as strong) |
| Warp | Strength | 0.0 – 2.5 | Domain warp intensity (0 = pure FBM, no warp) |
| Warp | Frequency | 0.1 – 4.0 | Frequency of the warp noise |
| Warp | Octaves | 1 – 6 | Octaves in the warp FBM |
| Lighting | Sun Azimuth | −180 – 180° | Horizontal angle of the sun |
| Lighting | Sun Elevation | 5 – 85° | Vertical angle of the sun above the horizon |
| Lighting | Specular Pwr | 1 – 128 | Phong specular exponent (ocean shininess) |

---

## Technical Notes

- **Normals** are computed via finite differences entirely on the GPU; no CPU-side normal calculation
- **Pole singularity** is avoided by clamping the θ sample coordinate to [2·eps, 1−2·eps] during finite-difference evaluation

---

## Browser Compatibility

The app has been tested on:
- Chrome / Chromium 120+
- Firefox 121+
- Safari 17+

---

## License

MIT — do whatever you like with it.
