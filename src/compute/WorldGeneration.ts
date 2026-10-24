import type { vec3 } from 'gl-matrix';
import type { BlockType as BlockTypeType } from 'compute/WorldConstants';
import type { Generator } from 'workers/World';

export const GeneratorDefault = (((BlockType: typeof BlockTypeType, size: vec3) => {
  const center = new Float32Array([size[0] * 0.5, size[1] * 0.5, size[2] * 0.5]);
  const radiusSQ = Math.min(center[0], center[1], center[2]) ** 2;
  const holeSQ = (Math.min(size[0], size[1], size[2]) / 4) ** 2;
  return (x: number, y: number, z: number) => {
    x -= center[0];
    y -= center[1];
    z -= center[2];
    if (
      (
        (x ** 2 + y ** 2) >= holeSQ
      ) && (
        (z ** 2 + y ** 2) >= holeSQ
      ) && !(
        x > -16
        && x < 16
        && z > -16
        && z < 16
      ) && (
        (x ** 2 + y ** 2 + z ** 2) >= radiusSQ
      )
    ) {
      return BlockType.block;
    }
    return BlockType.air;
  };
}) satisfies Generator).toString();

export const GeneratorEscher = (((BlockType: typeof BlockTypeType, size: vec3) => {
  const center = new Float32Array([size[0] * 0.5, size[1] * 0.5, size[2] * 0.5]);
  return (x: number, y: number, z: number) => {
    x -= center[0] - 0.5;
    y -= center[1] - 0.5;
    z -= center[2] - 0.5;
    if (
      Math.abs(x) === 2.5
      && Math.abs(y) === 2.5
      && Math.abs(z) === 2.5
    ) {
      return BlockType.light;
    }
    if (
      (
        Math.abs(x) <= 3
        && Math.abs(y) <= 3
        && Math.abs(z) <= 3
      ) || (
        Math.abs(x) <= 1
        && Math.abs(y) <= 1
      ) || (
        Math.abs(x) <= 1
        && Math.abs(z) <= 1
      ) || (
        Math.abs(y) <= 1
        && Math.abs(z) <= 1
      )
    ) {
      return BlockType.block;
    }
    return BlockType.air;
  };
}) satisfies Generator).toString();
