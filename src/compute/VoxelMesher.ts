import { mat4, vec2, vec3 } from 'gl-matrix';
import type { VoxelVolume } from 'compute/VoxelVolume';
import { BlockType, ChunkSize, MaxLight } from 'compute/WorldConstants';
import { Plane } from 'render/Primitives';

const maxVoxelCount = (ChunkSize ** 3) / 2;
const maxFacesCount = maxVoxelCount * 6;
const vertexSize = (
  3   // position
  + 3 // normal
  + 2 // uv
  + 1 // blockType
  + 1 // light
);

const face = (() => {
  const position: vec3[] = [];
  const uv: vec2[] = [];
  const transform = mat4.fromTranslation(mat4.create(), vec3.fromValues(0, 0, 0.5));
  for (let i = 0, l = Plane.vertices.length; i < l; i += 8) {
    position.push(
      vec3.transformMat4(vec3.create(), Plane.vertices.subarray(i, i + 3), transform)
    );
    uv.push(
      vec2.copy(vec2.create(), Plane.vertices.subarray(i + 6, i + 8))
    );
  }
  return {
    index: Plane.index,
    flipIndex: new Uint16Array([1,3,0,3,2,0]),
    position,
    uv,
  };
})();

const applyTransform = (position: vec3[], transform: mat4) => {
  position = [...position];
  for (let i = 0, l = position.length; i < l; i++) {
    position[i] = vec3.transformMat4(vec3.create(), position[i], transform);
  }
  return position;
};

const faces = [
  // south
  {
    ...face,
    normal: vec3.fromValues(0, 0, 1),
    tangent: vec3.fromValues(1, 0, 0),
    bitangent: vec3.fromValues(0, 1, 0),
  },
  // west
  {
    ...face,
    normal: vec3.fromValues(-1, 0, 0),
    tangent: vec3.fromValues(0, 0, 1),
    bitangent: vec3.fromValues(0, 1, 0),
    position: applyTransform(
      face.position,
      mat4.fromRotation(mat4.create(), Math.PI * -0.5, vec3.fromValues(0, 1, 0)),
    ),
  },
  // east
  {
    ...face,
    normal: vec3.fromValues(1, 0, 0),
    tangent: vec3.fromValues(0, 0, -1),
    bitangent: vec3.fromValues(0, 1, 0),
    position: applyTransform(
      face.position,
      mat4.fromRotation(mat4.create(), Math.PI * 0.5, vec3.fromValues(0, 1, 0)),
    ),
  },
  // north
  {
    ...face,
    normal: vec3.fromValues(0, 0, -1),
    tangent: vec3.fromValues(-1, 0, 0),
    bitangent: vec3.fromValues(0, 1, 0),
    position: applyTransform(
      face.position,
      mat4.fromRotation(mat4.create(), Math.PI, vec3.fromValues(0, 1, 0)),
    ),
  },
  // top
  {
    ...face,
    normal: vec3.fromValues(0, 1, 0),
    tangent: vec3.fromValues(1, 0, 0),
    bitangent: vec3.fromValues(0, 0, -1),
    position: applyTransform(
      face.position,
      mat4.fromRotation(mat4.create(), Math.PI * -0.5, vec3.fromValues(1, 0, 0)),
    ),
  },
  // bottom
  {
    ...face,
    normal: vec3.fromValues(0, -1, 0),
    tangent: vec3.fromValues(1, 0, 0),
    bitangent: vec3.fromValues(0, 0, 1),
    position: applyTransform(
      face.position,
      mat4.fromRotation(mat4.create(), Math.PI * 0.5, vec3.fromValues(1, 0, 0)),
    ),
  },
];

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
const getLighting = (
  face: typeof faces[0],
  neighbor: Uint8Array,
  neighborPosition: vec3,
  volume: VoxelVolume
) => {
  for (let i = 0; i < 4; i++) {
    vec3.scale(vtangent, face.tangent, faces[0].position[i][0] * 2);
    vec3.scale(vbitangent, face.bitangent, faces[0].position[i][1] * 2);
    const n1 = volume.sample(volume.wrap(vec3.add(aux, neighborPosition, vtangent)));
    const n2 = volume.sample(volume.wrap(vec3.add(aux, neighborPosition, vbitangent)));
    const n3 = volume.sample(volume.wrap(vec3.add(aux, vec3.add(aux, neighborPosition, vtangent), vbitangent)));
    let ao = 1.0;
    if (n1[0] !== BlockType.air) ao -= 0.2;
    if (n2[0] !== BlockType.air) ao -= 0.2;
    if ((n1[0] === BlockType.air || n2[0] === BlockType.air) && n3[0] !== BlockType.air) ao -= 0.2;
    lighting.ao[i] = ao;

    let lightAcc = 0.0;
    let lightCount = 0;
    if (neighbor[0] === BlockType.air) {
      lightAcc += neighbor[1];
      lightCount++;
    }
    if (n1[0] === BlockType.air) {
      lightAcc += n1[1];
      lightCount++;
    }
    if (n2[0] === BlockType.air) {
      lightAcc += n2[1];
      lightCount++;
    }
    if ((n1[0] === BlockType.air || n2[0] === BlockType.air) && n3[0] === BlockType.air) {
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

const pushFace = (
  blockType: BlockType,
  face: typeof faces[0],
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
      blockType - 1,
      lighting.light[i] * lighting.ao[i],
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
        for (const face of faces) {
          volume.wrap(vec3.add(neighborPosition, position, face.normal));
          const neighbor = volume.sample(neighborPosition);
          if (
            neighbor[0] === BlockType.air
          ) {
            pushFace(
              block[0],
              face,
              getLighting(face, neighbor, neighborPosition, volume),
              voxel
            );
          }
        }
      }
    }
  }
  return {
    index: index.subarray(0, counts.faces * 6),
    vertices: vertices.subarray(0, counts.faces * 4 * vertexSize),
    lightmap,
  };
};
