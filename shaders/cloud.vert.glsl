precision highp float;

attribute vec2 a_pos;
varying vec2 v_ndc;

void main() {
  v_ndc = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
