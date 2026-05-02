// Column-major Float32Array matrices (WebGL convention).

export function mat4Perspective(fovY, aspect, near, far) {
  const f = 1.0 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0]  =  f / aspect;
  m[5]  =  f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function mat4InversePerspective(m) {
  const out = new Float32Array(16);
  out[0]  =  1.0 / m[0];
  out[5]  =  1.0 / m[5];
  out[11] =  1.0 / m[14];
  out[14] =  1.0 / m[11];
  out[15] = -m[10] / (m[11] * m[14]);
  return out;
}

export function mat4InverseRigid(m) {
  const out = new Float32Array(16);
  out[0]=m[0]; out[4]=m[1]; out[8] =m[2];
  out[1]=m[4]; out[5]=m[5]; out[9] =m[6];
  out[2]=m[8]; out[6]=m[9]; out[10]=m[10];
  out[12]=-(m[0]*m[12]+m[1]*m[13]+m[2]*m[14]);
  out[13]=-(m[4]*m[12]+m[5]*m[13]+m[6]*m[14]);
  out[14]=-(m[8]*m[12]+m[9]*m[13]+m[10]*m[14]);
  out[15]=1.0;
  return out;
}

// eye, center, up are [x, y, z] arrays.
export function mat4LookAt(eye, center, up) {
  let fx = center[0]-eye[0], fy = center[1]-eye[1], fz = center[2]-eye[2];
  const fl = Math.sqrt(fx*fx + fy*fy + fz*fz);
  fx /= fl; fy /= fl; fz /= fl;

  let rx = fy*up[2] - fz*up[1];
  let ry = fz*up[0] - fx*up[2];
  let rz = fx*up[1] - fy*up[0];
  const rl = Math.sqrt(rx*rx + ry*ry + rz*rz);
  rx /= rl; ry /= rl; rz /= rl;

  const ux = ry*fz - rz*fy;
  const uy = rz*fx - rx*fz;
  const uz = rx*fy - ry*fx;

  const m = new Float32Array(16);
  m[0]=rx;  m[4]=ry;  m[8] =rz;  m[12]=-(rx*eye[0]+ry*eye[1]+rz*eye[2]);
  m[1]=ux;  m[5]=uy;  m[9] =uz;  m[13]=-(ux*eye[0]+uy*eye[1]+uz*eye[2]);
  m[2]=-fx; m[6]=-fy; m[10]=-fz; m[14]=  fx*eye[0]+fy*eye[1]+fz*eye[2];
  m[15]=1;
  return m;
}
