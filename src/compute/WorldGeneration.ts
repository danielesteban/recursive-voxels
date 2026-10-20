import type { vec3 } from 'gl-matrix';
import type { BlockType as BlockTypeType } from 'compute/WorldConstants';
import type { Generator } from 'workers/World';

export const GeneratorDefault = (((BlockType: typeof BlockTypeType, size: vec3) => {
  const center = new Float32Array([size[0] * 0.5, size[1] * 0.5, size[2] * 0.5]);
  const radiusSQ = Math.min(center[0], center[1], center[2]) ** 2;
  const holeSQ = (Math.min(size[0], size[1], size[2]) / 4) ** 2;
  return (x: number, y: number, z: number) => {
    if (
      (
        ((x - center[0])  ** 2 + (y - center[1]) ** 2) >= holeSQ
      )
      && (
        ((z - center[2])  ** 2 + (y - center[1]) ** 2) >= holeSQ
      )
      && !(
        x > center[0] - 16
        && x < center[0] + 16
        && z > center[2] - 16
        && z < center[2] + 16
      )
      && ((z - center[2]) ** 2 + (y - center[1]) ** 2 + (x - center[0]) ** 2) >= radiusSQ
    ) {
      return BlockType.solid;
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
      return BlockType.solid;
    }
    return BlockType.air;
  };
}) satisfies Generator).toString();
