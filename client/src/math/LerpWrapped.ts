import { vec3 } from 'gl-matrix';

const targets = Array.from({ length: 3 * 3 * 3 }, () => vec3.create());
const thresholdSQ = 0.001 ** 2;

export const LerpWrapped = (
  out: vec3,
  from: vec3,
  to: vec3,
  size: vec3,
  delta: number,
  lambda: number = 40
) => {
  for (let i = 0, z = -1; z <= 1; z++) {
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++, i++) {
        const target = targets[i];
        vec3.set(target, x, y, z);
        vec3.multiply(target, target, size);
        vec3.add(target, target, from);
      }
    }
  }
  targets.sort((a, b) => vec3.sqrDist(a, to) - vec3.sqrDist(b, to));
  if (vec3.sqrDist(targets[0], to) > thresholdSQ) {
    vec3.lerp(
      out,
      targets[0],
      to,
      Math.exp(-lambda * delta)
    );
    return true;
  }
  return false;
};
