import { vec2, vec3 } from 'gl-matrix';
import { BlockModel, BlockType, ChunkSize, getModel, getTexture, isCulled, isOpaque, LightColor, MaxLight } from '@shared/WorldConstants';
import type { VoxelVolume } from 'compute/VoxelVolume';
import { type Face, Models } from 'compute/VoxelModels';

const maxVoxelCount = (ChunkSize ** 3) / 2;
const maxFacesCount = maxVoxelCount * 6;
const vertexSize = (
  3   // position
  + 3 // normal
  + 2 // uv
  + 1 // light
  + 1 // info
);

const counts = {
  faces: 0,
  vertices: 0,
  indexOffset: 0,
  vertexOffset: 0,
};
const index = new Uint16Array(maxFacesCount * 6);
const vertices = new Float32Array(maxFacesCount * 4 * vertexSize);
const lightmap = new Uint8Array(ChunkSize ** 3);

const getLight = (value: number) => (
  Math.max(value ** 2, 0.02)
);

const aux = vec3.create();
const lighting = {
  ao: new Float32Array(4),
  light: new Float32Array(4),
};
const vtangent = vec3.create();
const vbitangent = vec3.create();
const vUV = [
  vec2.fromValues(-1,  1),
  vec2.fromValues(-1, -1),
  vec2.fromValues( 1,  1),
  vec2.fromValues( 1, -1),
];
const getLighting = (
  face: Face,
  model: BlockModel,
  neighbor: Uint8Array,
  neighborPosition: vec3,
  volume: VoxelVolume
) => {
  switch (model) {
    case BlockModel.lightS:
    case BlockModel.lightW:
    case BlockModel.lightE:
    case BlockModel.lightN:
    case BlockModel.lightT:
    case BlockModel.lightB:
      lighting.ao.fill(1);
      lighting.light.fill(1);
      return lighting;
  }
  for (let i = 0; i < 4; i++) {
    vec3.scale(vtangent, face.tangent, vUV[i][0]);
    vec3.scale(vbitangent, face.bitangent, vUV[i][1]);
    const n1 = volume.sample(volume.wrap(vec3.add(aux, neighborPosition, vtangent)));
    const n2 = volume.sample(volume.wrap(vec3.add(aux, neighborPosition, vbitangent)));
    const n3 = volume.sample(volume.wrap(vec3.add(aux, vec3.add(aux, neighborPosition, vtangent), vbitangent)));
    let ao = 1.0;
    if (isOpaque(n1[0])) ao -= 0.2;
    if (isOpaque(n2[0])) ao -= 0.2;
    if ((!isOpaque(n1[0]) || !isOpaque(n2[0])) && isOpaque(n3[0])) ao -= 0.2;
    lighting.ao[i] = ao;

    let lightAcc = 0.0;
    let lightCount = 0;
    if (!isOpaque(neighbor[0])) {
      lightAcc += neighbor[1];
      lightCount++;
    }
    if (!isOpaque(n1[0])) {
      lightAcc += n1[1];
      lightCount++;
    }
    if (!isOpaque(n2[0])) {
      lightAcc += n2[1];
      lightCount++;
    }
    if ((!isOpaque(n1[0]) || !isOpaque(n2[0])) && !isOpaque(n3[0])) {
      lightAcc += n3[1];
      lightCount++;
    }
    if (lightCount > 0) {
      lightAcc /= MaxLight * lightCount; 
    }
    lighting.light[i] = getLight(lightAcc);
  }
  return lighting;
};

const info = new Uint32Array(1);
const pushFace = (
  blockType: BlockType,
  face: Face,
  lighting: { ao: Float32Array; light: Float32Array },
  voxel: vec3
) => {
  const flip = (
    (lighting.light[0] + lighting.light[3]) * (lighting.ao[2] + lighting.ao[1])
    < (lighting.light[2] + lighting.light[1]) * (lighting.ao[0] + lighting.ao[3])
  );
  for (let i = 0; i < 6; i++) {
    index[counts.indexOffset + i] = counts.vertices + (flip ? face.flipIndex[i] : face.index[i]);
  }
  info[0] = (
    (blockType & 0xFF) << 16
    | ((blockType < BlockType.block ? LightColor : (blockType - BlockType.block)) & 0xFF) << 8
    | (getTexture(blockType) & 0xFF)
  );
  for (let i = 0; i < 4; i++) {
    vertices.set([
      voxel[0] + 0.5 + face.position[i][0],
      voxel[1] + 0.5 + face.position[i][1],
      voxel[2] + 0.5 + face.position[i][2],
      face.normal[0],
      face.normal[1],
      face.normal[2],
      face.uv[i][0],
      face.uv[i][1],
      lighting.light[i] * lighting.ao[i],
      new Float32Array(info.buffer, 0, 1)[0],
    ], counts.vertexOffset + i * vertexSize);
  }
  counts.faces++;
  counts.vertices += 4;
  counts.indexOffset += 6;
  counts.vertexOffset += 4 * vertexSize;
};

const origin = vec3.create();
const position = vec3.create();
const neighborPosition = vec3.create();
const voxel = vec3.create();
export const VoxelMesher = (
  chunk: vec3,
  volume: VoxelVolume
) => {
  counts.faces = counts.vertices = counts.indexOffset = counts.vertexOffset = 0;
  vec3.scale(origin, chunk, ChunkSize);
  for (let z = 0, i = 0; z < ChunkSize; z++) {
    for (let y = 0; y < ChunkSize; y++) {
      for (let x = 0; x < ChunkSize; x++, i++) {
        vec3.set(voxel, x, y, z);
        vec3.add(position, origin, voxel);
        const block = volume.sample(position);
        lightmap[i] = Math.round(getLight(block[1] / MaxLight) * 0xFF);
        if (block[0] === BlockType.air) {
          continue;
        }
        const model = getModel(block[0]);
        for (let i = 0, l = Models[model].length; i < l; i++) {
          const face = Models[model][i];
          volume.wrap(vec3.add(neighborPosition, position, face.normal));
          const neighbor = volume.sample(neighborPosition);
          if (!isCulled(block[0], neighbor[0], i)) {
            pushFace(
              block[0],
              face,
              getLighting(face, model, neighbor, neighborPosition, volume),
              voxel
            );
          }
        }
      }
    }
  }
  return {
    index: new Uint16Array(index.subarray(0, counts.faces * 6)),
    vertices: new Float32Array(vertices.subarray(0, counts.faces * 4 * vertexSize)),
    lightmap,
  };
};
