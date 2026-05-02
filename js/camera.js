import { mat4LookAt } from './math.js';

// Spherical orbit camera around the world origin.
// Elevation is clamped to +-1.5 rad to avoid gimbal lock at +-pi/2.
export const cam = {
  azimuth:   0.5,
  elevation: 0.35,
  distance:  3.2,
  dragging:  false,
  lastX: 0, lastY: 0,
  pinchDist: 0,
};

export function getEyePos() {
  const cosEl = Math.cos(cam.elevation);
  return [
    cam.distance * cosEl * Math.sin(cam.azimuth),
    cam.distance * Math.sin(cam.elevation),
    cam.distance * cosEl * Math.cos(cam.azimuth),
  ];
}

export function computeViewMatrix() {
  return mat4LookAt(getEyePos(), [0, 0, 0], [0, 1, 0]);
}

export function initOrbitControls(canvas) {
  const ORBIT = 0.005;
  const ZOOM  = 0.001;
  const DMIN  = 1.3, DMAX = 9.0;

  canvas.addEventListener('mousedown', e => {
    cam.dragging = true;
    cam.lastX = e.clientX;
    cam.lastY = e.clientY;
    canvas.classList.add('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!cam.dragging) return;
    cam.azimuth   -= (e.clientX - cam.lastX) * ORBIT;
    cam.elevation += (e.clientY - cam.lastY) * ORBIT;
    cam.elevation  = Math.max(-1.5, Math.min(1.5, cam.elevation));
    cam.lastX = e.clientX;
    cam.lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    cam.dragging = false;
    canvas.classList.remove('dragging');
  });
  canvas.addEventListener('wheel', e => {
    cam.distance += e.deltaY * ZOOM * cam.distance;
    cam.distance   = Math.max(DMIN, Math.min(DMAX, cam.distance));
  }, { passive: true });

  // Touch orbit + pinch-zoom
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      cam.dragging = true;
      cam.lastX = e.touches[0].clientX;
      cam.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      cam.dragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      cam.pinchDist = Math.sqrt(dx*dx + dy*dy);
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && cam.dragging) {
      cam.azimuth   -= (e.touches[0].clientX - cam.lastX) * ORBIT;
      cam.elevation += (e.touches[0].clientY - cam.lastY) * ORBIT;
      cam.elevation  = Math.max(-1.5, Math.min(1.5, cam.elevation));
      cam.lastX = e.touches[0].clientX;
      cam.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d  = Math.sqrt(dx*dx + dy*dy);
      cam.distance  = Math.max(DMIN, Math.min(DMAX, cam.distance * (cam.pinchDist / d)));
      cam.pinchDist = d;
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { cam.dragging = false; });
}
