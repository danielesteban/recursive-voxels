import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
import { BlockModel } from 'compute/WorldConstants';
import { Plane } from 'render/Primitives';

export type Face = {
  normal: vec3;
  tangent: vec3;
  bitangent: vec3;
  index: Uint16Array;
  flipIndex: Uint16Array;
  position: vec3[];
  uv: vec2[];
};

const normalTransform = mat3.create();
const transformNormal = (normal: vec3, transform: mat4) => {
  mat3.normalFromMat4(normalTransform, transform);
  const transformed = vec3.transformMat3(vec3.create(), normal, normalTransform);
  vec3.normalize(transformed, transformed);
  return transformed;
};

const transformPosition = (position: vec3[], transform: mat4) => {
  position = [...position];
  for (let i = 0, l = position.length; i < l; i++) {
    position[i] = vec3.transformMat4(vec3.create(), position[i], transform);
  }
  return position;
};

const transformModel = (model: Face[], transform: mat4) => {
  model = [...model];
  for (let i = 0, l = model.length; i < l; i++) {
    model[i] = {
      ...model[i],
      normal: transformNormal(model[i].normal, transform),
      tangent: transformNormal(model[i].tangent, transform),
      bitangent: transformNormal(model[i].bitangent, transform),
      position: transformPosition(model[i].position, transform),
    };
  }
  return model;
};

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

const blockModel: Face[] = [
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
    position: transformPosition(
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
    position: transformPosition(
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
    position: transformPosition(
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
    position: transformPosition(
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
    position: transformPosition(
      face.position,
      mat4.fromRotation(mat4.create(), Math.PI * 0.5, vec3.fromValues(1, 0, 0)),
    ),
  },
];

const rotation = quat.create();

export const Models = {
  [BlockModel.block]: blockModel,
  [BlockModel.lightS]: transformModel(
    blockModel,
    mat4.fromRotationTranslationScale(mat4.create(), rotation, vec3.fromValues(0, 0, -0.4375), vec3.fromValues(0.25, 0.75, 0.125)),
  ),
  [BlockModel.lightW]: transformModel(
    blockModel,
    mat4.fromRotationTranslationScale(mat4.create(), rotation, vec3.fromValues(0.4375, 0, 0), vec3.fromValues(0.125, 0.75, 0.25)),
  ),
  [BlockModel.lightE]: transformModel(
    blockModel,
    mat4.fromRotationTranslationScale(mat4.create(), rotation, vec3.fromValues(-0.4375, 0, 0), vec3.fromValues(0.125, 0.75, 0.25)),
  ),
  [BlockModel.lightN]: transformModel(
    blockModel,
    mat4.fromRotationTranslationScale(mat4.create(), rotation, vec3.fromValues(0, 0, 0.4375), vec3.fromValues(0.25, 0.75, 0.125)),
  ),
  [BlockModel.lightT]: transformModel(
    blockModel,
    mat4.fromRotationTranslationScale(mat4.create(), rotation, vec3.fromValues(0, -0.4375, 0), vec3.fromValues(0.25, 0.125, 0.75)),
  ),
  [BlockModel.lightB]: transformModel(
    blockModel,
    mat4.fromRotationTranslationScale(mat4.create(), rotation, vec3.fromValues(0, 0.4375, 0), vec3.fromValues(0.25, 0.125, 0.75)),
  ),
};
