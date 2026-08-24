// Tiny vec3 helpers, deliberately named to mirror the Quake 2 macros in pmove.c
// (DotProduct, VectorNormalize, VectorScale, VectorMA, CrossProduct, ...) so the
// JS port in physics.js reads like a transliteration of the C, not a rewrite.

function vec3(x = 0, y = 0, z = 0) {
  return [x, y, z];
}

function VectorCopy(a, out) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

function VectorClear(v) {
  v[0] = 0;
  v[1] = 0;
  v[2] = 0;
  return v;
}

function DotProduct(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function VectorAdd(a, b, out) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

function VectorSubtract(a, b, out) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

function VectorScale(v, scale, out) {
  out[0] = v[0] * scale;
  out[1] = v[1] * scale;
  out[2] = v[2] * scale;
  return out;
}

// out = veca + scale * vecb  (Quake's "vector multiply-add")
function VectorMA(veca, scale, vecb, out) {
  out[0] = veca[0] + scale * vecb[0];
  out[1] = veca[1] + scale * vecb[1];
  out[2] = veca[2] + scale * vecb[2];
  return out;
}

function VectorLength(v) {
  return Math.sqrt(DotProduct(v, v));
}

// Normalizes v in place, returns the original length (exactly like Q2's VectorNormalize).
function VectorNormalize(v) {
  const length = VectorLength(v);
  if (length) {
    const inv = 1 / length;
    v[0] *= inv;
    v[1] *= inv;
    v[2] *= inv;
  }
  return length;
}

function CrossProduct(a, b, out) {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

// Builds forward/right unit vectors on the horizontal plane from a yaw angle
// (radians). This is a 2D stand-in for Q2's AngleVectors() — pitch/roll are
// irrelevant to horizontal air-strafing, which is the entire subject of this
// app, so they're omitted rather than faked.
function AngleVectorsYaw(yawRad, forwardOut, rightOut) {
  const sy = Math.sin(yawRad);
  const cy = Math.cos(yawRad);
  forwardOut[0] = cy;
  forwardOut[1] = sy;
  forwardOut[2] = 0;
  // Quake's right vector is forward rotated -90 degrees (clockwise from above).
  rightOut[0] = sy;
  rightOut[1] = -cy;
  rightOut[2] = 0;
  return { forward: forwardOut, right: rightOut };
}
