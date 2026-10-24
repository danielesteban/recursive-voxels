import { vec3 } from 'gl-matrix';
import type { VoxelVolume } from 'compute/VoxelVolume';
import { BlockType, ChunkSize } from 'compute/WorldConstants';

const maxBoxesCount = (ChunkSize ** 3) / 2;

const counts = {
  boxes: 0,
  boxOffset: 0,
};
const boxes = new Uint16Array(maxBoxesCount * 6);
const pushBox = (position: vec3, size: vec3) => {
  boxes.set([
    position[0],
    position[1],
    position[2],
    size[0],
    size[1],
    size[2],
  ], counts.boxOffset);
  counts.boxes++;
  counts.boxOffset += 6;
};

const processed = new Set<string>();
const hasProcessed = (voxel: vec3) => {
  return processed.has(`${voxel[0]}:${voxel[1]}:${voxel[2]}`);
};

const origin = vec3.create();
const voxel = vec3.create();
const position = vec3.create();
const size = vec3.create();
export const VoxelPhysics = (
  chunk: vec3,
  volume: VoxelVolume
) => {
  counts.boxes = counts.boxOffset = 0;
  processed.clear();
  vec3.scale(origin, chunk, ChunkSize);
  for (let z = 0; z < ChunkSize; z++) {
    for (let y = 0; y < ChunkSize; y++) {
      for (let x = 0; x < ChunkSize; x++) {
        vec3.set(voxel, x, y, z);
        vec3.add(position, origin, voxel);
        const blockType = volume.sample(position)[0];
        if (
          blockType === BlockType.air
          || hasProcessed(voxel)
        ) {
          continue;
        }
        vec3.set(size, 0, 0, 0);

        // @dani @incomplete
        // Handle lights special case

        for (let i = z + 1; i <= ChunkSize; i++) {
          vec3.set(voxel, x, y, i);
          vec3.add(position, origin, voxel);
          if (
            i == ChunkSize
            || volume.sample(position)[0] === BlockType.air
            || hasProcessed(voxel)
          ) {
            size[2] = i - z;
            break;
          }
        }

        size[1] = ChunkSize - y;
        for (let i = z; i < z + size[2]; i++) {
          for (let j = y + 1; j <= y + size[1]; j++) {
            vec3.set(voxel, x, j, i);
            vec3.add(position, origin, voxel);
            if (
              j == ChunkSize
              || volume.sample(position)[0] === BlockType.air
              || hasProcessed(voxel)
            ) {
              size[1] = j - y;
            }
          }
        }

        size[0] = ChunkSize - x;
        for (let i = z; i < z + size[2]; i++) {
          for (let j = y; j < y + size[1]; j++) {
            for (let k = x + 1; k <= x + size[0]; k++) {
              vec3.set(voxel, k, j, i);
              vec3.add(position, origin, voxel);
              if (
                k == ChunkSize
                || volume.sample(position)[0] === BlockType.air
                || hasProcessed(voxel)
              ) {
                size[0] = k - x;
              }
            }
          }
        }

        for (let i = z; i < z + size[2]; i++) {
          for (let j = y; j < y + size[1]; j++) {
            for (let k = x; k < x + size[0]; k++) {
              vec3.set(voxel, k, j, i);
              processed.add(`${voxel[0]}:${voxel[1]}:${voxel[2]}`);
            }
          }
        }

        pushBox(vec3.set(voxel, x, y, z), size);
      }
    }
  }
  return boxes.subarray(0, counts.boxes * 6);
};
