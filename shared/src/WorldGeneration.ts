import type aleaType from 'alea';
import type { BlockType as BlockTypeType, Generator } from 'WorldConstants';

export const GeneratorCave = (((alea: typeof aleaType, BlockType: typeof BlockTypeType, size: [number, number, number]) => {
  const center = new Float32Array([size[0] * 0.5, size[1] * 0.5, size[2] * 0.5]);
  const radiusSQ = Math.min(center[0], center[1], center[2]) ** 2;
  const holeSQ = (Math.min(size[0], size[1], size[2]) / 4) ** 2;
  const prng = alea('cave');
  const getBlock = (x: number, y: number, z: number) => {
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
      return BlockType.block + 46;
    }
    return BlockType.air;
  };
  const neighbors = [
    [0, 0, 1],
    [0, 0, -1],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ];
  return (x: number, y: number, z: number) => {
    if (x >= center[0]) x -= size[0];
    if (y >= center[1]) y -= size[1];
    if (z >= center[2]) z -= size[2];
    let block = getBlock(x, y, z);
    if (block !== BlockType.air) {
      for (const n of neighbors) {
        const neighbor = getBlock(x + n[0], y + n[1], z + n[2]);
        if (
          neighbor === BlockType.air
          && prng() > 0.99
        ) {
          block = BlockType.light;
          break;
        }
      }
    }
    return block;
  };
}) satisfies Generator).toString();

export const GeneratorEscher = (((_alea: typeof aleaType, BlockType: typeof BlockTypeType, size: [number, number, number]) => {
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
      return BlockType.block + 46;
    }
    return BlockType.air;
  };
}) satisfies Generator).toString();

export const GeneratorPlatform = (((_alea: typeof aleaType, BlockType: typeof BlockTypeType, size: [number, number, number]) => {
  const center = new Float32Array([size[0] * 0.5, size[1] * 0.5, size[2] * 0.5]);
  return (x: number, y: number, z: number) => {
    if (x >= center[0]) x -= size[0];
    if (y >= center[1]) y -= size[1];
    if (z >= center[2]) z -= size[2];
    x += 0.5;
    y += 0.5;
    z += 0.5;
    if (y === -1.5) {
      if (Math.abs(x) <= 1 && Math.abs(z) <= 1) {
        return BlockType.light;
      }
      if (Math.abs(x ** 2 + z ** 2) < 16) {
        return BlockType.block + 46;
      }
    }
    return BlockType.air;
  };
}) satisfies Generator).toString();
