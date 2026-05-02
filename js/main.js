import { mat4Perspective, mat4InversePerspective, mat4InverseRigid } from './math.js';
import { buildCubeSphere, LOD_LEVELS, getLODIndex }    from './sphere.js';
import { createProgram }                               from './glUtils.js';
import { cam, getEyePos, computeViewMatrix,
         initOrbitControls }                           from './camera.js';
import { params, buildPanel, getLightDir }             from './controls.js';

// ── FPS counter ────────────────────
const fpsEl  = document.getElementById('fps');
const fpsBuf = new Float32Array(30);
let   fpsIdx = 0, lastTs = 0;

function updateFPS(now, lodLabel) {
  if (lastTs > 0) {
    fpsBuf[fpsIdx % 30] = 1000 / (now - lastTs);
    fpsIdx++;
    if (fpsIdx % 6 === 0) {
      let s = 0;
      for (let i = 0; i < 30; i++) s += fpsBuf[i];
      fpsEl.textContent = 'FPS: ' + (s / 30).toFixed(0) + ' | LOD: ' + lodLabel;
    }
  }
  lastTs = now;
}

// ── Entry point ───────────────────────────────────────────────
async function init() {
  let vsSrc, fsSrc, cloudVsSrc, cloudFsSrc;
  try {
    [vsSrc, fsSrc, cloudVsSrc, cloudFsSrc] = await Promise.all([
      fetch('shaders/vertex.glsl').then(r => r.text()),
      fetch('shaders/fragment.glsl').then(r => r.text()),
      fetch('shaders/cloud.vert.glsl').then(r => r.text()),
      fetch('shaders/cloud.frag.glsl').then(r => r.text()),
    ]);
  } catch (e) {
    document.body.innerHTML =
      '<pre style="color:#f66;padding:24px;font:14px monospace">' +
      'Could not load shaders.\nServe the project over HTTP ' +
      '(e.g. python3 -m http.server 8080).\n\n' + e + '</pre>';
    return;
  }

  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl') ||
             canvas.getContext('experimental-webgl');
  if (!gl) {
    document.body.innerHTML =
      '<p style="color:#f66;font:22px sans-serif;padding:60px">' +
      'WebGL is not supported in this browser.</p>';
    return;
  }

  let prog;
  try {
    prog = createProgram(gl, vsSrc, fsSrc);
  } catch (e) {
    document.body.innerHTML =
      '<pre style="color:#f66;padding:24px;font:13px monospace">' +
      'Shader error:\n' + e.message + '</pre>';
    return;
  }

  let cloudProg;
  try {
    cloudProg = createProgram(gl, cloudVsSrc, cloudFsSrc);
  } catch (e) {
    document.body.innerHTML =
      '<pre style="color:#f66;padding:24px;font:13px monospace">' +
      'Cloud shader error:\n' + e.message + '</pre>';
    return;
  }

  gl.useProgram(prog);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // Fullscreen triangle for cloud post-pass
  const triVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);

  // ── Upload geometry for all LOD levels x 6 faces ─────────────
  // lodMeshes[lodIndex][faceIndex] = { dirBuf, iboBuf, indexCount }
  const lodMeshes = LOD_LEVELS.map(({ res }) =>
    buildCubeSphere(res).map(({ dirData, indices }) => {
      const dirBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, dirBuf);
      gl.bufferData(gl.ARRAY_BUFFER, dirData, gl.STATIC_DRAW);

      const iboBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

      return { dirBuf, iboBuf, indexCount: indices.length };
    })
  );

  // ── Attribute + uniform locations ─────────────────────────
  const loc = {
    aDir:      gl.getAttribLocation( prog, 'a_dir'),
    proj:      gl.getUniformLocation(prog, 'u_proj'),
    view:      gl.getUniformLocation(prog, 'u_view'),
    radius:    gl.getUniformLocation(prog, 'u_radius'),
    noiseFreq: gl.getUniformLocation(prog, 'u_noiseFreq'),
    noiseAmp:  gl.getUniformLocation(prog, 'u_noiseAmp'),
    octaves:   gl.getUniformLocation(prog, 'u_octaves'),
    lacunar:   gl.getUniformLocation(prog, 'u_lacunarity'),
    gain:      gl.getUniformLocation(prog, 'u_gain'),
    warpStr:   gl.getUniformLocation(prog, 'u_warpStrength'),
    warpFreq:  gl.getUniformLocation(prog, 'u_warpFreq'),
    warpOct:   gl.getUniformLocation(prog, 'u_warpOctaves'),
    lightDir:  gl.getUniformLocation(prog, 'u_lightDir'),
    eyePos:    gl.getUniformLocation(prog, 'u_eyePos'),
    specPow:   gl.getUniformLocation(prog, 'u_specPower'),
  };

  const cloudLoc = {
    aPos:       gl.getAttribLocation( cloudProg, 'a_pos'),
    invProj:    gl.getUniformLocation(cloudProg, 'u_invProj'),
    invView:    gl.getUniformLocation(cloudProg, 'u_invView'),
    eyePos:     gl.getUniformLocation(cloudProg, 'u_eyePos'),
    lightDir:   gl.getUniformLocation(cloudProg, 'u_lightDir'),
    time:       gl.getUniformLocation(cloudProg, 'u_time'),
    cloudInner: gl.getUniformLocation(cloudProg, 'u_cloudInner'),
    cloudOuter: gl.getUniformLocation(cloudProg, 'u_cloudOuter'),
    coverage:   gl.getUniformLocation(cloudProg, 'u_coverage'),
    density:    gl.getUniformLocation(cloudProg, 'u_density'),
    cloudFreq:  gl.getUniformLocation(cloudProg, 'u_cloudFreq'),
    cloudSpeed: gl.getUniformLocation(cloudProg, 'u_cloudSpeed'),
  };

  buildPanel();
  initOrbitControls(canvas);
  const startTime = performance.now();

  // ── Per-frame helpers ─────────────────────────────────────
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w   = (canvas.clientWidth  * dpr) | 0;
    const h   = (canvas.clientHeight * dpr) | 0;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function uploadUniforms() {
    const aspect = canvas.width / (canvas.height || 1);
    gl.uniformMatrix4fv(loc.proj, false, mat4Perspective(Math.PI / 4, aspect, 0.1, 100));
    gl.uniformMatrix4fv(loc.view, false, computeViewMatrix());
    gl.uniform1f(loc.radius,    params.radius);
    gl.uniform1f(loc.noiseFreq, params.noiseFreq);
    gl.uniform1f(loc.noiseAmp,  params.noiseAmp);
    gl.uniform1i(loc.octaves,   params.octaves);      // int → uniform1i
    gl.uniform1f(loc.lacunar,   params.lacunarity);
    gl.uniform1f(loc.gain,      params.gain);
    gl.uniform1f(loc.warpStr,   params.warpStrength);
    gl.uniform1f(loc.warpFreq,  params.warpFreq);
    gl.uniform1i(loc.warpOct,   params.warpOctaves);  // int → uniform1i
    gl.uniform3fv(loc.lightDir, getLightDir());
    gl.uniform3fv(loc.eyePos,   getEyePos());
    gl.uniform1f(loc.specPow,   params.specPower);
  }

  function uploadCloudUniforms(t) {
    const aspect  = canvas.width / (canvas.height || 1);
    const projMat = mat4Perspective(Math.PI / 4, aspect, 0.1, 100);
    const viewMat = computeViewMatrix();
    gl.uniformMatrix4fv(cloudLoc.invProj,  false, mat4InversePerspective(projMat));
    gl.uniformMatrix4fv(cloudLoc.invView,  false, mat4InverseRigid(viewMat));
    gl.uniform3fv(cloudLoc.eyePos,   getEyePos());
    gl.uniform3fv(cloudLoc.lightDir, getLightDir());
    gl.uniform1f(cloudLoc.time,      t);
    const inner = params.radius + params.noiseAmp + 0.02;
    const outer = inner + params.cloudHeight;
    gl.uniform1f(cloudLoc.cloudInner, inner);
    gl.uniform1f(cloudLoc.cloudOuter, outer);
    gl.uniform1f(cloudLoc.coverage,   params.cloudCoverage);
    gl.uniform1f(cloudLoc.density,    params.cloudDensity);
    gl.uniform1f(cloudLoc.cloudFreq,  params.cloudFreq);
    gl.uniform1f(cloudLoc.cloudSpeed, params.cloudSpeed);
  }

  // ── Render loop ───────────────────────────────────────────
  function render(now) {
    const elapsedSec = (now - startTime) * 0.001;
    resizeCanvas();

    gl.clearColor(0.10, 0.14, 0.28, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (params.autoRotate) cam.azimuth += params.rotateSpeed;

    uploadUniforms();

    // Pick the finest LOD level appropriate for the current camera distance.
    const lodIdx = getLODIndex(cam.distance);
    const faces  = lodMeshes[lodIdx];

    // Draw all 6 cube-sphere faces with the selected LOD mesh.
    for (const { dirBuf, iboBuf, indexCount } of faces) {
      gl.bindBuffer(gl.ARRAY_BUFFER, dirBuf);
      gl.enableVertexAttribArray(loc.aDir);
      gl.vertexAttribPointer(loc.aDir, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboBuf);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // ── Cloud render pass ─────────────────────────────────
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    gl.useProgram(cloudProg);
    uploadCloudUniforms(elapsedSec);
    gl.bindBuffer(gl.ARRAY_BUFFER, triVbo);
    gl.enableVertexAttribArray(cloudLoc.aPos);
    gl.vertexAttribPointer(cloudLoc.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(cloudLoc.aPos);

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.useProgram(prog);

    updateFPS(now, LOD_LEVELS[lodIdx].label);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

init();
